// src/lib/db.js
import { supabase } from './supabase';
import { addDays, generateInvoiceNumber } from './utils';

// Local cache invalidation helper for dashboard stats
export function invalidateDashboardCache(tenantId) {
  if (!tenantId) return;
  const ranges = ['today', 'week', 'month', 'quarter', 'year'];
  ranges.forEach(range => {
    try {
      localStorage.removeItem(`dashboard_stats_${tenantId}_${range}`);
    } catch (e) {
      console.warn('Failed to clear dashboard cache:', e);
    }
  });
}

export async function verifyWritePermission(action, entity, entityId = null) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');
  
  const role = await getUserRole(user.id);
  
  // Viewer cannot write to anything
  if (role === 'viewer') {
    await supabase.from('audit_logs').insert([{
      user_id: user.id,
      action: 'failed_access',
      entity_type: entity,
      entity_id: entityId && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(entityId) ? entityId : null,
      details: { action, reason: 'Viewer tried to write', raw_entity_id: entityId }
    }]);
    throw new Error('Permission denied: Viewers cannot modify data.');
  }
  
  // Accountant cannot write to user_roles or team_invites
  if (role === 'accountant' && (entity === 'user_roles' || entity === 'team_invites')) {
    await supabase.from('audit_logs').insert([{
      user_id: user.id,
      action: 'failed_access',
      entity_type: entity,
      entity_id: entityId && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(entityId) ? entityId : null,
      details: { action, reason: 'Accountant tried to modify admin settings', raw_entity_id: entityId }
    }]);
    throw new Error('Permission denied: Accountants cannot modify user roles or team settings.');
  }
  
  return user;
}

export async function getTenantId(userId) {
  let activeUserId = userId;
  if (!activeUserId) {
    const { data: { user } } = await supabase.auth.getUser();
    activeUserId = user?.id;
  }
  if (!activeUserId) return null;

  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (authUser && authUser.id === activeUserId) {
    const email = authUser.email;
    if (email) {
      const { data: invite, error } = await supabase
        .from('team_invites')
        .select('owner_id')
        .eq('email', email.toLowerCase().trim())
        .eq('status', 'accepted')
        .limit(1)
        .maybeSingle();
      if (!error && invite) {
        return invite.owner_id;
      }
    }
  }
  return activeUserId;
}

export async function getAuditLogs() {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

const DEFAULT_DOCUMENT_KIND = {
  sale: 'sale_invoice',
  purchase: 'purchase_bill',
};

const DOCUMENT_PREFIX = {
  sale_invoice: 'INV',
  quotation: 'QUO',
  estimate: 'EST',
  proforma_invoice: 'PI',
  delivery_challan: 'DC',
  purchase_order: 'PO',
  purchase_bill: 'PUR',
  purchase_return: 'PR',
  credit_note: 'CN',
  debit_note: 'DN',
};

export const DOCUMENT_KINDS = {
  sale_invoice: { type: 'sale', label: 'Sales Invoice', route: '/invoices', payment: true, stock: 'out' },
  quotation: { type: 'sale', label: 'Quotation', route: '/quotations', payment: false, stock: false },
  estimate: { type: 'sale', label: 'Estimate', route: '/estimates', payment: false, stock: false },
  proforma_invoice: { type: 'sale', label: 'Proforma Invoice', route: '/proforma', payment: false, stock: false },
  delivery_challan: { type: 'sale', label: 'Delivery Challan', route: '/delivery-challans', payment: false, stock: 'out' },
  credit_note: { type: 'sale', label: 'Credit Note', route: '/credit-notes', payment: false, stock: 'in' },
  purchase_bill: { type: 'purchase', label: 'Purchase Bill', route: '/purchases', payment: true, stock: 'in' },
  purchase_order: { type: 'purchase', label: 'Purchase Order', route: '/purchase-orders', payment: false, stock: false },
  purchase_return: { type: 'purchase', label: 'Purchase Return', route: '/purchase-returns', payment: true, stock: 'out' },
  debit_note: { type: 'purchase', label: 'Debit Note', route: '/debit-notes', payment: false, stock: 'out' },
};

// ─── BUSINESS PROFILE ────────────────────────────────────────────
export async function getProfile(userId) {
  const tenantId = await getTenantId(userId);
  const { data, error } = await supabase.from('business_profile').select('*').eq('user_id', tenantId).maybeSingle();
  if (error) throw error;
  return data;
}
export async function saveProfile(userId, profile) {
  const user = await verifyWritePermission('save', 'business_profile');
  const tenantId = await getTenantId(userId);
  const { data: existing, error: existingError } = await supabase.from('business_profile').select('id').eq('user_id', tenantId).maybeSingle();
  if (existingError) throw existingError;
  let result;
  if (existing) {
    const { data, error } = await supabase.from('business_profile').update(profile).eq('user_id', tenantId).select().single();
    if (error) throw error;
    result = data;
  } else {
    const { data, error } = await supabase.from('business_profile').insert([{ ...profile, user_id: tenantId }]).select().single();
    if (error) throw error;
    result = data;
  }
  await supabase.from('audit_logs').insert([{
    user_id: user.id,
    action: existing ? 'update' : 'create',
    entity_type: 'business_profile',
    entity_id: null,
    details: { business_name: profile.business_name }
  }]);
  invalidateDashboardCache(tenantId);
  return result;
}

// ─── CUSTOMERS / SUPPLIERS ───────────────────────────────────────
export async function getParties(userId, type, page = null, limit = null, search = '') {
  const tenantId = await getTenantId(userId);
  let query = supabase.from('customers').select('*', { count: 'exact' }).eq('user_id', tenantId).eq('type', type);
  
  if (search) {
    query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
  }
  
  query = query.order('name');
  
  if (page && limit) {
    query = query.range((page - 1) * limit, page * limit - 1);
  }
  
  const { data, error, count } = await query;
  if (error) throw error;
  const result = data || [];
  result.totalCount = count || 0;
  return result;
}
export async function addParty(userId, party) {
  const user = await verifyWritePermission('create', 'customers');
  const tenantId = await getTenantId(userId);
  const { data, error } = await supabase.from('customers').insert([{ ...party, user_id: tenantId }]).select().single();
  if (error) throw error;
  await supabase.from('audit_logs').insert([{
    user_id: user.id,
    action: 'create',
    entity_type: 'customers',
    entity_id: data.id,
    details: { name: party.name, type: party.type }
  }]);
  invalidateDashboardCache(tenantId);
  return data;
}
export async function bulkImportParties(userId, parties, type) {
  const user = await verifyWritePermission('create', 'customers');
  const tenantId = await getTenantId(userId);

  const { data: job } = await supabase.from('migration_jobs').insert([{
    user_id: tenantId,
    file_name: `${type}_import_${new Date().toISOString().slice(0, 10)}.csv`,
    target_type: type === 'supplier' ? 'suppliers' : 'customers',
    status: 'completed',
    rows_imported: parties.length
  }]).select().single();

  const rows = parties.map(p => ({
    user_id: tenantId,
    type: type,
    name: p.name || p.Name || p.CustomerName || p.PartyName || p.customer_name || p.party_name || p.client_name || p.ClientName || p.supplier_name || p.SupplierName || p.vendor_name || p.VendorName || '',
    email: p.email || p.Email || p.email_address || p.EmailAddress || p.mail || p.Mail || '',
    phone: p.phone || p.Phone || p.Mobile || p.mobile || p.Contact || p.contact || p.contact_number || p.ContactNumber || p.phone_number || p.PhoneNumber || p.tel || p.Tel || '',
    address: p.address || p.Address || p.addr || p.Addr || p.location || p.Location || '',
    gstin: p.gstin || p.GSTIN || p.GstNumber || p.gst_number || p.GSTNumber || p.gst_no || p.GSTNo || p.tax_id || p.TaxID || '',
    state: p.state || p.State || p.region || p.Region || p.province || p.Province || '',
    opening_balance: parseFloat(p.opening_balance || p.OpeningBalance || p.balance || p.Balance || 0),
    opening_balance_type: p.opening_balance_type || p.OpeningBalanceType || 'Dr',
    migration_job_id: job ? job.id : null
  }));
  const { data, error } = await supabase.from('customers').insert(rows).select();
  if (error) throw error;
  await supabase.from('audit_logs').insert([{
    user_id: user.id,
    action: 'create',
    entity_type: 'customers',
    entity_id: null,
    details: { count: rows.length, type }
  }]);
  return data;
}
export async function updateParty(id, party) {
  const user = await verifyWritePermission('update', 'customers', id);
  const { data, error } = await supabase.from('customers').update(party).eq('id', id).select().single();
  if (error) throw error;
  await supabase.from('audit_logs').insert([{
    user_id: user.id,
    action: 'update',
    entity_type: 'customers',
    entity_id: id,
    details: { name: party.name }
  }]);
  const tId = await getTenantId(user.id);
  invalidateDashboardCache(tId);
  return data;
}
export async function deleteParty(id) {
  const user = await verifyWritePermission('delete', 'customers', id);
  const { error } = await supabase.from('customers').delete().eq('id', id);
  if (error) throw error;
  await supabase.from('audit_logs').insert([{
    user_id: user.id,
    action: 'delete',
    entity_type: 'customers',
    entity_id: id
  }]);
  const tId = await getTenantId(user.id);
  invalidateDashboardCache(tId);
}

// ─── PRODUCTS ────────────────────────────────────────────────────
export async function getProducts(userId, page = null, limit = null, search = '', categoryId = '') {
  const tenantId = await getTenantId(userId);
  let query = supabase.from('products').select('*, product_categories(name)', { count: 'exact' }).eq('user_id', tenantId);
  
  if (categoryId) {
    query = query.eq('category_id', categoryId);
  }
  
  if (search) {
    query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%,barcode.ilike.%${search}%`);
  }
  
  query = query.order('name');
  
  if (page && limit) {
    query = query.range((page - 1) * limit, page * limit - 1);
  }
  
  const { data, error, count } = await query;
  if (error) throw error;
  const result = data || [];
  result.totalCount = count || 0;
  return result;
}
export async function addProduct(userId, product) {
  const user = await verifyWritePermission('create', 'products');
  const tenantId = await getTenantId(userId);
  const { data, error } = await supabase.from('products').insert([{ ...product, user_id: tenantId }]).select().single();
  if (error) throw error;
  await supabase.from('audit_logs').insert([{
    user_id: user.id,
    action: 'create',
    entity_type: 'products',
    entity_id: data.id,
    details: { name: product.name }
  }]);
  invalidateDashboardCache(tenantId);
  return data;
}
export async function bulkImportProducts(userId, products) {
  const user = await verifyWritePermission('create', 'products');
  const tenantId = await getTenantId(userId);

  const { data: job } = await supabase.from('migration_jobs').insert([{
    user_id: tenantId,
    file_name: `products_import_${new Date().toISOString().slice(0, 10)}.csv`,
    target_type: 'products',
    status: 'completed',
    rows_imported: products.length
  }]).select().single();

  const rows = products.map(p => ({
    user_id: tenantId,
    name: p.name || p.Name || p.ProductName || p.product_name || p.item_name || p.Item || p.ItemName || p.product || p.Product || '',
    hsn: p.hsn || p.HSN || p.HsnCode || p.hsn_code || p.HSNCode || p.hsn_code || '',
    gst: parseFloat(p.gst || p.GST || p.GstRate || p.gst_rate || p.GSTRate || p.gst_percent || p.GSTPercent || p.tax_rate || p.TaxRate || 18) || 18,
    stock: parseFloat(p.stock || p.Stock || p.Quantity || p.quantity || p.qty || p.Qty || p.inventory || p.Inventory || 0) || 0,
    sale_price: parseFloat(p.sale_price || p.SalePrice || p.Price || p.price || p.Rate || p.rate || p.selling_price || p.SellingPrice || p.mrp || p.MRP || 0) || 0,
    purchase_price: parseFloat(p.purchase_price || p.PurchasePrice || p.Cost || p.cost || p.buying_price || p.BuyingPrice || p.wholesale_price || p.WholesalePrice || 0) || 0,
    unit: p.unit || p.Unit || p.units || p.Units || p.uom || p.UOM || 'Pcs',
    sku: p.sku || p.SKU || p.Sku || p.product_code || p.ProductCode || '',
    barcode: p.barcode || p.Barcode || p.ean || p.EAN || p.upc || p.UPC || '',
    mrp: parseFloat(p.mrp || p.MRP || p.max_retail_price || 0) || 0,
    min_stock: parseFloat(p.min_stock || p.MinStock || p.reorder_level || 0) || 0,
    track_stock: p.track_stock !== undefined ? p.track_stock : true,
    is_service: p.is_service !== undefined ? p.is_service : false,
    description: p.description || p.Description || p.remarks || p.Remarks || '',
    migration_job_id: job ? job.id : null
  }));
  const { data, error } = await supabase.from('products').insert(rows).select();
  if (error) throw error;
  await supabase.from('audit_logs').insert([{
    user_id: user.id,
    action: 'create',
    entity_type: 'products',
    entity_id: null,
    details: { count: rows.length }
  }]);
  return data;
}
export async function updateProduct(id, product) {
  const user = await verifyWritePermission('update', 'products', id);
  const { data, error } = await supabase.from('products').update(product).eq('id', id).select().single();
  if (error) throw error;
  await supabase.from('audit_logs').insert([{
    user_id: user.id,
    action: 'update',
    entity_type: 'products',
    entity_id: id,
    details: { name: product.name }
  }]);
  const tId = await getTenantId(user.id);
  invalidateDashboardCache(tId);
  return data;
}
export async function deleteProduct(id) {
  const user = await verifyWritePermission('delete', 'products', id);
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) throw error;
  await supabase.from('audit_logs').insert([{
    user_id: user.id,
    action: 'delete',
    entity_type: 'products',
    entity_id: id
  }]);
  const tId = await getTenantId(user.id);
  invalidateDashboardCache(tId);
}

export async function getProductCategories(userId) {
  const tenantId = await getTenantId(userId);
  const { data, error } = await supabase
    .from('product_categories')
    .select('*')
    .eq('user_id', tenantId)
    .order('name');
  if (error) throw error;
  return data || [];
}

export async function createProductCategory(userId, name) {
  const user = await verifyWritePermission('create', 'product_categories');
  const tenantId = await getTenantId(userId);
  const { data, error } = await supabase
    .from('product_categories')
    .insert([{ user_id: tenantId, name }])
    .select()
    .single();
  if (error) throw error;
  await supabase.from('audit_logs').insert([{
    user_id: user.id,
    action: 'create',
    entity_type: 'product_categories',
    entity_id: data.id,
    details: { name }
  }]);
  return data;
}

export async function deleteProductCategory(id) {
  const user = await verifyWritePermission('delete', 'product_categories', id);
  const { error } = await supabase.from('product_categories').delete().eq('id', id);
  if (error) throw error;
  await supabase.from('audit_logs').insert([{
    user_id: user.id,
    action: 'delete',
    entity_type: 'product_categories',
    entity_id: id
  }]);
}
// Adjust stock after invoice save (deprecated - handled by DB triggers)
export async function adjustStock(userId, items, invoiceType, documentKind, direction = 'deduct', warehouseId = null) {
  return;
}

// ─── INVOICES ────────────────────────────────────────────────────
function normalizeDocumentKind(type, documentKind) {
  return documentKind || DEFAULT_DOCUMENT_KIND[type] || 'sale_invoice';
}

function hydrateInvoice(invoice) {
  return {
    ...invoice,
    document_kind: normalizeDocumentKind(invoice.type, invoice.document_kind),
  };
}

function shouldAdjustStock(invoiceType, documentKind) {
  const kind = normalizeDocumentKind(invoiceType, documentKind);
  return !!DOCUMENT_KINDS[kind]?.stock;
}

export async function getInvoices(userId, type, documentKind = null, page = null, limit = null, search = '', status = '') {
  const tenantId = await getTenantId(userId);
  let query = supabase
    .from('invoices')
    .select('*, invoice_items(*), customers(id, name, phone, gstin, address)', { count: 'exact' })
    .eq('user_id', tenantId).eq('type', type);
    
  if (documentKind) {
    query = query.eq('document_kind', documentKind);
  }
  
  if (status && status !== 'all') {
    query = query.eq('status', status);
  }
  
  if (search) {
    query = query.ilike('invoice_no', `%${search}%`);
  }
  
  query = query.order('created_at', { ascending: false });
  
  if (page && limit) {
    query = query.range((page - 1) * limit, page * limit - 1);
  }
  
  const { data, error, count } = await query;
  if (error) throw error;
  const result = (data || []).map(hydrateInvoice);
  result.totalCount = count || 0;
  return result;
}
export async function getInvoiceById(id) {
  const { data, error } = await supabase
    .from('invoices')
    .select('*, invoice_items(*), customers(*)')
    .eq('id', id).single();
  if (error) throw error; return hydrateInvoice(data);
}
function normalizeInvoicePrefix(prefix, type, documentKind) {
  const kind = normalizeDocumentKind(type, documentKind);
  if (kind !== 'sale_invoice') return DOCUMENT_PREFIX[kind] || 'INV';
  const clean = (prefix || 'INV').trim().replace(/\s+/g, '-').replace(/[^A-Za-z0-9-]/g, '').toUpperCase();
  return clean || 'INV';
}
async function getInvoicePrefix(userId, type, documentKind) {
  const tenantId = await getTenantId(userId);
  const kind = normalizeDocumentKind(type, documentKind);
  if (kind !== 'sale_invoice') return DOCUMENT_PREFIX[kind] || 'INV';
  const profile = await getProfile(tenantId);
  return normalizeInvoicePrefix(profile?.invoice_prefix, type, kind);
}
async function ensureAvailableInvoiceNo(userId, type, documentKind, requestedInvoiceNo) {
  const tenantId = await getTenantId(userId);
  const kind = normalizeDocumentKind(type, documentKind);
  const { data, error } = await supabase.from('invoices').select('invoice_no').eq('user_id', tenantId).eq('type', type).eq('document_kind', kind).eq('invoice_no', requestedInvoiceNo).maybeSingle();
  if (error) throw error;
  return data ? getNextInvoiceNo(tenantId, type, kind) : requestedInvoiceNo;
}
export async function saveInvoice(userId, invoice, items) {
  const user = await verifyWritePermission('create', 'invoices');
  const tenantId = await getTenantId(userId);
  const documentKind = normalizeDocumentKind(invoice.type, invoice.document_kind);
  const invoiceNo = await ensureAvailableInvoiceNo(tenantId, invoice.type, documentKind, invoice.invoice_no);
  const isPaymentDoc = DOCUMENT_KINDS[documentKind]?.payment;
  const initialStatus = isPaymentDoc ? 'unpaid' : 'open';
  
  const invoiceData = {
    user_id: tenantId,
    invoice_no: invoiceNo,
    type: invoice.type,
    document_kind: documentKind,
    customer_id: invoice.customer_id || null,
    date: invoice.date,
    due_date: invoice.due_date || null,
    status: invoice.status || initialStatus,
    subtotal: invoice.subtotal,
    gst_amount: invoice.gst_amount,
    discount: invoice.discount || 0,
    round_off: invoice.round_off || 0,
    shipping_charges: invoice.shipping_charges || 0,
    state_of_supply: invoice.state_of_supply || null,
    total: invoice.total,
    paid: invoice.paid || 0,
    balance: invoice.balance ?? invoice.total,
    notes: invoice.notes || null,
    reference_invoice_id: invoice.reference_invoice_id || null,
    last_payment_mode: invoice.paid > 0 ? (invoice.last_payment_mode || 'Cash') : null,
    last_payment_at: invoice.paid > 0 ? new Date().toISOString() : null,
  };

  const itemsData = items.map(item => ({
    product_id: item.product_id || null,
    name: item.name,
    hsn: item.hsn || null,
    qty: item.qty,
    price: item.price,
    gst: item.gst,
    amount: item.amount || (item.qty * item.price),
    unit: item.unit || 'Pcs',
    discount: item.discount || 0,
  }));

  const { data: inv, error: invErr } = await supabase.rpc('create_invoice_with_items', {
    invoice_data: invoiceData,
    items_data: itemsData
  });
  if (invErr) throw invErr;

  await supabase.from('audit_logs').insert([{
    user_id: user.id,
    action: 'create',
    entity_type: 'invoices',
    entity_id: inv.id,
    details: { invoice_no: invoiceNo, total: invoice.total }
  }]);
  invalidateDashboardCache(tenantId);
  return hydrateInvoice(inv);
}
export async function updateInvoiceNotes(invoiceId, notes) {
  const user = await verifyWritePermission('update', 'invoices', invoiceId);
  const { error } = await supabase.from('invoices').update({ notes }).eq('id', invoiceId);
  if (error) throw error;
  await supabase.from('audit_logs').insert([{
    user_id: user.id,
    action: 'update',
    entity_type: 'invoices',
    entity_id: invoiceId,
    details: { note_update: true }
  }]);
  const tId = await getTenantId(user.id);
  invalidateDashboardCache(tId);
}
export async function updateInvoice(invoiceId, userId, invoice, items, oldItems, oldDocumentKind) {
  const user = await verifyWritePermission('update', 'invoices', invoiceId);
  const tenantId = await getTenantId(userId);
  const documentKind = normalizeDocumentKind(invoice.type, invoice.document_kind);
  
  const { data: oldInv } = await supabase.from('invoices').select('warehouse_id').eq('id', invoiceId).single();
  const newWhId = invoice.warehouse_id || null;

  const { error: invErr } = await supabase.from('invoices').update({
    document_kind: documentKind,
    customer_id: invoice.customer_id, date: invoice.date, due_date: invoice.due_date || null,
    status: invoice.status, subtotal: invoice.subtotal, gst_amount: invoice.gst_amount,
    discount: invoice.discount || 0, round_off: invoice.round_off || 0,
    shipping_charges: invoice.shipping_charges || 0,
    state_of_supply: invoice.state_of_supply || null,
    total: invoice.total, paid: invoice.paid, balance: invoice.balance, notes: invoice.notes,
    last_payment_mode: invoice.paid > 0 ? (invoice.last_payment_mode || 'Cash') : null,
    last_payment_at: invoice.paid > 0 ? new Date().toISOString() : null,
    warehouse_id: newWhId,
  }).eq('id', invoiceId);
  if (invErr) throw invErr;
  await supabase.from('invoice_items').delete().eq('invoice_id', invoiceId);
  if (items.length > 0) {
    const rows = items.map(item => ({
      invoice_id: invoiceId, user_id: tenantId, product_id: item.product_id || null,
      name: item.name, hsn: item.hsn || null, qty: item.qty, price: item.price, gst: item.gst,
      amount: item.amount || (item.qty * item.price),
      unit: item.unit || 'Pcs',
      discount: item.discount || 0,
    }));
    await supabase.from('invoice_items').insert(rows);
  }
  
  await supabase.from('audit_logs').insert([{
    user_id: user.id,
    action: 'update',
    entity_type: 'invoices',
    entity_id: invoiceId,
    details: { invoice_no: invoice.invoice_no, total: invoice.total }
  }]);
  const tId = await getTenantId(user.id);
  invalidateDashboardCache(tId);
}
export async function getInvoicePayments(invoiceId) {
  const { data, error } = await supabase.from('invoice_payments').select('*').eq('invoice_id', invoiceId).order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function recordPayment(invoiceId, additionalPayment, paymentMode, note = '') {
  const user = await verifyWritePermission('create', 'invoice_payments', invoiceId);
  const { data: inv, error: invError } = await supabase.from('invoices').select('paid, total, user_id').eq('id', invoiceId).single();
  if (invError) throw invError;
  const newPaid = parseFloat(inv.paid) + parseFloat(additionalPayment);
  const newBalance = parseFloat(inv.total) - newPaid;
  const newStatus = newBalance <= 0 ? 'paid' : newPaid > 0 ? 'partial' : 'unpaid';
  const { error } = await supabase.from('invoices').update({
    paid: newPaid,
    balance: Math.max(0, newBalance),
    status: newStatus,
    last_payment_mode: paymentMode || null,
    last_payment_at: new Date().toISOString(),
  }).eq('id', invoiceId);
  if (error) throw error;
  const { error: paymentError } = await supabase.from('invoice_payments').insert([{
    invoice_id: invoiceId,
    user_id: inv.user_id,
    amount: additionalPayment,
    payment_mode: paymentMode || null,
    note: note || null,
  }]);
  if (paymentError) throw paymentError;

  await supabase.from('audit_logs').insert([{
    user_id: user.id,
    action: 'create',
    entity_type: 'invoice_payments',
    entity_id: invoiceId,
    details: { amount: additionalPayment, payment_mode: paymentMode }
  }]);
  invalidateDashboardCache(inv.user_id);
}
export async function deleteInvoice(id, userId, type, items, documentKind) {
  const user = await verifyWritePermission('delete', 'invoices', id);
  const { error } = await supabase.from('invoices').delete().eq('id', id);
  if (error) throw error;

  await supabase.from('audit_logs').insert([{
    user_id: user.id,
    action: 'delete',
    entity_type: 'invoices',
    entity_id: id
  }]);
  const tId = await getTenantId(user.id);
  invalidateDashboardCache(tId);
}
export async function getNextInvoiceNo(userId, type, documentKind) {
  const tenantId = await getTenantId(userId);
  const kind = normalizeDocumentKind(type, documentKind);
  const prefix = await getInvoicePrefix(tenantId, type, kind);
  const { data, error } = await supabase.from('invoices').select('invoice_no').eq('user_id', tenantId).eq('type', type).eq('document_kind', kind);
  if (error) throw error;
  const maxNumber = (data || []).reduce((max, row) => {
    const match = row.invoice_no?.match(new RegExp(`^${prefix}-(\\d+)$`));
    if (!match) return max;
    return Math.max(max, parseInt(match[1], 10));
  }, 0);
  return `${prefix}-${String(maxNumber + 1).padStart(3, '0')}`;
}

// ─── EXPENSES ────────────────────────────────────────────────────
export async function getExpenses(userId) {
  const tenantId = await getTenantId(userId);
  const { data, error } = await supabase.from('expenses').select('*').eq('user_id', tenantId).order('date', { ascending: false });
  if (error) throw error; return data;
}
export async function addExpense(userId, expense) {
  const user = await verifyWritePermission('create', 'expenses');
  const tenantId = await getTenantId(userId);
  const { data, error } = await supabase.from('expenses').insert([{ ...expense, user_id: tenantId }]).select().single();
  if (error) throw error;
  await supabase.from('audit_logs').insert([{
    user_id: user.id,
    action: 'create',
    entity_type: 'expenses',
    entity_id: data.id,
    details: { amount: expense.amount, category: expense.category }
  }]);
  invalidateDashboardCache(tenantId);
  return data;
}
export async function bulkImportExpenses(userId, expenses) {
  const user = await verifyWritePermission('create', 'expenses');
  const tenantId = await getTenantId(userId);

  const { data: job } = await supabase.from('migration_jobs').insert([{
    user_id: tenantId,
    file_name: `expenses_import_${new Date().toISOString().slice(0, 10)}.csv`,
    target_type: 'expenses',
    status: 'completed',
    rows_imported: expenses.length
  }]).select().single();

  const rows = expenses.map(e => ({
    user_id: tenantId,
    category: e.category || e.Category || e.Type || e.type || e.expense_type || e.ExpenseType || e.head || e.Head || 'Other',
    description: e.description || e.Description || e.Remarks || e.remarks || e.note || e.Note || e.details || e.Details || e.particulars || e.Particulars || '',
    amount: parseFloat(e.amount || e.Amount || e.Total || e.total || e.cost || e.Cost || e.price || e.Price || e.value || e.Value || 0) || 0,
    date: e.date || e.Date || e.transaction_date || e.TransactionDate || e.expense_date || e.ExpenseDate || new Date().toISOString().split('T')[0],
    payment_mode: e.payment_mode || e.PaymentMode || e.Mode || e.mode || e.payment_method || e.PaymentMethod || e.paid_via || e.PaidVia || 'Cash',
    migration_job_id: job ? job.id : null
  }));
  const { data, error } = await supabase.from('expenses').insert(rows).select();
  if (error) throw error;
  await supabase.from('audit_logs').insert([{
    user_id: user.id,
    action: 'create',
    entity_type: 'expenses',
    entity_id: null,
    details: { count: rows.length }
  }]);
  return data;
}

export async function bulkImportInvoices(userId, invoices) {
  const user = await verifyWritePermission('create', 'invoices');
  const tenantId = await getTenantId(userId);

  const { data: job } = await supabase.from('migration_jobs').insert([{
    user_id: tenantId,
    file_name: `invoices_import_${new Date().toISOString().slice(0, 10)}.csv`,
    target_type: 'invoices',
    status: 'completed',
    rows_imported: invoices.length
  }]).select().single();

  const results = [];
  for (const inv of invoices) {
    try {
      // Find customer by name
      const customerName = inv.customer_name || inv.CustomerName || inv.party_name || inv.PartyName || inv.customer || inv.Customer;
      let customerId = null;
      if (customerName) {
        const { data: customers } = await supabase.from('customers').select('id').eq('user_id', tenantId).eq('name', customerName).limit(1);
        if (customers && customers.length > 0) {
          customerId = customers[0].id;
        }
      }

      const invoiceData = {
        user_id: tenantId,
        customer_id: customerId,
        invoice_no: inv.invoice_no || inv.InvoiceNo || inv.invoice_number || inv.InvoiceNumber || inv.bill_no || inv.BillNo || '',
        type: inv.type || inv.Type || 'invoice',
        document_kind: inv.document_kind || inv.DocumentKind || 'invoice',
        date: inv.date || inv.Date || inv.invoice_date || inv.InvoiceDate || new Date().toISOString().split('T')[0],
        due_date: inv.due_date || inv.DueDate || inv.due_date || null,
        status: inv.status || inv.Status || (parseFloat(inv.balance || inv.Balance || 0) > 0 ? 'unpaid' : 'paid'),
        subtotal: parseFloat(inv.subtotal || inv.Subtotal || 0) || 0,
        gst_amount: parseFloat(inv.gst_amount || inv.GSTAmount || inv.tax_amount || inv.TaxAmount || 0) || 0,
        discount: parseFloat(inv.discount || inv.Discount || 0) || 0,
        round_off: parseFloat(inv.round_off || inv.RoundOff || 0) || 0,
        shipping_charges: parseFloat(inv.shipping_charges || inv.ShippingCharges || 0) || 0,
        state_of_supply: inv.state_of_supply || inv.StateOfSupply || inv.place_of_supply || inv.PlaceOfSupply || null,
        total: parseFloat(inv.total || inv.Total || inv.amount || inv.Amount || 0) || 0,
        paid: parseFloat(inv.paid || inv.Paid || inv.amount_paid || inv.AmountPaid || 0) || 0,
        balance: parseFloat(inv.balance || inv.Balance || inv.due || inv.Due || 0) || 0,
        notes: inv.notes || inv.Notes || inv.remarks || inv.Remarks || '',
        last_payment_mode: inv.last_payment_mode || inv.LastPaymentMode || null,
        last_payment_at: inv.last_payment_at || inv.LastPaymentAt || null,
        migration_job_id: job ? job.id : null
      };

      const { data: invoice, error: invError } = await supabase.from('invoices').insert([invoiceData]).select().single();
      if (invError) throw invError;

      // Import invoice items if provided
      if (inv.items && Array.isArray(inv.items)) {
        const itemRows = inv.items.map(item => ({
          invoice_id: invoice.id,
          user_id: tenantId,
          product_id: item.product_id || null,
          name: item.name || item.Name || item.item_name || item.ItemName || item.product || item.Product || '',
          hsn: item.hsn || item.HSN || item.hsn_code || null,
          qty: parseFloat(item.qty || item.Qty || item.quantity || item.Quantity || 1) || 1,
          price: parseFloat(item.price || item.Price || item.rate || item.Rate || 0) || 0,
          gst: parseFloat(item.gst || item.GST || item.tax_rate || item.TaxRate || 0) || 0,
          amount: parseFloat(item.amount || item.Amount || item.total || item.Total || 0) || (parseFloat(item.qty || 1) * parseFloat(item.price || 0)),
          unit: item.unit || item.Unit || 'Pcs',
          discount: parseFloat(item.discount || item.Discount || 0) || 0,
        }));
        const { error: itemError } = await supabase.from('invoice_items').insert(itemRows);
        if (itemError) throw itemError;
      }

      // Import payments if provided
      if (inv.payments && Array.isArray(inv.payments)) {
        const paymentRows = inv.payments.map(payment => ({
          invoice_id: invoice.id,
          user_id: tenantId,
          amount: parseFloat(payment.amount || payment.Amount || 0) || 0,
          payment_mode: payment.payment_mode || payment.PaymentMode || payment.mode || payment.Mode || 'Cash',
          note: payment.note || payment.Note || payment.remarks || payment.Remarks || '',
          created_at: payment.date || payment.Date || payment.payment_date || payment.PaymentDate || new Date().toISOString(),
        }));
        const { error: paymentError } = await supabase.from('invoice_payments').insert(paymentRows);
        if (paymentError) throw paymentError;
      }

      results.push({ success: true, invoice_no: invoice.invoice_no });
    } catch (err) {
      results.push({ success: false, error: err.message, invoice_no: inv.invoice_no || 'unknown' });
    }
  }
  return results;
}

export async function bulkImportPayments(userId, payments) {
  const user = await verifyWritePermission('create', 'invoice_payments');
  const tenantId = await getTenantId(userId);
  const rows = payments.map(p => ({
    user_id: tenantId,
    invoice_id: p.invoice_id || null, // Can be null if invoice not yet imported
    amount: parseFloat(p.amount || p.Amount || p.payment_amount || p.PaymentAmount || 0) || 0,
    payment_mode: p.payment_mode || p.PaymentMode || p.mode || p.Mode || p.method || p.Method || 'Cash',
    note: p.note || p.Note || p.remarks || p.Remarks || p.description || p.Description || '',
    created_at: p.date || p.Date || p.payment_date || p.PaymentDate || new Date().toISOString(),
  }));
  const { data, error } = await supabase.from('invoice_payments').insert(rows).select();
  if (error) throw error;
  await supabase.from('audit_logs').insert([{
    user_id: user.id,
    action: 'create',
    entity_type: 'invoice_payments',
    entity_id: null,
    details: { count: rows.length }
  }]);
  return data;
}

// Payment Reminders
export async function getPaymentReminders(userId) {
  const tenantId = await getTenantId(userId);
  const { data, error } = await supabase.from('payment_reminders').select('*').eq('user_id', tenantId).order('reminder_date', { ascending: true });
  if (error) throw error; return data;
}

export async function createPaymentReminder(userId, reminder) {
  const user = await verifyWritePermission('create', 'payment_reminders');
  const tenantId = await getTenantId(userId);
  const { data, error } = await supabase.from('payment_reminders').insert([{
    user_id: tenantId,
    invoice_id: reminder.invoice_id,
    customer_id: reminder.customer_id,
    reminder_date: reminder.reminder_date,
    reminder_type: reminder.reminder_type || 'due_date', // 'due_date', 'before_due', 'after_due', 'custom'
    days_before: reminder.days_before || null,
    message: reminder.message || '',
    status: 'pending',
    sent_via: reminder.sent_via || ['whatsapp'], // 'whatsapp', 'email', 'sms'
    created_at: new Date().toISOString()
  }]).select().single();
  if (error) throw error;
  await supabase.from('audit_logs').insert([{
    user_id: user.id,
    action: 'create',
    entity_type: 'payment_reminders',
    entity_id: data.id,
    details: { reminder_date: reminder.reminder_date }
  }]);
  return data;
}

export async function updateReminderStatus(reminderId, status) {
  const user = await verifyWritePermission('update', 'payment_reminders', reminderId);
  const { data, error } = await supabase.from('payment_reminders').update({ 
    status,
    sent_at: status === 'sent' ? new Date().toISOString() : null
  }).eq('id', reminderId).select().single();
  if (error) throw error;
  await supabase.from('audit_logs').insert([{
    user_id: user.id,
    action: 'update',
    entity_type: 'payment_reminders',
    entity_id: reminderId,
    details: { status }
  }]);
  return data;
}

export async function deleteReminder(reminderId) {
  const user = await verifyWritePermission('delete', 'payment_reminders', reminderId);
  const { error } = await supabase.from('payment_reminders').delete().eq('id', reminderId);
  if (error) throw error;
  await supabase.from('audit_logs').insert([{
    user_id: user.id,
    action: 'delete',
    entity_type: 'payment_reminders',
    entity_id: reminderId
  }]);
}

export async function getDueInvoicesForReminders(userId) {
  const tenantId = await getTenantId(userId);
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase.from('invoices').select(`
    *,
    customers!inner(name, phone)
  `).eq('user_id', tenantId).in('status', ['unpaid', 'partial']).lte('due_date', today).gt('balance', 0);
  if (error) throw error; return data;
}

// Inventory Management
export async function getLowStockProducts(userId, threshold = 10) {
  const tenantId = await getTenantId(userId);
  const { data, error } = await supabase.from('products')
    .select('*')
    .eq('user_id', tenantId);
  if (error) throw error;
  // Filter products that track stock, are not services, and where stock is less than or equal to min_stock (and min_stock > 0)
  return (data || []).filter(p => p.track_stock && !p.is_service && p.stock <= p.min_stock && p.min_stock > 0);
}

export async function updateProductStock(productId, quantity, operation = 'add') {
  const user = await verifyWritePermission('update', 'products', productId);
  const tenantId = await getTenantId(user.id);
  const qty = operation === 'add' ? parseFloat(quantity) : -parseFloat(quantity);
  
  // Insert a stock adjustment row to let DB triggers handle stock update atomically and sync accounting
  const { data: adj, error: adjErr } = await supabase
    .from('stock_adjustments')
    .insert([{
      user_id: tenantId,
      product_id: productId,
      qty: qty,
      reason: 'Quick Stock Update'
    }])
    .select()
    .single();
    
  if (adjErr) throw adjErr;

  await supabase.from('audit_logs').insert([{
    user_id: user.id,
    action: 'update',
    entity_type: 'products',
    entity_id: productId,
    details: { stock_adjust: operation, qty: quantity }
  }]);

  const { data: prod, error: prodErr } = await supabase.from('products').select('*').eq('id', productId).single();
  if (prodErr) throw prodErr;
  return prod;
}

export async function createStockAlert(userId, alert) {
  const user = await verifyWritePermission('create', 'stock_alerts');
  const tenantId = await getTenantId(userId);
  const { data, error } = await supabase.from('stock_alerts').insert([{
    user_id: tenantId,
    product_id: alert.product_id,
    threshold: alert.threshold || 10,
    alert_type: alert.alert_type || 'low_stock', // 'low_stock', 'out_of_stock', 'reorder'
    status: 'active',
    created_at: new Date().toISOString()
  }]).select().single();
  if (error) throw error;
  await supabase.from('audit_logs').insert([{
    user_id: user.id,
    action: 'create',
    entity_type: 'stock_alerts',
    entity_id: data.id,
    details: { threshold: alert.threshold }
  }]);
  return data;
}

export async function getStockAlerts(userId) {
  const tenantId = await getTenantId(userId);
  const { data, error } = await supabase.from('stock_alerts')
    .select(`
      *,
      products!inner(name, stock, unit)
    `)
    .eq('user_id', tenantId)
    .eq('status', 'active')
    .order('created_at', { ascending: false });
  if (error) throw error; return data;
}

export async function updateStockAlertStatus(alertId, status) {
  const user = await verifyWritePermission('update', 'stock_alerts', alertId);
  const { data, error } = await supabase.from('stock_alerts')
    .update({ status, resolved_at: status === 'resolved' ? new Date().toISOString() : null })
    .eq('id', alertId)
    .select()
    .single();
  if (error) throw error;
  await supabase.from('audit_logs').insert([{
    user_id: user.id,
    action: 'update',
    entity_type: 'stock_alerts',
    entity_id: alertId,
    details: { status }
  }]);
  return data;
}

export async function deleteStockAlert(alertId) {
  const user = await verifyWritePermission('delete', 'stock_alerts', alertId);
  const { error } = await supabase.from('stock_alerts').delete().eq('id', alertId);
  if (error) throw error;
  await supabase.from('audit_logs').insert([{
    user_id: user.id,
    action: 'delete',
    entity_type: 'stock_alerts',
    entity_id: alertId
  }]);
}

// Recurring Invoices
export async function getRecurringInvoices(userId) {
  const tenantId = await getTenantId(userId);
  const { data, error } = await supabase.from('recurring_invoices')
    .select(`
      *,
      customers!inner(name),
      base_invoice!inner(invoice_no, subtotal, gst_amount, discount, total)
    `)
    .eq('user_id', tenantId)
    .eq('status', 'active')
    .order('next_invoice_date', { ascending: true });
  if (error) throw error; return data;
}

export async function createRecurringInvoice(userId, recurring) {
  const user = await verifyWritePermission('create', 'recurring_invoices');
  const tenantId = await getTenantId(userId);
  const { data, error } = await supabase.from('recurring_invoices').insert([{
    user_id: tenantId,
    base_invoice_id: recurring.base_invoice_id,
    customer_id: recurring.customer_id,
    frequency: recurring.frequency, // 'daily', 'weekly', 'monthly', 'quarterly', 'yearly'
    interval: recurring.interval || 1,
    next_invoice_date: recurring.next_invoice_date,
    end_date: recurring.end_date || null,
    max_invoices: recurring.max_invoices || null,
    invoice_count: 0,
    status: 'active',
    created_at: new Date().toISOString()
  }]).select().single();
  if (error) throw error;
  await supabase.from('audit_logs').insert([{
    user_id: user.id,
    action: 'create',
    entity_type: 'recurring_invoices',
    entity_id: data.id,
    details: { frequency: recurring.frequency }
  }]);
  return data;
}

export async function updateRecurringInvoice(recurringId, updates) {
  const user = await verifyWritePermission('update', 'recurring_invoices', recurringId);
  const { data, error } = await supabase.from('recurring_invoices')
    .update(updates)
    .eq('id', recurringId)
    .select()
    .single();
  if (error) throw error;
  await supabase.from('audit_logs').insert([{
    user_id: user.id,
    action: 'update',
    entity_type: 'recurring_invoices',
    entity_id: recurringId,
    details: updates
  }]);
  return data;
}

export async function pauseRecurringInvoice(recurringId) {
  const user = await verifyWritePermission('update', 'recurring_invoices', recurringId);
  const { data, error } = await supabase.from('recurring_invoices')
    .update({ status: 'paused', paused_at: new Date().toISOString() })
    .eq('id', recurringId)
    .select()
    .single();
  if (error) throw error;
  await supabase.from('audit_logs').insert([{
    user_id: user.id,
    action: 'update',
    entity_type: 'recurring_invoices',
    entity_id: recurringId,
    details: { action: 'pause' }
  }]);
  return data;
}

export async function resumeRecurringInvoice(recurringId, nextDate) {
  const user = await verifyWritePermission('update', 'recurring_invoices', recurringId);
  const { data, error } = await supabase.from('recurring_invoices')
    .update({ 
      status: 'active', 
      next_invoice_date: nextDate,
      paused_at: null 
    })
    .eq('id', recurringId)
    .select()
    .single();
  if (error) throw error;
  await supabase.from('audit_logs').insert([{
    user_id: user.id,
    action: 'update',
    entity_type: 'recurring_invoices',
    entity_id: recurringId,
    details: { action: 'resume', next_invoice_date: nextDate }
  }]);
  return data;
}

export async function deleteRecurringInvoice(recurringId) {
  const user = await verifyWritePermission('delete', 'recurring_invoices', recurringId);
  const { error } = await supabase.from('recurring_invoices').delete().eq('id', recurringId);
  if (error) throw error;
  await supabase.from('audit_logs').insert([{
    user_id: user.id,
    action: 'delete',
    entity_type: 'recurring_invoices',
    entity_id: recurringId
  }]);
}

export async function generateInvoiceFromRecurring(recurringId) {
  const user = await verifyWritePermission('create', 'invoices');
  // Get recurring invoice details
  const { data: recurring } = await supabase.from('recurring_invoices')
    .select(`
      *,
      customers!inner(name, email, phone, address, gstin, state),
      base_invoice!inner(
        invoice_no,
        subtotal,
        gst_amount,
        discount,
        round_off,
        total,
        notes
      )
    `)
    .eq('id', recurringId)
    .single();

  if (!recurring) throw new Error('Recurring invoice not found');

  // Get base invoice items
  const { data: baseItems } = await supabase.from('invoice_items')
    .select('*')
    .eq('invoice_id', recurring.base_invoice_id);

  // Generate new invoice number
  const newInvoiceNo = generateInvoiceNumber('INV-', Date.now());

  // Create new invoice
  const { data: newInvoice, error: invError } = await supabase.from('invoices').insert([{
    user_id: recurring.user_id,
    customer_id: recurring.customer_id,
    invoice_no: newInvoiceNo,
    type: 'invoice',
    document_kind: 'invoice',
    date: new Date().toISOString().split('T')[0],
    due_date: addDays(new Date().toISOString().split('T')[0], 30),
    status: 'unpaid',
    subtotal: recurring.base_invoice.subtotal,
    gst_amount: recurring.base_invoice.gst_amount,
    discount: recurring.base_invoice.discount,
    round_off: recurring.base_invoice.round_off,
    total: recurring.base_invoice.total,
    paid: 0,
    balance: recurring.base_invoice.total,
    notes: recurring.base_invoice.notes,
    recurring_invoice_id: recurring.id
  }]).select().single();

  if (invError) throw invError;

  // Copy invoice items
  if (baseItems && baseItems.length > 0) {
    const newItems = baseItems.map(item => ({
      invoice_id: newInvoice.id,
      user_id: recurring.user_id,
      product_id: item.product_id,
      name: item.name,
      hsn: item.hsn,
      qty: item.qty,
      price: item.price,
      gst: item.gst,
      amount: item.amount
    }));
    await supabase.from('invoice_items').insert(newItems);
  }

  // Update recurring invoice
  const nextDate = calculateNextInvoiceDate(recurring.frequency, recurring.interval);
  const shouldEnd = recurring.end_date && new Date(nextDate) > new Date(recurring.end_date);
  const shouldEndByCount = recurring.max_invoices && (recurring.invoice_count + 1) >= recurring.max_invoices;

  await supabase.from('recurring_invoices')
    .update({
      next_invoice_date: shouldEnd || shouldEndByCount ? null : nextDate,
      invoice_count: recurring.invoice_count + 1,
      status: shouldEnd || shouldEndByCount ? 'completed' : 'active',
      last_invoice_date: new Date().toISOString().split('T')[0]
    })
    .eq('id', recurring.id);

  await supabase.from('audit_logs').insert([{
    user_id: user.id,
    action: 'create',
    entity_type: 'invoices',
    entity_id: newInvoice.id,
    details: { source: 'recurring', recurring_invoice_id: recurringId }
  }]);

  return newInvoice;
}

function calculateNextInvoiceDate(frequency, interval) {
  const date = new Date();
  switch (frequency) {
    case 'daily':
      date.setDate(date.getDate() + interval);
      break;
    case 'weekly':
      date.setDate(date.getDate() + (7 * interval));
      break;
    case 'monthly':
      date.setMonth(date.getMonth() + interval);
      break;
    case 'quarterly':
      date.setMonth(date.getMonth() + (3 * interval));
      break;
    case 'yearly':
      date.setFullYear(date.getFullYear() + interval);
      break;
    default:
      date.setMonth(date.getMonth() + 1);
  }
  return date.toISOString().split('T')[0];
}
export async function updateExpense(id, expense) {
  const user = await verifyWritePermission('update', 'expenses', id);
  const { data, error } = await supabase.from('expenses').update(expense).eq('id', id).select().single();
  if (error) throw error;
  await supabase.from('audit_logs').insert([{
    user_id: user.id,
    action: 'update',
    entity_type: 'expenses',
    entity_id: id,
    details: { amount: expense.amount, category: expense.category }
  }]);
  const tId = await getTenantId(user.id);
  invalidateDashboardCache(tId);
  return data;
}
export async function deleteExpense(id) {
  const user = await verifyWritePermission('delete', 'expenses', id);
  const { error } = await supabase.from('expenses').delete().eq('id', id);
  if (error) throw error;
  await supabase.from('audit_logs').insert([{
    user_id: user.id,
    action: 'delete',
    entity_type: 'expenses',
    entity_id: id
  }]);
  const tId = await getTenantId(user.id);
  invalidateDashboardCache(tId);
}

// ─── PAYMENTS (all) ──────────────────────────────────────────────
export async function getAllPayments(userId, page = null, limit = null, search = '', partyType = '') {
  const tenantId = await getTenantId(userId);
  
  const selectClause = partyType 
    ? '*, customers!inner(name, type), invoices(invoice_no, total, paid, balance, status, customers(name)), payment_allocations(*, invoices(invoice_no, customers(name)))'
    : '*, customers(name, type), invoices(invoice_no, total, paid, balance, status, customers(name)), payment_allocations(*, invoices(invoice_no, customers(name)))';

  let query = supabase
    .from('invoice_payments')
    .select(selectClause, { count: 'exact' })
    .eq('user_id', tenantId);
    
  if (partyType) {
    query = query.eq('customers.type', partyType);
  }
  
  if (search) {
    query = query.or(`note.ilike.%${search}%,payment_mode.ilike.%${search}%`);
  }
  
  query = query.order('created_at', { ascending: false });
  
  if (page && limit) {
    query = query.range((page - 1) * limit, page * limit - 1);
  }
  
  const { data, error, count } = await query;
  if (error) throw error;
  const result = data || [];
  result.totalCount = count || 0;
  return result;
}

export async function recordBulkPayment(userId, customerId, totalAmount, paymentMode, note, allocations) {
  const user = await verifyWritePermission('create', 'invoice_payments');
  const tenantId = await getTenantId(userId);

  // 1. Create parent payment record (invoice_id remains null)
  const { data: payment, error: payError } = await supabase.from('invoice_payments').insert([{
    user_id: tenantId,
    customer_id: customerId,
    amount: totalAmount,
    payment_mode: paymentMode,
    note: note || null
  }]).select().single();
  if (payError) throw payError;

  // 2. Create allocations (trigger will handle invoice status/balance updates)
  if (allocations && allocations.length > 0) {
    const allocationRows = allocations.map(a => ({
      user_id: tenantId,
      payment_id: payment.id,
      invoice_id: a.invoiceId,
      amount: a.amount
    }));
    const { error: allocError } = await supabase.from('payment_allocations').insert(allocationRows);
    if (allocError) throw allocError;
  }

  // 3. Log audit log
  await supabase.from('audit_logs').insert([{
    user_id: user.id,
    action: 'create',
    entity_type: 'invoice_payments',
    entity_id: payment.id,
    details: { amount: totalAmount, allocations_count: allocations?.length || 0 }
  }]);
  invalidateDashboardCache(tenantId);
  return payment;
}

export async function getUnpaidInvoices(userId, type = 'sale') {
  const tenantId = await getTenantId(userId);
  const { data, error } = await supabase
    .from('invoices')
    .select('*, customers(name, phone)')
    .eq('user_id', tenantId)
    .eq('type', type)
    .in('status', ['unpaid', 'partial', 'overdue'])
    .order('due_date', { ascending: true });
  if (error) throw error;
  return data || [];
}

// ─── DASHBOARD ───────────────────────────────────────────────────
export async function getDashboardStats(userId, timeRange = 'month') {
  const tenantId = await getTenantId(userId);
  if (!tenantId) return null;
  
  await syncOverdueStatuses(tenantId);

  const cacheKey = `dashboard_stats_${tenantId}_${timeRange}`;
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const { timestamp, data } = JSON.parse(cached);
      const ageMs = Date.now() - timestamp;
      if (ageMs < 5 * 60 * 1000) { // 5 minutes cache
        return data;
      }
    }
  } catch (e) {
    console.warn('Failed to parse cached dashboard stats', e);
  }

  const today = new Date();
  let startDate = new Date();

  if (timeRange === 'today') {
    startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  } else if (timeRange === 'week') {
    const day = startDate.getDay();
    const diff = startDate.getDate() - day + (day === 0 ? -6 : 1);
    startDate.setDate(diff);
  } else if (timeRange === 'month') {
    startDate = new Date(today.getFullYear(), today.getMonth(), 1);
  } else if (timeRange === 'quarter') {
    const quarter = Math.floor(today.getMonth() / 3);
    startDate = new Date(today.getFullYear(), quarter * 3, 1);
  } else if (timeRange === 'year') {
    startDate = new Date(today.getFullYear(), 0, 1);
  } else {
    startDate = new Date(today.getFullYear(), today.getMonth(), 1);
  }
  
  const startDateStr = startDate.toISOString().split('T')[0];
  const durationMs = today.getTime() - startDate.getTime();
  const prevStartDate = new Date(startDate.getTime() - durationMs);
  const prevStartDateStr = prevStartDate.toISOString().split('T')[0];

  const earliestChartDate = new Date(today.getFullYear(), today.getMonth() - 5, 1);
  const earliestChartDateStr = earliestChartDate.toISOString().split('T')[0];
  const queryStartDateStr = prevStartDateStr < earliestChartDateStr ? prevStartDateStr : earliestChartDateStr;

  // Optimized database calls
  const [
    invoicesRes,
    expensesRes,
    productCountRes,
    customerCountRes,
    lowStockRes,
    recentInvoicesRes,
    overdueInvoicesRes,
    totalPendingRes,
    paymentsRes
  ] = await Promise.all([
    supabase.from('invoices').select('type, document_kind, total, paid, date, last_payment_mode, customer_id, customers(name), invoice_items(name, qty)').eq('user_id', tenantId).gte('date', queryStartDateStr),
    supabase.from('expenses').select('amount, date').eq('user_id', tenantId).gte('date', queryStartDateStr),
    supabase.from('products').select('*', { count: 'exact', head: true }).eq('user_id', tenantId),
    supabase.from('customers').select('*', { count: 'exact', head: true }).eq('user_id', tenantId).eq('type', 'customer'),
    supabase.from('products').select('id, name, stock, unit').eq('user_id', tenantId).lte('stock', 5).order('stock', { ascending: true }).limit(5),
    supabase.from('invoices').select('id, invoice_no, total, status, date, customers(name)').eq('user_id', tenantId).eq('type', 'sale').eq('document_kind', 'sale_invoice').order('date', { ascending: false }).order('created_at', { ascending: false }).limit(5),
    supabase.from('invoices').select('id, invoice_no, total, balance, status, due_date, customers(name, phone)').eq('user_id', tenantId).eq('type', 'sale').eq('document_kind', 'sale_invoice').eq('status', 'overdue').limit(5),
    supabase.from('invoices').select('balance').eq('user_id', tenantId).eq('type', 'sale').eq('document_kind', 'sale_invoice').gt('balance', 0),
    supabase.from('invoice_payments').select('amount, created_at, payment_mode').eq('user_id', tenantId).gte('created_at', `${queryStartDateStr}T00:00:00Z`)
  ]);

  const invoices = invoicesRes.data || [];
  const expenses = expensesRes.data || [];
  const productCount = productCountRes.count || 0;
  const customerCount = customerCountRes.count || 0;
  const lowStock = lowStockRes.data || [];
  const recentInvoices = recentInvoicesRes.data || [];
  const overdueInvoices = overdueInvoicesRes.data || [];
  const totalPending = (totalPendingRes.data || []).reduce((s, i) => s + parseFloat(i.balance || 0), 0);
  const payments = paymentsRes.data || [];

  const saleInvoices = invoices.filter((i) => i.type === 'sale' && i.document_kind === 'sale_invoice');
  const periodSales = saleInvoices.filter((i) => i.date >= startDateStr);
  const prevPeriodSales = saleInvoices.filter((i) => i.date >= prevStartDateStr && i.date < startDateStr);

  const totalSales = periodSales.reduce((s, i) => s + parseFloat(i.total || 0), 0);
  const prevSales = prevPeriodSales.reduce((s, i) => s + parseFloat(i.total || 0), 0);
  const salesGrowth = prevSales > 0 ? parseFloat((((totalSales - prevSales) / prevSales) * 100).toFixed(1)) : 0;

  const periodReceived = payments
    .filter(p => p.created_at && p.created_at.split('T')[0] >= startDateStr)
    .reduce((s, p) => s + parseFloat(p.amount || 0), 0);
  const periodExpenses = expenses.filter((e) => e.date >= startDateStr).reduce((s, e) => s + parseFloat(e.amount || 0), 0);
  const netProfit = totalSales - periodExpenses;

  // Payment Mode Breakdown
  const paymentModeCounts = {};
  payments.filter(p => p.created_at && p.created_at.split('T')[0] >= startDateStr).forEach(p => {
    const mode = p.payment_mode || 'Cash';
    paymentModeCounts[mode] = (paymentModeCounts[mode] || 0) + parseFloat(p.amount || 0);
  });
  const totalPaymentSum = Object.values(paymentModeCounts).reduce((a, b) => a + b, 0);
  const paymentModes = Object.entries(paymentModeCounts).map(([mode, amt]) => ({
    mode,
    percentage: totalPaymentSum > 0 ? Math.round((amt / totalPaymentSum) * 100) : 0,
    amount: amt
  })).sort((a, b) => b.amount - a.amount);

  // Top Customers
  const customerSales = {};
  periodSales.forEach(inv => {
    const name = inv.customers?.name || 'Walk-in Customer';
    customerSales[name] = (customerSales[name] || 0) + parseFloat(inv.total || 0);
  });
  const topCustomers = Object.entries(customerSales)
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3);

  // Top Products
  const productQuantities = {};
  periodSales.forEach(inv => {
    (inv.invoice_items || []).forEach(item => {
      const name = item.name || 'Unknown Product';
      productQuantities[name] = (productQuantities[name] || 0) + parseFloat(item.qty || 0);
    });
  });
  const topProducts = Object.entries(productQuantities)
    .map(([name, qty]) => ({ name, qty }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 3);

  // Insight Summary
  let insight = 'No significant trends detected for this period.';
  if (topCustomers.length > 0) {
    insight = `Top client ${topCustomers[0].name} contributed ${Math.round((topCustomers[0].amount / (totalSales || 1)) * 100)}% of your billing volume.`;
  }
  if (paymentModes.length > 0 && paymentModes[0].mode !== 'Cash') {
    insight += ` ${paymentModes[0].mode} is currently your most active digital channel, capturing ${paymentModes[0].percentage}% of total sales.`;
  }

  const chartData = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const monthStr = d.toISOString().slice(0, 7);
    const monthName = d.toLocaleString('default', { month: 'short' });
    chartData.push({ id: monthStr, month: monthName, sales: 0, expenses: 0 });
  }

  saleInvoices.forEach(inv => {
    if (!inv.date) return;
    const monthStr = inv.date.slice(0, 7);
    const item = chartData.find(c => c.id === monthStr);
    if (item) item.sales += parseFloat(inv.total || 0);
  });

  expenses.forEach(exp => {
    if (!exp.date) return;
    const monthStr = exp.date.slice(0, 7);
    const item = chartData.find(c => c.id === monthStr);
    if (item) item.expenses += parseFloat(exp.amount || 0);
  });

  const result = {
    totalSales,
    totalReceived: periodReceived,
    totalPending,
    totalExpenses: periodExpenses,
    netProfit,
    monthInvoiceCount: periodSales.length,
    customerCount,
    productCount,
    overdueInvoices,
    lowStock,
    recentInvoices,
    chartData,
    salesGrowth,
    paymentModes,
    topCustomers,
    topProducts,
    insight,
  };

  try {
    localStorage.setItem(cacheKey, JSON.stringify({
      timestamp: Date.now(),
      data: result
    }));
  } catch (e) {
    console.warn('Failed to cache dashboard stats', e);
  }

  return result;
}

// ─── REPORTS ─────────────────────────────────────────────────────
export async function getReportsSummary(userId, fromDate, toDate) {
  const tenantId = await getTenantId(userId);
  
  // Sourced from invoices for GSTR-1 HSN summary details
  let invQuery = supabase.from('invoices').select('*, invoice_items(*)').eq('user_id', tenantId);
  if (fromDate) invQuery = invQuery.gte('date', fromDate);
  if (toDate) invQuery = invQuery.lte('date', toDate);
  const { data: invoices } = await invQuery;
  const sales = (invoices || []).filter((i) => i.type === 'sale' && i.document_kind === 'sale_invoice');
  const purchases = (invoices || []).filter((i) => i.type === 'purchase' && i.document_kind === 'purchase_bill');

  const hsnSummary = {};
  for (const inv of sales) {
    for (const item of inv.invoice_items || []) {
      const hsn = item.hsn || 'NA';
      if (!hsnSummary[hsn]) hsnSummary[hsn] = { taxable: 0, gst: 0, qty: 0 };
      const base = parseFloat(item.qty) * parseFloat(item.price);
      hsnSummary[hsn].taxable += base;
      hsnSummary[hsn].gst += base * (parseFloat(item.gst || 0) / 100);
      hsnSummary[hsn].qty += parseFloat(item.qty);
    }
  }

  // Compile Profit & Loss from GL journal items
  let glQuery = supabase
    .from('journal_items')
    .select('debit, credit, chart_of_accounts!inner(name, type), journal_entries!inner(date)')
    .eq('user_id', tenantId);
    
  if (fromDate) glQuery = glQuery.gte('journal_entries.date', fromDate);
  if (toDate) glQuery = glQuery.lte('journal_entries.date', toDate);
  
  const { data: glItems, error: glErr } = await glQuery;
  if (glErr) throw glErr;

  let totalSales = 0;
  let totalCOGS = 0;
  let totalPurchases = 0;
  let totalExpenses = 0;
  let totalGstCollected = 0;
  let totalGstPaid = 0;

  (glItems || []).forEach(item => {
    const coa = item.chart_of_accounts;
    const debit = parseFloat(item.debit || 0);
    const credit = parseFloat(item.credit || 0);
    
    if (coa.type === 'revenue') {
      totalSales += (credit - debit);
    } else if (coa.type === 'expense') {
      if (coa.name === 'Cost of Goods Sold') {
        totalCOGS += (debit - credit);
      } else if (coa.name === 'Purchases') {
        totalPurchases += (debit - credit);
      } else {
        totalExpenses += (debit - credit);
      }
    }
    
    if (coa.name.includes('Output Tax') || coa.name === 'GST Output Tax') {
      totalGstCollected += (credit - debit);
    } else if (coa.name.includes('Input Tax') || coa.name === 'GST Input Tax') {
      totalGstPaid += (debit - credit);
    }
  });

  const costTotal = totalCOGS > 0 ? totalCOGS : totalPurchases;
  const netProfit = totalSales - costTotal - totalExpenses;

  return {
    totalSales,
    totalPurchases: costTotal,
    totalExpenses,
    totalGstCollected,
    totalGstPaid,
    netProfit,
    gstPayable: totalGstCollected - totalGstPaid,
    sales,
    purchases,
    expenses: glItems || [],
    hsnSummary,
    cogs: totalCOGS
  };
}

// ─── TEAM / ROLES ────────────────────────────────────────────────
export async function ensureUserRole(userId, role = 'admin') {
  const { data: existing } = await supabase.from('user_roles').select('id').eq('user_id', userId).maybeSingle();
  if (!existing) {
    await supabase.from('user_roles').insert([{ user_id: userId, role }]);
  }
}

export async function getUserRole(userId) {
  const { data, error } = await supabase.from('user_roles').select('role').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data?.role || 'admin';
}

export async function getTeamInvites(ownerId) {
  const tenantId = await getTenantId(ownerId);
  const { data, error } = await supabase.from('team_invites').select('*').eq('owner_id', tenantId).order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function inviteTeamMember(ownerId, email, role) {
  const user = await verifyWritePermission('create', 'team_invites');
  const tenantId = await getTenantId(ownerId);
  const { data, error } = await supabase.from('team_invites').upsert([{
    owner_id: tenantId, email: email.toLowerCase().trim(), role, status: 'pending',
  }], { onConflict: 'owner_id,email' }).select().single();
  if (error) throw error;
  await supabase.from('audit_logs').insert([{
    user_id: user.id,
    action: 'create',
    entity_type: 'team_invites',
    entity_id: data.id,
    details: { email, role }
  }]);
  return data;
}

export async function applyTeamInvite(userId, email) {
  const { data: invite } = await supabase.from('team_invites').select('*')
    .eq('email', email.toLowerCase()).eq('status', 'pending')
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (!invite) return;

  const isBuiltIn = ['admin', 'accountant', 'viewer'].includes(invite.role);
  let customRoleId = null;
  let assignedRole = invite.role;

  if (!isBuiltIn) {
    const { data: crole } = await supabase
      .from('custom_roles')
      .select('id')
      .eq('user_id', invite.owner_id)
      .eq('name', invite.role)
      .maybeSingle();
    if (crole) {
      customRoleId = crole.id;
      assignedRole = 'custom';
    }
  }

  await supabase.from('user_roles').upsert([{ 
    user_id: userId, 
    role: assignedRole,
    custom_role_id: customRoleId
  }], { onConflict: 'user_id' });

  await supabase.from('team_invites').update({ status: 'accepted' }).eq('id', invite.id);
}

export async function syncOverdueStatuses(userId) {
  const tenantId = await getTenantId(userId);
  const today = new Date().toISOString().split('T')[0];
  const { data: overdue } = await supabase.from('invoices').select('id')
    .eq('user_id', tenantId).eq('type', 'sale').eq('document_kind', 'sale_invoice')
    .gt('balance', 0).lt('due_date', today).neq('status', 'paid');
  for (const inv of overdue || []) {
    await supabase.from('invoices').update({ status: 'overdue' }).eq('id', inv.id);
  }
}

export async function convertToInvoice(userId, sourceInvoiceId) {
  const tenantId = await getTenantId(userId);
  const source = await getInvoiceById(sourceInvoiceId);
  const items = (source.invoice_items || []).map((i) => ({
    product_id: i.product_id, name: i.name, hsn: i.hsn, qty: i.qty, price: i.price, gst: i.gst,
  }));
  const invoiceNo = await getNextInvoiceNo(tenantId, 'sale', 'sale_invoice');
  const dueDate = source.due_date || (() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  })();
  return saveInvoice(tenantId, {
    type: 'sale', document_kind: 'sale_invoice', invoice_no: invoiceNo,
    customer_id: source.customer_id, date: new Date().toISOString().split('T')[0], due_date: dueDate,
    status: 'unpaid', subtotal: source.subtotal, gst_amount: source.gst_amount,
    discount: source.discount || 0, round_off: source.round_off || 0,
    total: source.total, paid: 0, balance: source.total,
    notes: source.notes, reference_invoice_id: sourceInvoiceId,
  }, items);
}

export async function getPartyLedger(userId, partyId) {
  const tenantId = await getTenantId(userId);
  const { data: party } = await supabase.from('customers').select('*').eq('id', partyId).single();
  if (!party) throw new Error('Party not found');
  
  const { data: invoices } = await supabase.from('invoices').select('*')
    .eq('user_id', tenantId).eq('customer_id', partyId).order('date', { ascending: true });
    
  const { data: payments } = await supabase.from('invoice_payments').select('*, invoices(invoice_no)')
    .eq('user_id', tenantId).eq('customer_id', partyId).eq('status', 'active');
    
  let balance = 0;
  if (party.type === 'customer') {
    balance = party.opening_balance_type === 'Cr' ? -parseFloat(party.opening_balance || 0) : parseFloat(party.opening_balance || 0);
  } else {
    balance = party.opening_balance_type === 'Dr' ? -parseFloat(party.opening_balance || 0) : parseFloat(party.opening_balance || 0);
  }
  
  const entries = [];
  
  if (parseFloat(party.opening_balance || 0) !== 0) {
    entries.push({
      date: party.created_at ? party.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
      particulars: 'Opening Balance',
      ref: '—',
      debit: party.type === 'customer' ? (party.opening_balance_type === 'Dr' ? parseFloat(party.opening_balance) : 0) : (party.opening_balance_type === 'Dr' ? parseFloat(party.opening_balance) : 0),
      credit: party.type === 'customer' ? (party.opening_balance_type === 'Cr' ? parseFloat(party.opening_balance) : 0) : (party.opening_balance_type === 'Cr' ? parseFloat(party.opening_balance) : 0),
      balance
    });
  }

  const combined = [
    ...(invoices || []).map(inv => ({
      date: inv.date,
      created_at: inv.created_at,
      type: 'Invoice',
      ref: inv.invoice_no,
      document_kind: inv.document_kind,
      invoice_type: inv.type,
      amount: parseFloat(inv.total) || 0
    })),
    ...(payments || []).map(p => ({
      date: p.created_at.split('T')[0],
      created_at: p.created_at,
      type: 'Payment',
      ref: p.invoices?.invoice_no || null,
      invoice_type: null,
      amount: parseFloat(p.amount) || 0
    }))
  ].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  
  for (const item of combined) {
    let debit = 0;
    let credit = 0;
    let particulars = '';
    
    if (item.type === 'Invoice') {
      const isSupplier = item.invoice_type === 'purchase';
      if (!isSupplier) {
        if (item.document_kind === 'credit_note') {
          credit = item.amount;
          balance -= credit;
          particulars = 'Credit Note';
        } else if (item.document_kind === 'debit_note') {
          debit = item.amount;
          balance += debit;
          particulars = 'Debit Note';
        } else {
          debit = item.amount;
          balance += debit;
          particulars = 'Sales Invoice';
        }
      } else {
        if (item.document_kind === 'purchase_return') {
          debit = item.amount;
          balance -= debit;
          particulars = 'Purchase Return';
        } else if (item.document_kind === 'debit_note') {
          debit = item.amount;
          balance -= debit;
          particulars = 'Debit Note';
        } else {
          credit = item.amount;
          balance += credit;
          particulars = 'Purchase Bill';
        }
      }
    } else {
      particulars = item.ref ? `Payment (for ${item.ref})` : 'Advance Payment';
      if (party.type === 'customer') {
        credit = item.amount;
        balance -= credit;
      } else {
        debit = item.amount;
        balance -= debit;
      }
    }
    
    entries.push({
      date: item.date,
      particulars,
      ref: item.ref || '—',
      debit,
      credit,
      balance
    });
  }
  
  const outstanding = balance;
  return { party, invoices: invoices || [], payments, outstanding, entries };
}

export async function getCashBook(userId) {
  const tenantId = await getTenantId(userId);
  const { data, error } = await supabase
    .from('journal_items')
    .select('*, chart_of_accounts!inner(name), journal_entries:entry_id(entry_no, date, description, reference_type)')
    .eq('user_id', tenantId)
    .eq('chart_of_accounts.name', 'Cash Book');
  if (error) throw error;
  
  const entries = (data || []).map(item => ({
    date: item.journal_entries?.date || item.created_at?.split('T')[0],
    type: parseFloat(item.debit) > 0 ? 'in' : 'out',
    category: item.journal_entries?.reference_type || 'Manual Entry',
    ref: item.journal_entries?.entry_no || '—',
    party: item.journal_entries?.description || '—',
    amount: parseFloat(item.debit) > 0 ? parseFloat(item.debit) : parseFloat(item.credit),
    mode: 'Cash'
  })).sort((a, b) => new Date(b.date) - new Date(a.date));

  const totalIn = entries.filter((e) => e.type === 'in').reduce((s, e) => s + e.amount, 0);
  const totalOut = entries.filter((e) => e.type === 'out').reduce((s, e) => s + e.amount, 0);
  return { entries, totalIn, totalOut, balance: totalIn - totalOut };
}

export async function getBankBook(userId) {
  const tenantId = await getTenantId(userId);
  const { data, error } = await supabase
    .from('journal_items')
    .select('*, chart_of_accounts!inner(name), journal_entries:entry_id(entry_no, date, description, reference_type)')
    .eq('user_id', tenantId)
    .eq('chart_of_accounts.name', 'Bank Account');
  if (error) throw error;
  
  const entries = (data || []).map(item => ({
    date: item.journal_entries?.date || item.created_at?.split('T')[0],
    type: parseFloat(item.debit) > 0 ? 'in' : 'out',
    category: item.journal_entries?.reference_type || 'Manual Entry',
    ref: item.journal_entries?.entry_no || '—',
    party: item.journal_entries?.description || '—',
    amount: parseFloat(item.debit) > 0 ? parseFloat(item.debit) : parseFloat(item.credit),
    mode: 'Bank/UPI'
  })).sort((a, b) => new Date(b.date) - new Date(a.date));

  const totalIn = entries.filter((e) => e.type === 'in').reduce((s, e) => s + e.amount, 0);
  const totalOut = entries.filter((e) => e.type === 'out').reduce((s, e) => s + e.amount, 0);
  return { entries, totalIn, totalOut, balance: totalIn - totalOut };
}

export async function getTrialBalance(userId, fromDate, toDate) {
  const tenantId = await getTenantId(userId);
  
  // 1. Fetch COA to initialize map
  const { data: coaData, error: coaErr } = await supabase
    .from('chart_of_accounts')
    .select('id, name, code, type')
    .eq('user_id', tenantId);
    
  if (coaErr) throw coaErr;
  
  const accountsMap = {};
  (coaData || []).forEach(acc => {
    accountsMap[acc.id] = {
      id: acc.id,
      code: acc.code,
      name: acc.name,
      type: acc.type,
      debitSum: 0,
      creditSum: 0,
      debitBalance: 0,
      creditBalance: 0
    };
  });
  
  // 2. Fetch journal items
  let query = supabase
    .from('journal_items')
    .select('debit, credit, account_id, chart_of_accounts!inner(name, code, type), journal_entries!inner(date)')
    .eq('user_id', tenantId);
    
  if (fromDate) query = query.gte('journal_entries.date', fromDate);
  if (toDate) query = query.lte('journal_entries.date', toDate);
  
  const { data, error } = await query;
  if (error) throw error;
  
  // Accumulate
  (data || []).forEach(item => {
    const accId = item.account_id;
    if (accountsMap[accId]) {
      accountsMap[accId].debitSum += parseFloat(item.debit || 0);
      accountsMap[accId].creditSum += parseFloat(item.credit || 0);
    }
  });
  
  // Calculate Net Balances
  const accounts = Object.values(accountsMap).map(acc => {
    const netDiff = acc.debitSum - acc.creditSum;
    if (netDiff > 0) {
      acc.debitBalance = netDiff;
      acc.creditBalance = 0;
    } else if (netDiff < 0) {
      acc.debitBalance = 0;
      acc.creditBalance = -netDiff;
    } else {
      acc.debitBalance = 0;
      acc.creditBalance = 0;
    }
    return acc;
  }).filter(acc => acc.debitSum > 0 || acc.creditSum > 0 || acc.name === 'Cash Book' || acc.name === 'Bank Account');
  
  let totalDebitsBalance = 0;
  let totalCreditsBalance = 0;
  accounts.forEach(acc => {
    totalDebitsBalance += acc.debitBalance;
    totalCreditsBalance += acc.creditBalance;
  });
  
  return {
    accounts: accounts.sort((a, b) => a.code.localeCompare(b.code)),
    totalDebits: totalDebitsBalance,
    totalCredits: totalCreditsBalance,
    isBalanced: Math.abs(totalDebitsBalance - totalCreditsBalance) < 0.05
  };
}

export async function getBalanceSheetData(userId, toDate) {
  const tenantId = await getTenantId(userId);
  
  let glQuery = supabase
    .from('journal_items')
    .select('debit, credit, chart_of_accounts!inner(name, type), journal_entries!inner(date)')
    .eq('user_id', tenantId);
    
  if (toDate) glQuery = glQuery.lte('journal_entries.date', toDate);
  
  const { data: glItems, error: glErr } = await glQuery;
  if (glErr) throw glErr;
  
  let receivables = 0;
  let payables = 0;
  let inventoryValue = 0;
  let cash = 0;
  let bank = 0;
  let cgstInput = 0;
  let sgstInput = 0;
  let igstInput = 0;
  let cgstOutput = 0;
  let sgstOutput = 0;
  let igstOutput = 0;
  let openingBalanceEquity = 0;
  let retainedEarnings = 0;
  
  let tempRevenue = 0;
  let tempExpense = 0;

  (glItems || []).forEach(item => {
    const coa = item.chart_of_accounts;
    const debit = parseFloat(item.debit || 0);
    const credit = parseFloat(item.credit || 0);
    
    if (coa.type === 'asset') {
      if (coa.name === 'Accounts Receivable') receivables += (debit - credit);
      else if (coa.name === 'Inventory Asset') inventoryValue += (debit - credit);
      else if (coa.name === 'Cash Book') cash += (debit - credit);
      else if (coa.name === 'Bank Account') bank += (debit - credit);
      else if (coa.name === 'CGST Input Tax') cgstInput += (debit - credit);
      else if (coa.name === 'SGST Input Tax') sgstInput += (debit - credit);
      else if (coa.name === 'IGST Input Tax') igstInput += (debit - credit);
    } else if (coa.type === 'liability') {
      if (coa.name === 'Accounts Payable') payables += (credit - debit);
      else if (coa.name === 'CGST Output Tax') cgstOutput += (credit - debit);
      else if (coa.name === 'SGST Output Tax') sgstOutput += (credit - debit);
      else if (coa.name === 'IGST Output Tax') igstOutput += (credit - debit);
    } else if (coa.type === 'equity') {
      if (coa.name === 'Opening Balance Equity') openingBalanceEquity += (credit - debit);
      else if (coa.name === 'Retained Earnings') retainedEarnings += (credit - debit);
    } else if (coa.type === 'revenue') {
      tempRevenue += (credit - debit);
    } else if (coa.type === 'expense') {
      tempExpense += (debit - credit);
    }
  });

  retainedEarnings += (tempRevenue - tempExpense);

  const gstInputTotal = cgstInput + sgstInput + igstInput;
  const gstOutputTotal = cgstOutput + sgstOutput + igstOutput;

  return {
    receivables,
    payables,
    inventoryValue,
    cash,
    bank,
    cgstInput, sgstInput, igstInput, gstInputTotal,
    cgstOutput, sgstOutput, igstOutput, gstOutputTotal,
    openingBalanceEquity,
    retainedEarnings,
    totalAssets: receivables + inventoryValue + cash + bank + gstInputTotal,
    totalLiabilities: payables + gstOutputTotal,
    equity: openingBalanceEquity + retainedEarnings,
    totalLiabilitiesAndEquity: payables + gstOutputTotal + openingBalanceEquity + retainedEarnings
  };
}

export async function getCashFlowStatement(userId, fromDate, toDate) {
  const tenantId = await getTenantId(userId);
  
  let glQuery = supabase
    .from('journal_items')
    .select('debit, credit, chart_of_accounts!inner(name), journal_entries!inner(date, reference_type)')
    .eq('user_id', tenantId);
    
  if (fromDate) glQuery = glQuery.gte('journal_entries.date', fromDate);
  if (toDate) glQuery = glQuery.lte('journal_entries.date', toDate);
  
  const { data: glItems, error: glErr } = await glQuery;
  if (glErr) throw glErr;
  
  const cashBankEntries = (glItems || []).filter(item => 
    item.chart_of_accounts.name === 'Cash Book' || 
    item.chart_of_accounts.name === 'Bank Account'
  );
  
  let customerReceipts = 0;
  let supplierPayments = 0;
  let operatingExpenses = 0;
  let otherInflows = 0;
  let otherOutflows = 0;
  
  cashBankEntries.forEach(item => {
    const debit = parseFloat(item.debit || 0);
    const credit = parseFloat(item.credit || 0);
    const refType = item.journal_entries?.reference_type;
    
    if (debit > 0) {
      if (refType === 'payment' || refType === 'invoice') {
        customerReceipts += debit;
      } else {
        otherInflows += debit;
      }
    } else if (credit > 0) {
      if (refType === 'payment' || refType === 'invoice') {
        supplierPayments += credit;
      } else if (refType === 'expense') {
        operatingExpenses += credit;
      } else {
        otherOutflows += credit;
      }
    }
  });
  
  const netOperatingCash = customerReceipts - supplierPayments - operatingExpenses;
  const netOtherCash = otherInflows - otherOutflows;
  
  return {
    customerReceipts,
    supplierPayments,
    operatingExpenses,
    otherInflows,
    otherOutflows,
    netOperatingCash,
    netOtherCash,
    netIncrease: netOperatingCash + netOtherCash
  };
}

export async function reversePayment(paymentId, reason) {
  const user = await verifyWritePermission('update', 'invoice_payments', paymentId);
  const { data, error } = await supabase
    .from('invoice_payments')
    .update({ 
      status: 'reversed', 
      reversal_reason: reason || 'Transaction Cancelled' 
    })
    .eq('id', paymentId)
    .select()
    .single();
  if (error) throw error;
  
  await supabase.from('audit_logs').insert([{
    user_id: user.id,
    action: 'update',
    entity_type: 'invoice_payments',
    entity_id: paymentId,
    details: { reversal: true, reason }
  }]);
  const tId = await getTenantId(user.id);
  invalidateDashboardCache(tId);
  return data;
}

export async function getDayBook(userId, dateStr) {
  const tenantId = await getTenantId(userId);
  const targetDate = dateStr || new Date().toISOString().split('T')[0];
  
  const [invoicesRes, paymentsRes, expensesRes] = await Promise.all([
    supabase.from('invoices').select('*, customers(name)').eq('user_id', tenantId).eq('date', targetDate),
    supabase.from('invoice_payments').select('*, invoices(invoice_no, customers(name))').eq('user_id', tenantId).gte('created_at', `${targetDate}T00:00:00`).lte('created_at', `${targetDate}T23:59:59`),
    supabase.from('expenses').select('*').eq('user_id', tenantId).eq('date', targetDate)
  ]);
  
  const entries = [
    ...(invoicesRes.data || []).map(inv => ({
      time: inv.created_at,
      type: 'Invoice',
      ref: inv.invoice_no,
      party: inv.customers?.name || 'Walk-in',
      amount: inv.total,
      detail: inv.document_kind.replace('_', ' ').toUpperCase(),
      flow: inv.type === 'sale' ? 'in' : 'out'
    })),
    ...(paymentsRes.data || []).map(p => ({
      time: p.created_at,
      type: 'Payment',
      ref: p.invoices?.invoice_no || '—',
      party: p.invoices?.customers?.name || '—',
      amount: p.amount,
      detail: `Received via ${p.payment_mode}`,
      flow: 'in'
    })),
    ...(expensesRes.data || []).map(e => ({
      time: e.created_at,
      type: 'Expense',
      ref: '—',
      party: e.description || '—',
      amount: e.amount,
      detail: e.category,
      flow: 'out'
    }))
  ].sort((a, b) => new Date(a.time) - new Date(b.time));
  
  return entries;
}

export async function getGstr1Summary(userId, fromDate, toDate) {
  const tenantId = await getTenantId(userId);
  let query = supabase.from('invoices').select('*, invoice_items(*), customers(name, gstin, state)')
    .eq('user_id', tenantId).eq('type', 'sale').eq('document_kind', 'sale_invoice');
  if (fromDate) query = query.gte('date', fromDate);
  if (toDate) query = query.lte('date', toDate);
  const { data, error } = await query.order('date');
  if (error) throw error;
  return data || [];
}

export async function deleteTeamInvite(id) {
  const user = await verifyWritePermission('delete', 'team_invites', id);
  const { error } = await supabase.from('team_invites').delete().eq('id', id);
  if (error) throw error;
  await supabase.from('audit_logs').insert([{
    user_id: user.id,
    action: 'delete',
    entity_type: 'team_invites',
    entity_id: id
  }]);
}

export async function getPartyStats(userId) {
  const tenantId = await getTenantId(userId);
  
  const [invoicesRes, paymentsRes, partiesRes] = await Promise.all([
    supabase.from('invoices').select('customer_id, total, paid, type, document_kind').eq('user_id', tenantId),
    supabase.from('invoice_payments').select('customer_id, amount').eq('user_id', tenantId).eq('status', 'active'),
    supabase.from('customers').select('id, type, opening_balance, opening_balance_type').eq('user_id', tenantId)
  ]);

  const invoices = invoicesRes.data || [];
  const payments = paymentsRes.data || [];
  const parties = partiesRes.data || [];

  const stats = {};

  for (const party of parties) {
    let outstanding = 0;
    if (party.type === 'customer') {
      outstanding = party.opening_balance_type === 'Cr' ? -parseFloat(party.opening_balance || 0) : parseFloat(party.opening_balance || 0);
    } else {
      outstanding = party.opening_balance_type === 'Dr' ? -parseFloat(party.opening_balance || 0) : parseFloat(party.opening_balance || 0);
    }

    stats[party.id] = {
      count: 0,
      total: 0,
      outstanding
    };
  }

  for (const inv of invoices) {
    if (!inv.customer_id) continue;
    if (!stats[inv.customer_id]) {
      stats[inv.customer_id] = { count: 0, total: 0, outstanding: 0 };
    }

    stats[inv.customer_id].count += 1;
    stats[inv.customer_id].total += parseFloat(inv.total || 0);

    const amt = parseFloat(inv.total || 0);
    const isSupplier = inv.type === 'purchase';
    if (!isSupplier) {
      if (inv.document_kind === 'credit_note') {
        stats[inv.customer_id].outstanding -= amt;
      } else {
        stats[inv.customer_id].outstanding += amt;
      }
    } else {
      if (inv.document_kind === 'purchase_return' || inv.document_kind === 'debit_note') {
        stats[inv.customer_id].outstanding -= amt;
      } else {
        stats[inv.customer_id].outstanding += amt;
      }
    }
  }

  for (const pay of payments) {
    if (!pay.customer_id) continue;
    if (!stats[pay.customer_id]) {
      stats[pay.customer_id] = { count: 0, total: 0, outstanding: 0 };
    }
    stats[pay.customer_id].outstanding -= parseFloat(pay.amount || 0);
  }

  return stats;
}

export async function getStockAdjustments(userId) {
  const tenantId = await getTenantId(userId);
  const { data, error } = await supabase
    .from('stock_adjustments')
    .select('*, products(name, unit, purchase_price, sale_price)')
    .eq('user_id', tenantId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createStockAdjustment(userId, adj) {
  const user = await verifyWritePermission('create', 'stock_adjustments');
  const tenantId = await getTenantId(userId);
  
  const { data, error } = await supabase
    .from('stock_adjustments')
    .insert([{
      user_id: tenantId,
      product_id: adj.product_id,
      qty: parseFloat(adj.qty),
      reason: adj.reason,
      warehouse_id: adj.warehouse_id || null
    }])
    .select()
    .single();
    
  if (error) throw error;
  
  await supabase.from('audit_logs').insert([{
    user_id: user.id,
    action: 'create',
    entity_type: 'stock_adjustments',
    entity_id: data.id,
    details: { product_id: adj.product_id, qty: adj.qty }
  }]);
  invalidateDashboardCache(tenantId);
  return data;
}

export async function getStockTransfers(userId) {
  const tenantId = await getTenantId(userId);
  const { data, error } = await supabase
    .from('stock_transfers')
    .select('*, products(name, unit)')
    .eq('user_id', tenantId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createStockTransfer(userId, transfer) {
  const user = await verifyWritePermission('create', 'stock_transfers');
  const tenantId = await getTenantId(userId);
  
  const { data, error } = await supabase
    .from('stock_transfers')
    .insert([{
      user_id: tenantId,
      product_id: transfer.product_id,
      from_location: transfer.from_location,
      to_location: transfer.to_location,
      qty: parseFloat(transfer.qty),
      from_warehouse_id: transfer.from_warehouse_id || null,
      to_warehouse_id: transfer.to_warehouse_id || null
    }])
    .select()
    .single();
    
  if (error) throw error;
  
  await supabase.from('audit_logs').insert([{
    user_id: user.id,
    action: 'create',
    entity_type: 'stock_transfers',
    entity_id: data.id,
    details: { product_id: transfer.product_id, qty: transfer.qty }
  }]);
  invalidateDashboardCache(tenantId);
  return data;
}

export async function getInventoryValuation(userId) {
  const tenantId = await getTenantId(userId);
  const { data, error } = await supabase
    .from('products')
    .select('stock, purchase_price, sale_price')
    .eq('user_id', tenantId);
  if (error) throw error;
  
  const totalPurchaseValue = (data || []).reduce((sum, p) => sum + ((parseFloat(p.stock) || 0) * (parseFloat(p.purchase_price) || 0)), 0);
  const totalSaleValue = (data || []).reduce((sum, p) => sum + ((parseFloat(p.stock) || 0) * (parseFloat(p.sale_price) || 0)), 0);
  
  return {
    totalPurchaseValue,
    totalSaleValue,
    totalItems: (data || []).length
  };
}

export async function backupBusinessData(userId) {
  const tenantId = await getTenantId(userId);
  
  const [profile, customers, products, invoices, invoice_items, invoice_payments, expenses, recurring_invoices, payment_reminders, stock_alerts] = await Promise.all([
    supabase.from('business_profile').select('*').eq('user_id', tenantId).maybeSingle(),
    supabase.from('customers').select('*').eq('user_id', tenantId),
    supabase.from('products').select('*').eq('user_id', tenantId),
    supabase.from('invoices').select('*').eq('user_id', tenantId),
    supabase.from('invoice_items').select('*').eq('user_id', tenantId),
    supabase.from('invoice_payments').select('*').eq('user_id', tenantId),
    supabase.from('expenses').select('*').eq('user_id', tenantId),
    supabase.from('recurring_invoices').select('*').eq('user_id', tenantId),
    supabase.from('payment_reminders').select('*').eq('user_id', tenantId),
    supabase.from('stock_alerts').select('*').eq('user_id', tenantId),
  ]);

  return {
    version: '1.0.0',
    backup_date: new Date().toISOString(),
    business_profile: profile.data || null,
    customers: customers.data || [],
    products: products.data || [],
    invoices: invoices.data || [],
    invoice_items: invoice_items.data || [],
    invoice_payments: invoice_payments.data || [],
    expenses: expenses.data || [],
    recurring_invoices: recurring_invoices.data || [],
    payment_reminders: payment_reminders.data || [],
    stock_alerts: stock_alerts.data || [],
  };
}

export async function restoreBusinessData(userId, backup) {
  const user = await verifyWritePermission('create', 'business_profile');
  const tenantId = await getTenantId(userId);
  
  if (!backup || typeof backup !== 'object') throw new Error('Invalid backup file');
  
  await Promise.all([
    supabase.from('invoices').delete().eq('user_id', tenantId),
    supabase.from('products').delete().eq('user_id', tenantId),
    supabase.from('customers').delete().eq('user_id', tenantId),
    supabase.from('expenses').delete().eq('user_id', tenantId),
    supabase.from('recurring_invoices').delete().eq('user_id', tenantId),
    supabase.from('payment_reminders').delete().eq('user_id', tenantId),
    supabase.from('stock_alerts').delete().eq('user_id', tenantId),
  ]);

  if (backup.business_profile) {
    const cleanProfile = { ...backup.business_profile, user_id: tenantId };
    delete cleanProfile.id;
    await supabase.from('business_profile').upsert([cleanProfile], { onConflict: 'user_id' });
  }

  if (backup.customers && backup.customers.length > 0) {
    const rows = backup.customers.map(c => ({ ...c, user_id: tenantId }));
    await supabase.from('customers').insert(rows);
  }

  if (backup.products && backup.products.length > 0) {
    const rows = backup.products.map(p => ({ ...p, user_id: tenantId }));
    await supabase.from('products').insert(rows);
  }

  if (backup.invoices && backup.invoices.length > 0) {
    const rows = backup.invoices.map(i => ({ ...i, user_id: tenantId }));
    await supabase.from('invoices').insert(rows);
  }

  if (backup.invoice_items && backup.invoice_items.length > 0) {
    const rows = backup.invoice_items.map(ii => ({ ...ii, user_id: tenantId }));
    await supabase.from('invoice_items').insert(rows);
  }

  if (backup.invoice_payments && backup.invoice_payments.length > 0) {
    const rows = backup.invoice_payments.map(ip => ({ ...ip, user_id: tenantId }));
    await supabase.from('invoice_payments').insert(rows);
  }

  if (backup.expenses && backup.expenses.length > 0) {
    const rows = backup.expenses.map(e => ({ ...e, user_id: tenantId }));
    await supabase.from('expenses').insert(rows);
  }

  if (backup.recurring_invoices && backup.recurring_invoices.length > 0) {
    const rows = backup.recurring_invoices.map(r => ({ ...r, user_id: tenantId }));
    await supabase.from('recurring_invoices').insert(rows);
  }

  if (backup.payment_reminders && backup.payment_reminders.length > 0) {
    const rows = backup.payment_reminders.map(r => ({ ...r, user_id: tenantId }));
    await supabase.from('payment_reminders').insert(rows);
  }

  if (backup.stock_alerts && backup.stock_alerts.length > 0) {
    const rows = backup.stock_alerts.map(s => ({ ...s, user_id: tenantId }));
    await supabase.from('stock_alerts').insert(rows);
  }

  await supabase.from('audit_logs').insert([{
    user_id: user.id,
    action: 'update',
    entity_type: 'business_profile',
    entity_id: null,
    details: { type: 'database_restore' }
  }]);

  return { success: true };
}

// ─── WAREHOUSE ENGINE ────────────────────────────────────────────
export async function getWarehouses(userId) {
  const tenantId = await getTenantId(userId);
  const { data, error } = await supabase
    .from('warehouses')
    .select('*')
    .eq('user_id', tenantId)
    .order('name');
  if (error) throw error;
  return data || [];
}

export async function createWarehouse(userId, wh) {
  const user = await verifyWritePermission('create', 'warehouses');
  const tenantId = await getTenantId(userId);
  const { data, error } = await supabase
    .from('warehouses')
    .insert([{
      user_id: tenantId,
      name: wh.name,
      code: wh.code || null,
      address: wh.address || null
    }])
    .select()
    .single();
  if (error) throw error;

  await supabase.from('audit_logs').insert([{
    user_id: user.id,
    action: 'create',
    entity_type: 'warehouses',
    entity_id: data.id,
    details: { name: wh.name }
  }]);
  return data;
}

export async function deleteWarehouse(id) {
  const user = await verifyWritePermission('delete', 'warehouses', id);
  const { error } = await supabase.from('warehouses').delete().eq('id', id);
  if (error) throw error;

  await supabase.from('audit_logs').insert([{
    user_id: user.id,
    action: 'delete',
    entity_type: 'warehouses',
    entity_id: id
  }]);
}

export async function getWarehouseStocks(userId) {
  const tenantId = await getTenantId(userId);
  const { data, error } = await supabase
    .from('warehouse_stocks')
    .select('*, warehouses(name), products(name, unit, stock)')
    .eq('user_id', tenantId);
  if (error) throw error;
  return data || [];
}

export async function getWarehouseStocksForProduct(productId) {
  const { data, error } = await supabase
    .from('warehouse_stocks')
    .select('*, warehouses(name)')
    .eq('product_id', productId);
  if (error) throw error;
  return data || [];
}

// ─── JOURNAL ENTRY ENGINE ────────────────────────────────────────
export async function getChartOfAccounts(userId) {
  const tenantId = await getTenantId(userId);
  const { data, error } = await supabase
    .from('chart_of_accounts')
    .select('*')
    .eq('user_id', tenantId)
    .order('code', { ascending: true });
  if (error) throw error;
  return data || [];
}

// ─── JOURNAL ENTRY ENGINE ────────────────────────────────────────
export async function getJournalEntries(userId, page = null, limit = null) {
  const tenantId = await getTenantId(userId);
  let query = supabase
    .from('journal_entries')
    .select('*, journal_items(*, chart_of_accounts(name))', { count: 'exact' })
    .eq('user_id', tenantId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });
    
  if (page && limit) {
    query = query.range((page - 1) * limit, page * limit - 1);
  }
  
  const { data, error, count } = await query;
  if (error) throw error;
  const result = data || [];
  result.totalCount = count || 0;
  return result;
}

export async function createManualJournalEntry(userId, entry, items) {
  const user = await verifyWritePermission('create', 'journal_entries');
  const tenantId = await getTenantId(userId);

  // Validate debits sum matches credits sum
  const totalDebit = items.reduce((sum, item) => sum + (parseFloat(item.debit) || 0), 0);
  const totalCredit = items.reduce((sum, item) => sum + (parseFloat(item.credit) || 0), 0);

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error(`Double-entry rule violation: Total debits (${totalDebit}) must equal total credits (${totalCredit}).`);
  }

  // 1. Insert header
  const { data: je, error: jeErr } = await supabase
    .from('journal_entries')
    .insert([{
      user_id: tenantId,
      entry_no: entry.entry_no || ('JV-MAN-' + Date.now().toString().slice(-6)),
      date: entry.date,
      description: entry.description,
      reference_type: 'manual'
    }])
    .select()
    .single();

  if (jeErr) throw jeErr;

  // Resolve COA names for backward compatibility in account_name
  const { data: coas } = await supabase
    .from('chart_of_accounts')
    .select('id, name')
    .eq('user_id', tenantId);
    
  const coaMap = {};
  (coas || []).forEach(c => coaMap[c.id] = c.name);

  // 2. Insert items
  const itemRows = items.map(item => ({
    user_id: tenantId,
    entry_id: je.id,
    account_id: item.account_id,
    account_name: coaMap[item.account_id] || 'Unknown Account',
    debit: parseFloat(item.debit) || 0,
    credit: parseFloat(item.credit) || 0
  }));

  const { error: itemsErr } = await supabase
    .from('journal_items')
    .insert(itemRows);

  if (itemsErr) {
    // Attempt rollback of the header manually
    await supabase.from('journal_entries').delete().eq('id', je.id);
    throw itemsErr;
  }

  await supabase.from('audit_logs').insert([{
    user_id: user.id,
    action: 'create',
    entity_type: 'journal_entries',
    entity_id: je.id,
    details: { entry_no: je.entry_no, total: totalDebit }
  }]);
  invalidateDashboardCache(tenantId);
  return { ...je, journal_items: itemRows };
}

// ─── TEAM CUSTOM ROLES & PERMISSIONS MATRIX ──────────────────────
export async function getCustomRoles(userId) {
  const tenantId = await getTenantId(userId);
  const { data, error } = await supabase
    .from('custom_roles')
    .select('*, custom_permissions(*)')
    .eq('user_id', tenantId);
  if (error) throw error;
  return data || [];
}

export async function createCustomRole(userId, name, modulePermissions) {
  const user = await verifyWritePermission('create', 'custom_roles');
  const tenantId = await getTenantId(userId);

  // 1. Create the role
  const { data: role, error: roleErr } = await supabase
    .from('custom_roles')
    .insert([{ user_id: tenantId, name }])
    .select()
    .single();
  if (roleErr) throw roleErr;

  // 2. Create the permissions rows
  const permissionRows = Object.entries(modulePermissions).map(([mod, perms]) => ({
    user_id: tenantId,
    role_id: role.id,
    module_name: mod,
    can_read: !!perms.can_read,
    can_write: !!perms.can_write,
    can_delete: !!perms.can_delete
  }));

  const { error: permErr } = await supabase
    .from('custom_permissions')
    .insert(permissionRows);

  if (permErr) {
    await supabase.from('custom_roles').delete().eq('id', role.id);
    throw permErr;
  }

  await supabase.from('audit_logs').insert([{
    user_id: user.id,
    action: 'create',
    entity_type: 'custom_roles',
    entity_id: role.id,
    details: { name }
  }]);

  return { ...role, custom_permissions: permissionRows };
}

export async function deleteCustomRole(id) {
  const user = await verifyWritePermission('delete', 'custom_roles', id);
  const { error } = await supabase.from('custom_roles').delete().eq('id', id);
  if (error) throw error;

  await supabase.from('audit_logs').insert([{
    user_id: user.id,
    action: 'delete',
    entity_type: 'custom_roles',
    entity_id: id
  }]);
}

export async function updateCustomRolePermissions(roleId, userId, modulePermissions) {
  const user = await verifyWritePermission('update', 'custom_roles', roleId);
  const tenantId = await getTenantId(userId);

  for (const [mod, perms] of Object.entries(modulePermissions)) {
    await supabase
      .from('custom_permissions')
      .upsert({
        user_id: tenantId,
        role_id: roleId,
        module_name: mod,
        can_read: !!perms.can_read,
        can_write: !!perms.can_write,
        can_delete: !!perms.can_delete
      }, { onConflict: 'role_id,module_name' });
  }

  await supabase.from('audit_logs').insert([{
    user_id: user.id,
    action: 'update',
    entity_type: 'custom_roles',
    entity_id: roleId,
    details: { action: 'update_permissions' }
  }]);
}

export async function updateUserCustomRole(targetUserId, customRoleId) {
  const user = await verifyWritePermission('update', 'user_roles');
  
  const roleName = customRoleId ? 'custom' : 'admin';
  const { error } = await supabase
    .from('user_roles')
    .update({ custom_role_id: customRoleId || null, role: roleName })
    .eq('user_id', targetUserId);

  if (error) throw error;

  await supabase.from('audit_logs').insert([{
    user_id: user.id,
    action: 'update',
    entity_type: 'user_roles',
    entity_id: targetUserId,
    details: { custom_role_id: customRoleId }
  }]);
}

// ─── SMART MIGRATION ENGINE ──────────────────────────────────────
export async function getMigrationJobs(userId) {
  const tenantId = await getTenantId(userId);
  const { data, error } = await supabase
    .from('migration_jobs')
    .select('*')
    .eq('user_id', tenantId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function rollbackMigrationJob(jobId) {
  const user = await verifyWritePermission('delete', 'migration_jobs', jobId);
  const { data, error } = await supabase.rpc('rollback_migration_job', { job_uuid: jobId });
  if (error) throw error;

  await supabase.from('audit_logs').insert([{
    user_id: user.id,
    action: 'delete',
    entity_type: 'migration_jobs',
    entity_id: jobId,
    details: { rolled_back: true, response: data }
  }]);

  return data;
}
