const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(process.env.REACT_APP_SUPABASE_URL, process.env.REACT_APP_SUPABASE_ANON_KEY);

const tenantId = 'd0fb3971-d899-4080-a213-4b337eb3066a';

async function main() {
  console.log("🚀 Starting database rename process for old placeholder customers...");

  // Login
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'parthagoswamig@gmail.com',
    password: '9800975588'
  });
  if (authError) throw authError;

  // Query all customers for this tenant
  const { data: dbCustomers, error: custErr } = await supabase
    .from('customers')
    .select('id, name')
    .eq('user_id', tenantId);
  
  if (custErr) throw custErr;
  console.log(`Found ${dbCustomers.length} total customers in workspace.`);

  // Map of old names to proper clean full names
  const renameMap = {
    'Customer A (Rahul)': 'Rahul Sharma',
    'Customer B (Amit)': 'Amit Patel',
    'Customer C (Pooja)': 'Pooja Gupta',
    'Customer D (Vikram)': 'Vikram Singhania',
    'Customer E (Sneha)': 'Sneha Roy'
  };

  for (const cust of dbCustomers) {
    const matchedNewName = renameMap[cust.name.trim()];
    if (matchedNewName) {
      const { error } = await supabase
        .from('customers')
        .update({ name: matchedNewName })
        .eq('id', cust.id);
      if (error) {
        console.error(`Error renaming ${cust.name}:`, error);
      } else {
        console.log(`Renamed: "${cust.name}" ➔ "${matchedNewName}"`);
      }
    }
  }

  console.log("🎉 Old placeholder customers renamed successfully!");
}

main().catch(err => {
  console.error("❌ Rename failed:", err);
});
