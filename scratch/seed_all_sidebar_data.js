const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(process.env.REACT_APP_SUPABASE_URL, process.env.REACT_APP_SUPABASE_ANON_KEY);

async function main() {
  console.log("🚀 Authenticating client to bypass RLS...");
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'parthagoswamig@gmail.com',
    password: '9800975588'
  });
  if (authError) throw authError;
  
  const user = authData.user;
  console.log(`✅ Authenticated as ${user.email} (UID: ${user.id})`);

  // Resolve tenant ID
  const { data: invite, error: inviteError } = await supabase
    .from('team_invites')
    .select('owner_id')
    .eq('email', user.email.toLowerCase().trim())
    .eq('status', 'accepted')
    .limit(1)
    .maybeSingle();

  const tenantId = invite ? invite.owner_id : user.id;
  console.log("Active Tenant ID:", tenantId);

  const timestamp = Date.now().toString().slice(-4);

  // 1. Insert 3 Customers
  const customersData = [
    { user_id: tenantId, name: `Cust Alpha ${timestamp}`, phone: `999991${timestamp}`, type: 'customer', state: 'West Bengal', city: 'Kolkata' },
    { user_id: tenantId, name: `Cust Beta ${timestamp}`, phone: `999992${timestamp}`, type: 'customer', state: 'West Bengal', city: 'Howrah' },
    { user_id: tenantId, name: `Cust Gamma ${timestamp}`, phone: `999993${timestamp}`, type: 'customer', state: 'West Bengal', city: 'Kolkata' }
  ];
  const { data: customers, error: custErr } = await supabase.from('customers').insert(customersData).select();
  if (custErr) throw custErr;
  console.log(`✅ Customers initialized: ${customers.length}`);

  // 2. Insert 3 Suppliers
  const suppliersData = [
    { user_id: tenantId, name: `Supp Alpha ${timestamp}`, phone: `888881${timestamp}`, type: 'supplier', state: 'West Bengal', city: 'Kolkata' },
    { user_id: tenantId, name: `Supp Beta ${timestamp}`, phone: `888882${timestamp}`, type: 'supplier', state: 'West Bengal', city: 'Howrah' },
    { user_id: tenantId, name: `Supp Gamma ${timestamp}`, phone: `888883${timestamp}`, type: 'supplier', state: 'West Bengal', city: 'Kolkata' }
  ];
  const { data: suppliers, error: suppErr } = await supabase.from('customers').insert(suppliersData).select();
  if (suppErr) throw suppErr;
  console.log(`✅ Suppliers initialized: ${suppliers.length}`);

  // 3. Insert 3 Products
  const productsData = [
    { user_id: tenantId, name: `Rice Premium ${timestamp}`, sku: `RICE${timestamp}`, stock: 100, sale_price: 150, purchase_price: 120, unit: 'KGS', track_stock: true, is_service: false, gst: 5 },
    { user_id: tenantId, name: `Mustard Oil ${timestamp}`, sku: `OIL${timestamp}`, stock: 200, sale_price: 220, purchase_price: 180, unit: 'LTR', track_stock: true, is_service: false, gst: 12 },
    { user_id: tenantId, name: `White Sugar ${timestamp}`, sku: `SUG${timestamp}`, stock: 150, sale_price: 45, purchase_price: 35, unit: 'KGS', track_stock: true, is_service: false, gst: 5 }
  ];
  const { data: products, error: prodErr } = await supabase.from('products').insert(productsData).select();
  if (prodErr) throw prodErr;
  console.log(`✅ Products initialized: ${products.length}`);

  // Helpers for inserting documents
  const documentKinds = [
    { type: 'sale', kind: 'sale_invoice', prefix: `INV-${timestamp}-` },
    { type: 'sale', kind: 'quotation', prefix: `QUO-${timestamp}-` },
    { type: 'sale', kind: 'estimate', prefix: `EST-${timestamp}-` },
    { type: 'sale', kind: 'proforma_invoice', prefix: `PI-${timestamp}-` },
    { type: 'sale', kind: 'delivery_challan', prefix: `DC-${timestamp}-` },
    { type: 'sale', kind: 'credit_note', prefix: `CN-${timestamp}-` },
    { type: 'purchase', kind: 'purchase_bill', prefix: `PUR-${timestamp}-` },
    { type: 'purchase', kind: 'purchase_return', prefix: `PR-${timestamp}-` },
    { type: 'purchase', kind: 'debit_note', prefix: `DN-${timestamp}-` }
  ];

  const todayStr = new Date().toISOString().split('T')[0];

  for (const doc of documentKinds) {
    console.log(`📄 Seeding 3 records for document kind: ${doc.kind}...`);
    
    // Select parties based on document type (sale -> customer, purchase -> supplier)
    const activeParties = doc.type === 'sale' ? customers : suppliers;

    for (let idx = 0; idx < 3; idx++) {
      const party = activeParties[idx];
      const prod = products[idx];
      const qty = (idx + 1) * 5;
      const totalAmount = qty * prod.sale_price;
      const paidAmount = idx === 0 ? 0 : idx === 1 ? Math.floor(totalAmount / 2) : totalAmount;
      const balanceAmount = totalAmount - paidAmount;

      const invoiceData = {
        user_id: tenantId,
        customer_id: party.id,
        invoice_no: `${doc.prefix}${idx + 1}`,
        type: doc.type,
        document_kind: doc.kind,
        date: todayStr,
        status: balanceAmount === 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid',
        subtotal: totalAmount,
        gst_amount: 0,
        discount: 0,
        round_off: 0,
        total: totalAmount,
        paid: paidAmount,
        balance: balanceAmount,
        notes: `Test record ${idx + 1} for ${doc.kind} generated automatically.`
      };

      const { data: invoice, error: invInsertErr } = await supabase.from('invoices').insert([invoiceData]).select().single();
      if (invInsertErr) throw invInsertErr;

      // Insert item
      const itemRow = {
        invoice_id: invoice.id,
        user_id: tenantId,
        product_id: prod.id,
        name: prod.name,
        qty: qty,
        price: prod.sale_price,
        gst: prod.gst,
        amount: totalAmount,
        unit: prod.unit
      };
      const { error: itemInsertErr } = await supabase.from('invoice_items').insert([itemRow]);
      if (itemInsertErr) throw itemInsertErr;

      // For payments
      if (paidAmount > 0) {
        const paymentRow = {
          invoice_id: invoice.id,
          user_id: tenantId,
          amount: paidAmount,
          payment_mode: 'Cash',
          note: `Payment for ${invoice.invoice_no}`
        };
        await supabase.from('invoice_payments').insert([paymentRow]);
      }
    }
  }

  // 4. Record 3 Expenses today
  console.log("💸 Seeding 3 Expenses...");
  const expensesData = [
    { user_id: tenantId, category: 'Electricity', amount: 3500, date: todayStr, description: 'Office Electricity Bill' },
    { user_id: tenantId, category: 'Internet', amount: 1500, date: todayStr, description: 'Broadband subscription' },
    { user_id: tenantId, category: 'Rent', amount: 12000, date: todayStr, description: 'Monthly Rent' }
  ];
  await supabase.from('expenses').insert(expensesData);

  console.log("🎉 Database seeding completed successfully!");
}

main().catch(err => {
  console.error("❌ Seeding failed:", err);
});
