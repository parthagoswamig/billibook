const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(process.env.REACT_APP_SUPABASE_URL, process.env.REACT_APP_SUPABASE_ANON_KEY);

async function main() {
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('invoice_no', 'INV-005')
    .single();

  if (error) {
    console.error("Error fetching INV-005:", error);
  } else {
    console.log("=== INV-005 DATABASE ROW ===");
    console.log(data);
  }
}

main();
