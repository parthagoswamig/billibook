import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import PageSection from './PageSection';
import SimpleTable from './SimpleTable';
import Pagination from './Pagination';
import { useUser } from '../lib/useUser';
import { useBusiness } from '../lib/BusinessContext';
import { useRole } from '../lib/RoleContext';
import { DOCUMENT_KINDS, getInvoices, getParties, getProducts, getNextInvoiceNo, saveInvoice, getProfile, addParty, getWarehouses } from '../lib/db';
import { calcInvoiceTotals, formatCurrency, formatDate, exportToCSV, addDays } from '../lib/utils';
import { supabase } from '../db';

const INDIAN_STATES = [
  "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar",
  "Chandigarh", "Chhattisgarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa",
  "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka",
  "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya",
  "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim",
  "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal"
];

const UNITS = ['Pcs', 'Box', 'Kg', 'Ltr', 'Mtr', 'Bag', 'Doz', 'Pack', 'Set', 'Ton', 'Exempt'];

function InvoiceListPage({ documentKind = 'sale_invoice' }) {
  const cfg = DOCUMENT_KINDS[documentKind] || DOCUMENT_KINDS.sale_invoice;
  const navigate = useNavigate();
  const location = useLocation();
  const { userId, loading: userLoading } = useUser();
  const { profile, currency } = useBusiness();
  const { canCreate, tenantId } = useRole();
  const [invoices, setInvoices] = useState([]);
  const [parties, setParties] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 50;
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const handler = setTimeout(() => {
      setSearch(searchTerm);
      setPage(1);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchTerm]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [warehouses, setWarehouses] = useState([]);
  const [form, setForm] = useState({
    invoiceNo: '',
    customerId: '',
    warehouseId: '',
    date: new Date().toISOString().split('T')[0],
    dueDate: '',
    notes: '',
    discount: 0,
    roundOff: 0,
    shippingCharges: 0,
    stateOfSupply: '',
    autoRoundOff: true,
    paid: 0,
    paymentMode: 'Cash',
    items: [{ product_id: '', name: '', hsn: '', qty: 1, unit: 'Pcs', price: '', discount: 0, gst: 18 }],
  });

  // Inline Customer Creation States
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', gstin: '', address: '', state: '' });
  const [customerSaving, setCustomerSaving] = useState(false);
  const [customerError, setCustomerError] = useState('');

  const [activeSearchIdx, setActiveSearchIdx] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPartyOutstanding, setSelectedPartyOutstanding] = useState(0);

  const matchingProducts = (query) => {
    const q = (query || '').trim().toLowerCase();
    if (!q) return products.slice(0, 10);
    return products.filter(p => 
      p.name?.toLowerCase().includes(q) || 
      (p.hsn && p.hsn.toLowerCase().includes(q))
    ).slice(0, 10);
  };

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [hasDraft, setHasDraft] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (showModal) {
      const draft = localStorage.getItem(`invoice_draft_${documentKind}`);
      if (draft) {
        setHasDraft(true);
      } else {
        setHasDraft(false);
      }
    }
  }, [showModal, documentKind]);

  useEffect(() => {
    if (showModal) {
      localStorage.setItem(`invoice_draft_${documentKind}`, JSON.stringify(form));
    }
  }, [form, showModal, documentKind]);

  const loadDraft = () => {
    const draft = localStorage.getItem(`invoice_draft_${documentKind}`);
    if (draft) {
      try {
        setForm(JSON.parse(draft));
        setHasDraft(false);
      } catch (e) {
        console.error('Failed to parse draft', e);
      }
    }
  };

  const discardDraft = () => {
    localStorage.removeItem(`invoice_draft_${documentKind}`);
    setHasDraft(false);
  };

  const partyType = cfg.type === 'purchase' ? 'supplier' : 'customer';
  const partyLabel = partyType === 'supplier' ? 'Supplier' : 'Customer';
  const isPurchase = cfg.type === 'purchase';

  useEffect(() => {
    const loadDropdowns = async () => {
      if (!tenantId) return;
      try {
        const [pts, prods, whs] = await Promise.all([
          getParties(tenantId, partyType),
          getProducts(tenantId),
          getWarehouses(tenantId)
        ]);
        setParties(pts);
        setProducts(prods);
        setWarehouses(whs || []);
      } catch (err) {
        console.error('Failed to load static dropdown metadata', err);
      }
    };
    loadDropdowns();
  }, [tenantId, partyType]);

  const load = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const inv = await getInvoices(tenantId, cfg.type, documentKind, page, limit, search);
      setInvoices(inv);
      setTotalCount(inv.totalCount || 0);

      if (location.state?.openCreate && canCreate()) {
        navigate(location.pathname, { replace: true, state: {} });
        const businessProf = await getProfile(tenantId);
        const dueDays = businessProf?.default_due_days ?? 7;
        const nextNo = await getNextInvoiceNo(tenantId, cfg.type, documentKind);
        
        let currentParties = parties;
        let currentWarehouses = warehouses;
        if (currentParties.length === 0 || currentWarehouses.length === 0) {
          const [pts, whs] = await Promise.all([
            getParties(tenantId, partyType),
            getWarehouses(tenantId)
          ]);
          currentParties = pts;
          currentWarehouses = whs || [];
          setParties(pts);
          setWarehouses(currentWarehouses);
        }
        
        const firstParty = currentParties[0];
        setForm({
          invoiceNo: nextNo,
          customerId: firstParty?.id || '',
          warehouseId: currentWarehouses?.[0]?.id || '',
          date: new Date().toISOString().split('T')[0],
          dueDate: cfg.payment ? addDays(new Date().toISOString().split('T')[0], dueDays) : '',
          notes: '', discount: 0, roundOff: 0, shippingCharges: 0,
          stateOfSupply: firstParty?.state || businessProf?.state || 'Maharashtra',
          autoRoundOff: true, paid: 0, paymentMode: 'Cash',
          items: [{ product_id: '', name: '', hsn: '', qty: 1, unit: 'Pcs', price: '', discount: 0, gst: 18 }],
        });
        setShowModal(true);
        setError('');
      }
    } catch (err) {
      setError(err.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [tenantId, documentKind, page, search]);

  const openCreate = async () => {
    if (!tenantId) return;
    const businessProf = await getProfile(tenantId);
    const dueDays = businessProf?.default_due_days ?? 7;
    const nextNo = await getNextInvoiceNo(tenantId, cfg.type, documentKind);
    const firstParty = parties[0];
    setForm({
      invoiceNo: nextNo,
      customerId: firstParty?.id || '',
      warehouseId: warehouses?.[0]?.id || '',
      date: new Date().toISOString().split('T')[0],
      dueDate: cfg.payment ? addDays(new Date().toISOString().split('T')[0], dueDays) : '',
      notes: '', discount: 0, roundOff: 0, shippingCharges: 0,
      stateOfSupply: firstParty?.state || businessProf?.state || 'Maharashtra',
      autoRoundOff: true, paid: 0, paymentMode: 'Cash',
      items: [{ product_id: '', name: '', hsn: '', qty: 1, unit: 'Pcs', price: '', discount: 0, gst: 18 }],
    });
    setShowModal(true);
    setError('');
  };

  const updateItem = (idx, field, value) => {
    setForm((f) => {
      const items = [...f.items];
      items[idx] = { ...items[idx], [field]: value };
      if (field === 'product_id' && value) {
        const prod = products.find((p) => p.id === value);
        if (prod) {
          items[idx].name = prod.name;
          items[idx].hsn = prod.hsn || '';
          items[idx].price = isPurchase ? (prod.purchase_price || prod.sale_price) : (prod.sale_price || prod.purchase_price);
          items[idx].gst = prod.gst || 18;
          items[idx].unit = prod.unit || 'Pcs';
        }
      }
      return { ...f, items };
    });
  };

  const handleCustomerChange = async (customerId) => {
    const cust = parties.find(p => p.id === customerId);
    setForm(f => ({
      ...f,
      customerId,
      stateOfSupply: cust?.state || f.stateOfSupply || ''
    }));
    if (customerId && cust?.credit_limit > 0) {
      try {
        const { data: outstanding, error } = await supabase.rpc('get_customer_outstanding', { customer_uuid: customerId });
        if (!error) {
          setSelectedPartyOutstanding(parseFloat(outstanding) || 0);
        }
      } catch (err) {
        console.error('Failed to fetch customer balance', err);
      }
    } else {
      setSelectedPartyOutstanding(0);
    }
  };

  const handleAddCustomerSubmit = async (e) => {
    e.preventDefault();
    if (!newCustomer.name.trim()) return;
    if (!canCreate() || !tenantId) return;
    setCustomerSaving(true);
    setCustomerError('');
    try {
      const added = await addParty(tenantId, {
        name: newCustomer.name,
        phone: newCustomer.phone,
        gstin: newCustomer.gstin,
        address: newCustomer.address,
        state: newCustomer.state,
        type: partyType,
      });
      setParties(pts => [...pts, added]);
      setForm(f => ({
        ...f,
        customerId: added.id,
        stateOfSupply: added.state || f.stateOfSupply
      }));
      setShowAddCustomer(false);
      setNewCustomer({ name: '', phone: '', gstin: '', address: '', state: '' });
    } catch (err) {
      setCustomerError(err.message || 'Failed to add Customer');
    } finally {
      setCustomerSaving(false);
    }
  };

  // 1. Calculate raw total without roundOff
  const rawTotals = calcInvoiceTotals(
    form.items.filter((i) => i.qty && i.price).map((i) => ({ qty: i.qty, price: i.price, gst: i.gst, discount: i.discount })),
    form.discount, 0, form.shippingCharges,
  );
  
  // 2. Compute round off if enabled
  const finalRoundOff = form.autoRoundOff ? Math.round(rawTotals.total) - rawTotals.total : parseFloat(form.roundOff) || 0;
  
  // 3. Final totals including finalRoundOff
  const totals = {
    ...rawTotals,
    roundOff: finalRoundOff,
    total: rawTotals.total + finalRoundOff,
  };

  const handleSubmit = async (e, shouldPrint = false) => {
    if (e) e.preventDefault();
    if (!isOnline) {
      setError('⚠️ You are offline. Your active draft is saved locally, but you cannot save to the database until connectivity is restored.');
      return;
    }
    if (!tenantId || !canCreate()) return;
    setError('');
    const validItems = form.items.filter((i) => i.name && i.qty && i.price);
    if (!form.customerId || validItems.length === 0) {
      setError('Select a party and add at least one item');
      return;
    }
    const rawT = calcInvoiceTotals(
      validItems.map((i) => ({ qty: parseFloat(i.qty), price: parseFloat(i.price), gst: parseFloat(i.gst) || 0, discount: parseFloat(i.discount) || 0 })),
      form.discount, 0, form.shippingCharges,
    );
    const rOff = form.autoRoundOff ? Math.round(rawT.total) - rawT.total : parseFloat(form.roundOff) || 0;
    const finalTotal = rawT.total + rOff;
    const balanceVal = finalTotal - parseFloat(form.paid || 0);

    const cust = parties.find(p => p.id === form.customerId);
    if (cust && cust.credit_limit > 0) {
      const projected = selectedPartyOutstanding + finalTotal - parseFloat(form.paid || 0);
      if (projected > cust.credit_limit) {
        setError(`⚠️ Credit Limit Exceeded! Current Outstanding + New Balance is ${fmt(projected)}, which is greater than the limit of ${fmt(cust.credit_limit)}.`);
        return;
      }
    }

    try {
      const inv = await saveInvoice(tenantId, {
        type: cfg.type, document_kind: documentKind, invoice_no: form.invoiceNo,
        customer_id: form.customerId, date: form.date, due_date: form.dueDate || null,
        subtotal: rawT.subtotal, gst_amount: rawT.gstAmount, discount: parseFloat(form.discount) || 0, round_off: rOff,
        shipping_charges: parseFloat(form.shippingCharges) || 0,
        state_of_supply: form.stateOfSupply || null,
        total: finalTotal, paid: parseFloat(form.paid) || 0, balance: balanceVal, notes: form.notes,
        status: balanceVal <= 0 ? 'paid' : parseFloat(form.paid) > 0 ? 'partial' : 'unpaid',
        last_payment_mode: parseFloat(form.paid) > 0 ? form.paymentMode : null,
        warehouse_id: form.warehouseId || null,
      }, validItems.map((i) => ({
        product_id: i.product_id || null, name: i.name, hsn: i.hsn,
        qty: parseFloat(i.qty), price: parseFloat(i.price), gst: parseFloat(i.gst) || 0,
        unit: i.unit || 'Pcs', discount: parseFloat(i.discount) || 0,
        amount: (parseFloat(i.qty) * parseFloat(i.price)) * (1 - (parseFloat(i.discount) || 0) / 100),
      })));
      localStorage.removeItem(`invoice_draft_${documentKind}`);
      setShowModal(false);
      setMessage(`✓ ${inv.invoice_no} created`);
      setTimeout(() => setMessage(''), 3000);
      load();
      if (shouldPrint) {
        navigate(`${cfg.route}/${inv.id}`, { state: { autoPrint: true } });
      }
    } catch (err) {
      setError(err.message || 'Failed to create');
    }
  };

  const filtered = invoices;

  const fmt = (n) => formatCurrency(n, currency);

  return (
    <>
      {!isOnline && (
        <div style={{
          background: 'var(--danger-light)',
          color: '#B91C1C',
          padding: '12px 24px',
          borderBottom: '1px solid rgba(239, 68, 68, 0.2)',
          fontSize: '14px',
          fontWeight: '600',
          textAlign: 'center',
          zIndex: 1000,
          position: 'sticky',
          top: 0
        }}>
          ⚠️ You are currently offline. Active draft is being saved locally.
        </div>
      )}
      <PageSection
        eyebrow={cfg.type === 'purchase' ? 'Purchases' : 'Sales'}
        title={cfg.label}
        description={`Manage ${cfg.label.toLowerCase()} — GST line items, stock & export.`}
        actions={
          <>
            <input className="form-input search-input" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            <button className="secondary-button" type="button" onClick={() => exportToCSV(`${documentKind}.csv`, ['No', 'Party', 'Date', 'Total', 'Status'], filtered.map((i) => [i.invoice_no, i.customers?.name, i.date, i.total, i.status]))}>📥 CSV</button>
            {canCreate() && <button className="primary-button" type="button" onClick={openCreate}>+ Create</button>}
          </>
        }
      >
        {message && <p className="form-message form-success">{message}</p>}
        {error && !showModal && <p className="form-message form-error">{error}</p>}

        {loading || userLoading ? (
          <div className="empty-state">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">No {cfg.label.toLowerCase()} yet.</div>
        ) : (
          <>
            <SimpleTable
              columns={['Number', partyLabel, 'Amount', 'Status', 'Date']}
              rows={filtered.map((inv) => [inv.invoice_no, inv.customers?.name || '—', fmt(inv.total), inv.status, formatDate(inv.date)])}
              rowIds={filtered.map((inv) => inv.id)}
              onRowClick={(id) => navigate(`${cfg.route}/${id}`)}
            />
            <Pagination
              page={page}
              limit={limit}
              totalCount={totalCount}
              onChangePage={(p) => setPage(p)}
            />
          </>
        )}
      </PageSection>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content modal-extra-wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create {cfg.label}</h3>
              <button className="modal-close" type="button" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={(e) => handleSubmit(e, false)} className="modal-form">
              {hasDraft && (
                <div style={{
                  background: 'var(--accent-light)',
                  color: 'var(--accent-dark)',
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-sm)',
                  marginBottom: '16px',
                  fontSize: '13px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span>💡 Found an unsaved offline draft from a previous session.</span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button type="button" className="primary-button" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={loadDraft}>
                      Load Draft
                    </button>
                    <button type="button" className="secondary-button" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={discardDraft}>
                      Discard
                    </button>
                  </div>
                </div>
              )}
              {error && <p className="form-message form-error">{error}</p>}
              
              {/* Row 1: Invoice Details Section */}
              <div className="invoice-fields-grid">
                <div className="form-label">
                  <span>{partyLabel} *</span>
                  <div className="party-select-container">
                    <select 
                      className="form-input" 
                      value={form.customerId} 
                      onChange={(e) => handleCustomerChange(e.target.value)} 
                      required
                    >
                      <option value="">Select Party</option>
                      {parties.map((p) => <option key={p.id} value={p.id}>{p.name} {p.phone ? `(${p.phone})` : ''}</option>)}
                    </select>
                    {canCreate() && (
                      <button 
                        type="button" 
                        className="add-party-btn" 
                        onClick={() => setShowAddCustomer(true)}
                        title="Add New Party"
                      >
                        +
                      </button>
                    )}
                  </div>
                  {(() => {
                    const cust = parties.find(p => p.id === form.customerId);
                    if (cust && cust.credit_limit > 0) {
                      const projected = selectedPartyOutstanding + totals.total - parseFloat(form.paid || 0);
                      const isOver = projected > cust.credit_limit;
                      return (
                        <div style={{
                          fontSize: '11.5px',
                          marginTop: '6px',
                          color: isOver ? '#EF4444' : '#E2B714',
                          fontWeight: '600',
                          textAlign: 'left'
                        }}>
                          📢 Credit Limit: {fmt(cust.credit_limit)} | Outstanding: {fmt(selectedPartyOutstanding)} | Net Outstanding: {fmt(projected)}
                          {isOver && <span style={{ display: 'block', color: '#EF4444', fontWeight: '800', marginTop: '2px' }}>⚠️ Credit Limit Exceeded!</span>}
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>

                <label className="form-label">
                  <span>Invoice Number</span>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={form.invoiceNo} 
                    onChange={(e) => setForm({ ...form, invoiceNo: e.target.value })} 
                    required
                  />
                </label>

                <label className="form-label">
                  <span>Date</span>
                  <input 
                    type="date" 
                    className="form-input" 
                    value={form.date} 
                    onChange={(e) => setForm({ ...form, date: e.target.value })} 
                  />
                </label>

                {cfg.payment && (
                  <label className="form-label">
                    <span>Due Date</span>
                    <input 
                      type="date" 
                      className="form-input" 
                      value={form.dueDate} 
                      onChange={(e) => setForm({ ...form, dueDate: e.target.value })} 
                    />
                  </label>
                )}

                <label className="form-label">
                  <span>Warehouse</span>
                  <select 
                    className="form-input" 
                    value={form.warehouseId} 
                    onChange={(e) => setForm({ ...form, warehouseId: e.target.value })}
                  >
                    <option value="">Global / No Warehouse</option>
                    {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </label>

                <label className="form-label">
                  <span>State of Supply</span>
                  <select 
                    className="form-input" 
                    value={form.stateOfSupply} 
                    onChange={(e) => setForm({ ...form, stateOfSupply: e.target.value })}
                  >
                    <option value="">Select State</option>
                    {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
              </div>

              {/* Row 2: Line Items Tabular spreadsheet-style list */}
              <div className="line-items-section">
                <div className="section-header-row">
                  <h4>Items & Description</h4>
                  <button 
                    type="button" 
                    className="secondary-button" 
                    onClick={() => setForm((f) => ({ ...f, items: [...f.items, { product_id: '', name: '', hsn: '', qty: 1, unit: 'Pcs', price: '', discount: 0, gst: 18 }] }))}
                  >
                    + Add Item Row
                  </button>
                </div>
                
                <div className="spreadsheet-grid">
                  <table className="spreadsheet-table">
                    <thead>
                      <tr>
                        <th style={{ width: '3%' }}>#</th>
                        <th style={{ width: '22%' }}>Product Name</th>
                        <th style={{ width: '8%' }}>HSN</th>
                        <th style={{ width: '8%' }}>Qty</th>
                        <th style={{ width: '9%' }}>Unit</th>
                        <th style={{ width: '10%' }}>Price/Unit</th>
                        <th style={{ width: '8%' }}>Disc %</th>
                        <th style={{ width: '8%' }}>GST %</th>
                        <th style={{ width: '11%' }}>Taxable</th>
                        <th style={{ width: '11%' }}>Total</th>
                        <th style={{ width: '2%' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {form.items.map((item, idx) => {
                        const qty = parseFloat(item.qty) || 0;
                        const price = parseFloat(item.price) || 0;
                        const itemDisc = parseFloat(item.discount) || 0;
                        const gstRate = parseFloat(item.gst) || 0;
                        const base = qty * price;
                        const discAmt = base * (itemDisc / 100);
                        const taxable = base - discAmt;
                        const rowGst = taxable * (gstRate / 100);
                        const netRowAmount = taxable + rowGst;

                        return (
                          <tr key={idx}>
                            <td>{idx + 1}</td>
                            <td style={{ position: 'relative' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <input 
                                  className="spreadsheet-input" 
                                  placeholder="Type name or HSN to search..." 
                                  value={item.name} 
                                  onFocus={() => {
                                    setActiveSearchIdx(idx);
                                    setSearchQuery(item.name || '');
                                  }}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    updateItem(idx, 'name', val);
                                    setSearchQuery(val);
                                  }}
                                  required 
                                />
                                {item.product_id && (
                                  <span style={{ fontSize: '11px', color: '#10B981', fontWeight: '500', textAlign: 'left' }}>
                                    ✓ Linked to catalog product
                                  </span>
                                )}
                                {activeSearchIdx === idx && (
                                  <>
                                    <div 
                                      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 998 }} 
                                      onClick={() => setActiveSearchIdx(null)} 
                                    />
                                    <div style={{
                                      position: 'absolute',
                                      background: 'white',
                                      border: '1px solid #E2E8F0',
                                      borderRadius: '8px',
                                      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                                      zIndex: 999,
                                      left: 0,
                                      right: 0,
                                      maxHeight: '200px',
                                      overflowY: 'auto',
                                      marginTop: '34px'
                                    }}>
                                      {matchingProducts(searchQuery).length === 0 ? (
                                        <div style={{ padding: '8px 12px', color: '#94A3B8', fontSize: '12px' }}>
                                          No matching products (Custom item)
                                        </div>
                                      ) : (
                                        matchingProducts(searchQuery).map((p) => (
                                          <div
                                            key={p.id}
                                            onClick={() => {
                                              updateItem(idx, 'product_id', p.id);
                                              setActiveSearchIdx(null);
                                            }}
                                            style={{
                                              padding: '8px 12px',
                                              cursor: 'pointer',
                                              borderBottom: '1px solid #F1F5F9',
                                              fontSize: '13px',
                                              textAlign: 'left'
                                            }}
                                            onMouseEnter={(e) => e.target.style.background = '#F8FAFC'}
                                            onMouseLeave={(e) => e.target.style.background = 'transparent'}
                                          >
                                            <div style={{ fontWeight: '600', color: '#1E293B' }}>{p.name}</div>
                                            <div style={{ fontSize: '11px', color: '#64748B', display: 'flex', gap: '8px' }}>
                                              <span>HSN: {p.hsn || '—'}</span>
                                              <span>Stock: {p.is_service ? 'Service' : `${p.stock} ${p.unit}`}</span>
                                              <span style={{ marginLeft: 'auto', color: '#4F46E5', fontWeight: '500' }}>
                                                {fmt(isPurchase ? (p.purchase_price || p.sale_price) : (p.sale_price || p.purchase_price))}
                                              </span>
                                            </div>
                                          </div>
                                        ))
                                      )}
                                    </div>
                                  </>
                                )}
                              </div>
                            </td>
                            <td>
                              <input 
                                className="spreadsheet-input" 
                                placeholder="HSN" 
                                value={item.hsn} 
                                onChange={(e) => updateItem(idx, 'hsn', e.target.value)} 
                              />
                            </td>
                            <td>
                              <input 
                                className="spreadsheet-input" 
                                type="number" 
                                placeholder="Qty" 
                                value={item.qty} 
                                onChange={(e) => updateItem(idx, 'qty', e.target.value)} 
                                min="0.01" 
                                step="0.01" 
                                required 
                              />
                            </td>
                            <td>
                              <select 
                                className="spreadsheet-input" 
                                value={item.unit} 
                                onChange={(e) => updateItem(idx, 'unit', e.target.value)}
                              >
                                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                              </select>
                            </td>
                            <td>
                              <input 
                                className="spreadsheet-input" 
                                type="number" 
                                placeholder="Price" 
                                value={item.price} 
                                onChange={(e) => updateItem(idx, 'price', e.target.value)} 
                                min="0" 
                                step="0.01" 
                                required 
                              />
                            </td>
                            <td>
                              <input 
                                className="spreadsheet-input" 
                                type="number" 
                                placeholder="%" 
                                value={item.discount} 
                                onChange={(e) => updateItem(idx, 'discount', e.target.value)} 
                                min="0" 
                                max="100" 
                                step="0.1" 
                              />
                            </td>
                            <td>
                              <select 
                                className="spreadsheet-input" 
                                value={item.gst} 
                                onChange={(e) => updateItem(idx, 'gst', parseInt(e.target.value, 10))}
                              >
                                <option value="0">0%</option>
                                <option value="3">3%</option>
                                <option value="5">5%</option>
                                <option value="12">12%</option>
                                <option value="18">18%</option>
                                <option value="28">28%</option>
                              </select>
                            </td>
                            <td>
                              <span style={{ padding: '0 8px', color: '#64748B' }}>{fmt(taxable)}</span>
                            </td>
                            <td>
                              <span style={{ padding: '0 8px', fontWeight: '600' }}>{fmt(netRowAmount)}</span>
                            </td>
                            <td>
                              {form.items.length > 1 && (
                                <button 
                                  type="button" 
                                  className="remove-item-btn" 
                                  onClick={() => setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))}
                                >
                                  ✕
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Row 3: Invoice Footer Split Section */}
              <div className="invoice-footer-grid">
                
                {/* Notes Column */}
                <div>
                  <h4 className="footer-section-title">Notes & Terms</h4>
                  <label className="form-label">
                    <span>Notes</span>
                    <textarea 
                      className="form-input" 
                      rows="2" 
                      placeholder="Add customer-facing notes..." 
                      value={form.notes} 
                      onChange={(e) => setForm({ ...form, notes: e.target.value })} 
                    />
                  </label>
                  <div style={{ marginTop: '12px' }} className="business-detail">
                    <strong>Place of Supply (State):</strong> {form.stateOfSupply || 'Not Selected'}
                  </div>
                </div>

                {/* Payments Collection Column */}
                <div>
                  <h4 className="footer-section-title">Payment Collection</h4>
                  {cfg.payment ? (
                    <div style={{ display: 'grid', gap: '10px' }}>
                      <label className="form-label">
                        <span>Amount Paid ({currency})</span>
                        <input 
                          type="number" 
                          className="form-input" 
                          placeholder="0.00" 
                          value={form.paid} 
                          onChange={(e) => setForm({ ...form, paid: e.target.value })} 
                          min="0" 
                          max={totals.total} 
                          step="0.01" 
                        />
                      </label>
                      <label className="form-label">
                        <span>Payment Mode</span>
                        <select 
                          className="form-input" 
                          value={form.paymentMode} 
                          onChange={(e) => setForm({ ...form, paymentMode: e.target.value })}
                        >
                          <option value="Cash">Cash</option>
                          <option value="UPI">UPI</option>
                          <option value="Bank Transfer">Bank Transfer</option>
                          <option value="Cheque">Cheque</option>
                          <option value="Credit Card">Credit Card</option>
                        </select>
                      </label>
                      <div style={{ marginTop: '8px', padding: '8px', background: '#F1F5F9', borderRadius: '6px', fontSize: '13px' }}>
                        <strong>Balance Due:</strong> {fmt(Math.max(0, totals.total - parseFloat(form.paid || 0)))}
                      </div>
                    </div>
                  ) : (
                    <p style={{ fontSize: '13px', color: '#64748B', fontStyle: 'italic' }}>Payment details not applicable for this document type.</p>
                  )}
                </div>

                {/* Subtotals & Taxes Column */}
                <div>
                  <h4 className="footer-section-title">Total & Taxation Summary</h4>
                  <div className="totals-breakdown">
                    <div className="totals-row">
                      <span>Subtotal (Taxable Value):</span>
                      <span>{fmt(totals.subtotal)}</span>
                    </div>

                    {/* Show GST Breakdown */}
                    {totals.gstAmount > 0 && (
                      <>
                        {form.stateOfSupply && profile?.state && form.stateOfSupply !== profile.state ? (
                          <div className="totals-row">
                            <span>IGST (Inter-state Tax):</span>
                            <span>{fmt(totals.gstAmount)}</span>
                          </div>
                        ) : (
                          <>
                            <div className="totals-row">
                              <span>CGST (Central Tax):</span>
                              <span>{fmt(totals.gstAmount / 2)}</span>
                            </div>
                            <div className="totals-row">
                              <span>SGST (State Tax):</span>
                              <span>{fmt(totals.gstAmount / 2)}</span>
                            </div>
                          </>
                        )}
                      </>
                    )}

                    <div className="totals-row">
                      <span>Shipping Charges:</span>
                      <input 
                        type="number" 
                        className="spreadsheet-input" 
                        style={{ width: '100px', textAlign: 'right' }} 
                        value={form.shippingCharges} 
                        onChange={(e) => setForm({ ...form, shippingCharges: e.target.value })} 
                        min="0" 
                        step="0.01" 
                      />
                    </div>

                    <div className="totals-row">
                      <span>Flat Discount (overall):</span>
                      <input 
                        type="number" 
                        className="spreadsheet-input" 
                        style={{ width: '100px', textAlign: 'right' }} 
                        value={form.discount} 
                        onChange={(e) => setForm({ ...form, discount: e.target.value })} 
                        min="0" 
                        step="0.01" 
                      />
                    </div>

                    <div className="totals-row">
                      <div className="round-off-container">
                        <input 
                          type="checkbox" 
                          id="autoRoundOffCheck" 
                          checked={form.autoRoundOff} 
                          onChange={(e) => setForm({ ...form, autoRoundOff: e.target.checked })} 
                        />
                        <label htmlFor="autoRoundOffCheck" style={{ cursor: 'pointer' }}>Round Off:</label>
                      </div>
                      {form.autoRoundOff ? (
                        <span style={{ fontSize: '12px', color: '#64748B' }}>{totals.roundOff >= 0 ? '+' : ''}{totals.roundOff.toFixed(2)}</span>
                      ) : (
                        <input 
                          type="number" 
                          className="spreadsheet-input" 
                          style={{ width: '100px', textAlign: 'right' }} 
                          value={form.roundOff} 
                          onChange={(e) => setForm({ ...form, roundOff: e.target.value })} 
                          step="0.01" 
                        />
                      )}
                    </div>

                    <div className="totals-row grand-total">
                      <span>Total Amount:</span>
                      <span>{fmt(totals.total)}</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Modal Action Controls */}
              <div className="modal-actions">
                <button type="button" className="secondary-button" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="button" className="secondary-button" onClick={() => handleSubmit(null, true)}>💾 Save & Print</button>
                <button type="submit" className="primary-button">💾 Save Invoice</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inline Customer Add Modal Popup */}
      {showAddCustomer && (
        <>
          <div className="inline-popover-overlay" onClick={() => setShowAddCustomer(false)}></div>
          <div className="inline-popover">
            <h4 style={{ marginBottom: '16px', fontSize: '16px', fontWeight: '700' }}>Add New {partyLabel}</h4>
            {customerError && <p className="form-message form-error" style={{ padding: '6px', fontSize: '12px' }}>{customerError}</p>}
            <form onSubmit={handleAddCustomerSubmit} style={{ display: 'grid', gap: '12px' }}>
              <label className="form-label">
                <span>Name *</span>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Party Name" 
                  value={newCustomer.name} 
                  onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })} 
                  required 
                />
              </label>
              <label className="form-label">
                <span>Phone / Mobile</span>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="10 digit number" 
                  value={newCustomer.phone} 
                  onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })} 
                />
              </label>
              <label className="form-label">
                <span>GSTIN</span>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="15-digit GSTIN" 
                  value={newCustomer.gstin} 
                  onChange={(e) => setNewCustomer({ ...newCustomer, gstin: e.target.value })} 
                />
              </label>
              <label className="form-label">
                <span>Billing Address</span>
                <textarea 
                  className="form-input" 
                  rows="2" 
                  placeholder="Full Address" 
                  value={newCustomer.address} 
                  onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })} 
                />
              </label>
              <label className="form-label">
                <span>State</span>
                <select 
                  className="form-input" 
                  value={newCustomer.state} 
                  onChange={(e) => setNewCustomer({ ...newCustomer, state: e.target.value })}
                >
                  <option value="">Select State</option>
                  {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <div className="modal-actions" style={{ marginTop: '12px' }}>
                <button type="button" className="secondary-button" onClick={() => setShowAddCustomer(false)}>Cancel</button>
                <button type="submit" className="primary-button" disabled={customerSaving}>
                  {customerSaving ? 'Saving...' : 'Save Party'}
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* Scoped CSS Injector */}
      <style>{`
        .modal-extra-wide {
          max-width: 1250px !important;
          width: 95% !important;
        }
        .invoice-fields-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          background: #f8fafc;
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          padding: 16px;
          margin-bottom: 20px;
        }
        .party-select-container {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .add-party-btn {
          background: var(--accent-light);
          color: var(--accent);
          border: 1px solid var(--accent);
          border-radius: var(--radius-sm);
          width: 38px;
          height: 38px;
          font-weight: 700;
          font-size: 20px;
          cursor: pointer;
          transition: all 0.15s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .add-party-btn:hover {
          background: var(--accent);
          color: white;
        }
        .spreadsheet-grid {
          overflow-x: auto;
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          margin-bottom: 20px;
          background: white;
        }
        .spreadsheet-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        .spreadsheet-table th {
          background: #f1f5f9;
          color: var(--text-secondary);
          font-weight: 600;
          padding: 10px;
          text-align: left;
          border-bottom: 1px solid var(--border);
        }
        .spreadsheet-table td {
          padding: 8px 10px;
          border-bottom: 1px solid #e2e8f0;
          vertical-align: middle;
        }
        .spreadsheet-table tr:last-child td {
          border-bottom: none;
        }
        .spreadsheet-input {
          width: 100%;
          padding: 6px 8px;
          border: 1px solid var(--border);
          border-radius: 4px;
          font-size: 13px;
          background: white;
          color: var(--text-primary);
          outline: none;
          transition: border 0.15s;
        }
        .spreadsheet-input:focus {
          border-color: var(--accent);
        }
        .spreadsheet-input[readonly] {
          background: #f8fafc;
          color: var(--text-secondary);
          cursor: not-allowed;
          border-color: #e2e8f0;
        }
        .invoice-footer-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1.2fr;
          gap: 24px;
          background: #f8fafc;
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          padding: 20px;
          margin-bottom: 20px;
        }
        .footer-section-title {
          font-size: 14px;
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: 12px;
          border-bottom: 1px solid var(--border);
          padding-bottom: 6px;
        }
        .totals-breakdown {
          display: flex;
          flex-direction: column;
          gap: 8px;
          font-size: 13px;
        }
        .totals-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          color: var(--text-secondary);
        }
        .totals-row.grand-total {
          font-size: 16px;
          font-weight: 800;
          color: var(--accent-dark);
          border-top: 1px solid var(--border);
          padding-top: 8px;
          margin-top: 4px;
        }
        .round-off-container {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .inline-popover {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: white;
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-lg);
          padding: 24px;
          z-index: 1100;
          width: 400px;
          max-width: 90%;
          animation: modalScaleUp 0.15s ease-out;
        }
        .inline-popover-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(15, 23, 42, 0.4);
          z-index: 1099;
        }
      `}</style>
    </>
  );
}

export default InvoiceListPage;
