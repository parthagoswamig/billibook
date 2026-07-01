const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(process.env.REACT_APP_SUPABASE_URL, process.env.REACT_APP_SUPABASE_ANON_KEY);

async function main() {
  const tenantId = 'd0fb3971-d899-4080-a213-4b337eb3066a';
  const { data, error } = await supabase
    .from('invoices')
    .select('id, invoice_no, type, document_kind, total, paid, balance, date')
    .eq('user_id', tenantId);

  if (error) {
    console.error("Error fetching invoices:", error);
    return;
  }

  console.log("=== INVOICES IN DATABASE ===");
  console.log(JSON.stringify(data, null, 2));
}

main();
