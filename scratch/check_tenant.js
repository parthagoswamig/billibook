const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(process.env.REACT_APP_SUPABASE_URL, process.env.REACT_APP_SUPABASE_ANON_KEY);

async function main() {
  const { data: users, error } = await supabase.auth.admin.listUsers();
  if (error) {
    // Admin API might be restricted, fallback to public profile tables
    console.log("Admin listUsers failed, querying business_profile and team_members...");
    const { data: profiles, error: pErr } = await supabase
      .from('business_profile')
      .select('*');
    console.log("business_profile rows:", JSON.stringify(profiles, null, 2));

    const { data: invoices, error: iErr } = await supabase
      .from('invoices')
      .select('id, user_id, invoice_no, total, date');
    console.log("all invoices:", JSON.stringify(invoices, null, 2));
    return;
  }
  console.log("users:", users);
}

main();
