const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(process.env.REACT_APP_SUPABASE_URL, process.env.REACT_APP_SUPABASE_ANON_KEY);

const email = 'khatape.business.sample@gmail.com';
const password = 'password123';

async function main() {
  console.log(`🚀 Checking/Registering sample user: ${email}...`);

  // Attempt to sign in first
  let tenantId;
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  
  if (signInError) {
    console.log("Creating new sample user with metadata...");
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          business_name: 'Sample Business'
        }
      }
    });
    if (signUpError) throw signUpError;
    tenantId = signUpData.user.id;
    console.log(`✅ Registered sample user with ID: ${tenantId}`);
  } else {
    tenantId = signInData.user.id;
    console.log(`✅ Logged in successfully. ID: ${tenantId}`);
  }

  // Authenticate database client as the sample user
  const { error: authErr2 } = await supabase.auth.signInWithPassword({ email, password });
  if (authErr2) throw authErr2;

  // Initialize Business Profile to trigger Role setup
  console.log("Setting up business profile for sample user...");
  const { data: existingProfile } = await supabase
    .from('business_profile')
    .select('id')
    .eq('user_id', tenantId)
    .maybeSingle();

  if (!existingProfile) {
    const { error: profErr } = await supabase.from('business_profile').insert([{
      user_id: tenantId,
      business_name: 'Sample Business',
      email
    }]);
    if (profErr) console.warn("Note: Profile insert warning (might already exist via DB triggers):", profErr.message);
    else console.log("✅ Business Profile created successfully!");
  } else {
    console.log("✅ Business Profile already exists.");
  }

  const timestamp = Date.now().toString().slice(-4);

  // 1. Insert 3 Customers
  const customersData = [
    { user_id: tenantId, name: 'Rahul Sharma', phone: `980001${timestamp}`, type: 'customer', state: 'West Bengal', city: 'Kolkata' },
    { user_id: tenantId, name: 'Amit Patel', phone: `980002${timestamp}`, type: 'customer', state: 'West Bengal', city: 'Howrah' },
    { user_id: tenantId, name: 'Pooja Gupta', phone: `980003${timestamp}`, type: 'customer', state: 'West Bengal', city: 'Kolkata' }
  ];
  const { data: customers, error: custErr } = await supabase.from('customers').insert(customersData).select();
  if (custErr) throw custErr;
  console.log(`✅ Customers seeded: ${customers.length}`);

  // 2. Insert 3 Suppliers
  const suppliersData = [
    { user_id: tenantId, name: 'Aditya Enterprises', phone: `880001${timestamp}`, type: 'supplier', state: 'West Bengal', city: 'Kolkata' },
    { user_id: tenantId, name: 'Karan Logistics', phone: `880002${timestamp}`, type: 'supplier', state: 'West Bengal', city: 'Howrah' },
    { user_id: tenantId, name: 'Mehta Distributors', phone: `880003${timestamp}`, type: 'supplier', state: 'West Bengal', city: 'Kolkata' }
  ];
  const { data: suppliers, error: suppErr } = await supabase.from('customers').insert(suppliersData).select();
  if (suppErr) throw suppErr;
  console.log(`✅ Suppliers seeded: ${suppliers.length}`);

  // 3. Insert 3 Products
  const productsData = [
    { user_id: tenantId, name: 'Fortune Basmati Rice', sku: `RICE${timestamp}`, stock: 100, sale_price: 150, purchase_price: 120, unit: 'KGS', track_stock: true, is_service: false, gst: 5 },
    { user_id: tenantId, name: 'Dhara Mustard Oil', sku: `OIL${timestamp}`, stock: 200, sale_price: 220, purchase_price: 180, unit: 'LTR', track_stock: true, is_service: false, gst: 12 },
    { user_id: tenantId, name: 'Madhur Pure Sugar', sku: `SUG${timestamp}`, stock: 150, sale_price: 45, purchase_price: 35, unit: 'KGS', track_stock: true, is_service: false, gst: 5 }
  ];
  const { data: products, error: prodErr } = await supabase.from('products').insert(productsData).select();
  if (prodErr) throw prodErr;
  console.log(`✅ Products seeded: ${products.length}`);

  // 4. Seeding document kinds
  const documentKinds = [
    { type: 'sale', kind: 'sale_invoice', prefix: 'INV-2026-' },
    { type: 'sale', kind: 'quotation', prefix: 'QUO-2026-' },
    { type: 'sale', kind: 'estimate', prefix: 'EST-2026-' },
    { type: 'sale', kind: 'proforma_invoice', prefix: 'PI-2026-' },
    { type: 'sale', kind: 'delivery_challan', prefix: 'DC-2026-' },
    { type: 'sale', kind: 'credit_note', prefix: 'CN-2026-' },
    { type: 'purchase', kind: 'purchase_bill', prefix: 'PUR-2026-' },
    { type: 'purchase', kind: 'purchase_return', prefix: 'PR-2026-' },
    { type: 'purchase', kind: 'debit_note', prefix: 'DN-2026-' }
  ];

  const todayStr = new Date().toISOString().split('T')[0];

  for (const doc of documentKinds) {
    console.log(`📄 Seeding 3 records for document kind: ${doc.kind}...`);
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
        notes: `Sample ${doc.kind} document for ${party.name}.`
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

  // 5. Seed 3 Expenses
  console.log("💸 Seeding 3 Expenses...");
  const expensesData = [
    { user_id: tenantId, category: 'Electricity', amount: 3500, date: todayStr, description: 'Office Electricity Bill' },
    { user_id: tenantId, category: 'Internet', amount: 1500, date: todayStr, description: 'Broadband subscription' },
    { user_id: tenantId, category: 'Office Rent', amount: 12000, date: todayStr, description: 'Monthly Rent' }
  ];
  await supabase.from('expenses').insert(expensesData);

  console.log("🎉 Database seeding completed successfully for sample user!");
}

main().catch(err => {
  console.error("❌ Seeding failed:", err);
});
