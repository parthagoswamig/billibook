const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(process.env.REACT_APP_SUPABASE_URL, process.env.REACT_APP_SUPABASE_ANON_KEY);

const tenantId = 'd0fb3971-d899-4080-a213-4b337eb3066a';

async function main() {
  console.log("🚀 Starting database rename process to use proper names...");

  // Login
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'parthagoswamig@gmail.com',
    password: '9800975588'
  });
  if (authError) throw authError;

  // 1. Rename Customers containing '5079'
  const { data: dbCustomers, error: custErr } = await supabase
    .from('customers')
    .select('id, name')
    .eq('user_id', tenantId)
    .eq('type', 'customer')
    .like('name', '%5079');
  
  if (custErr) throw custErr;
  console.log(`Found ${dbCustomers.length} placeholder customers to rename.`);

  const properCustomerNames = ['Rajesh Kumar', 'Anjali Sharma', 'Vikram Malhotra'];
  for (let i = 0; i < dbCustomers.length; i++) {
    const cust = dbCustomers[i];
    const newName = properCustomerNames[i] || `Customer ${i + 1}`;
    const { error } = await supabase
      .from('customers')
      .update({ name: newName })
      .eq('id', cust.id);
    if (error) console.error(`Error renaming customer ${cust.name}:`, error);
    else console.log(`Renamed Customer: "${cust.name}" ➔ "${newName}"`);
  }

  // 2. Rename Suppliers containing '5079'
  const { data: dbSuppliers, error: suppErr } = await supabase
    .from('customers')
    .select('id, name')
    .eq('user_id', tenantId)
    .eq('type', 'supplier')
    .like('name', '%5079');

  if (suppErr) throw suppErr;
  console.log(`Found ${dbSuppliers.length} placeholder suppliers to rename.`);

  const properSupplierNames = ['Aditya Enterprises', 'Karan Logistics', 'Mehta Distributors'];
  for (let i = 0; i < dbSuppliers.length; i++) {
    const supp = dbSuppliers[i];
    const newName = properSupplierNames[i] || `Supplier ${i + 1}`;
    const { error } = await supabase
      .from('customers')
      .update({ name: newName })
      .eq('id', supp.id);
    if (error) console.error(`Error renaming supplier ${supp.name}:`, error);
    else console.log(`Renamed Supplier: "${supp.name}" ➔ "${newName}"`);
  }

  // 3. Rename Products containing '5079'
  const { data: dbProducts, error: prodErr } = await supabase
    .from('products')
    .select('id, name')
    .eq('user_id', tenantId)
    .like('name', '%5079');

  if (prodErr) throw prodErr;
  console.log(`Found ${dbProducts.length} placeholder products to rename.`);

  const properProductNames = ['Fortune Basmati Rice', 'Dhara Mustard Oil', 'Madhur Pure Sugar'];
  for (let i = 0; i < dbProducts.length; i++) {
    const prod = dbProducts[i];
    const newName = properProductNames[i] || `Product ${i + 1}`;
    
    // Update product table name
    const { error: pErr } = await supabase
      .from('products')
      .update({ name: newName })
      .eq('id', prod.id);
    if (pErr) {
      console.error(`Error renaming product ${prod.name}:`, pErr);
      continue;
    }

    // Update invoice_items table name for consistency in historical bills
    const { error: itemErr } = await supabase
      .from('invoice_items')
      .update({ name: newName })
      .eq('product_id', prod.id);
    if (itemErr) console.error(`Error updating invoice items name for product ID ${prod.id}:`, itemErr);
    
    console.log(`Renamed Product & Invoices: "${prod.name}" ➔ "${newName}"`);
  }

  console.log("🎉 Database rename process completed successfully!");
}

main().catch(err => {
  console.error("❌ Rename failed:", err);
});
