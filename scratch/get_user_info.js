const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(process.env.REACT_APP_SUPABASE_URL, process.env.REACT_APP_SUPABASE_ANON_KEY);

async function main() {
  console.log("Logging in to Supabase...");
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'parthagoswamig@gmail.com',
    password: '9800975588'
  });
  if (error) {
    console.error("Auth error:", error);
    return;
  }
  const user = data.user;
  console.log("Logged in User ID:", user.id);
  console.log("Logged in User Email:", user.email);

  const { data: invite, error: inviteError } = await supabase
    .from('team_invites')
    .select('owner_id')
    .eq('email', user.email.toLowerCase().trim())
    .eq('status', 'accepted')
    .limit(1)
    .maybeSingle();

  const tenantId = invite ? invite.owner_id : user.id;
  console.log("Active Tenant ID:", tenantId);

  const { data: invoices, error: invError } = await supabase
    .from('invoices')
    .select('id, invoice_no, type, document_kind, total, paid, balance, date')
    .eq('user_id', tenantId);

  if (invError) {
    console.error("Error fetching invoices:", invError);
  } else {
    console.log(`Invoices count for tenant ${tenantId}:`, invoices?.length);
    if (invoices?.length > 0) {
      console.log("Invoices list:", JSON.stringify(invoices, null, 2));
    }
  }
}

main();
