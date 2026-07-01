const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(process.env.REACT_APP_SUPABASE_URL, process.env.REACT_APP_SUPABASE_ANON_KEY);

async function main() {
  const invoiceNos = ['INV-001', 'INV-002', 'INV-003', 'INV-004'];
  console.log(`🧹 Deleting temporary invoices: ${invoiceNos.join(', ')}...`);

  const { data, error } = await supabase
    .from('invoices')
    .delete()
    .in('invoice_no', invoiceNos);

  if (error) {
    console.error("❌ Error deleting invoices:", error);
  } else {
    console.log("✅ Temporary invoices deleted successfully!");
  }
}

main();
