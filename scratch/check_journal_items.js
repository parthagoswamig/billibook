const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

// We need to use the live/production database credentials that Vercel is connected to!
// Wait, is the live database credentials in .env? Let's check.
// If the local .env has the URL fxnbzngnlqaaocljonzy, let's verify if that database contains the journal entry!
const supabase = createClient(process.env.REACT_APP_SUPABASE_URL, process.env.REACT_APP_SUPABASE_ANON_KEY);

async function main() {
  // Let's search for journal_entries of type 'invoice'
  const { data: entries, error: err1 } = await supabase
    .from('journal_entries')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  if (err1) {
    console.error("Error fetching entries:", err1);
    return;
  }

  console.log("=== RECENT JOURNAL ENTRIES ===");
  console.log(entries);

  if (entries.length > 0) {
    const entryId = entries[0].id;
    const { data: items, error: err2 } = await supabase
      .from('journal_items')
      .select('id, account_id, debit, credit, accounts(name)')
      .eq('entry_id', entryId);

    if (err2) {
      console.error("Error fetching items:", err2);
      return;
    }

    console.log(`=== JOURNAL ITEMS FOR ENTRY ${entryId} ===`);
    console.log(JSON.stringify(items, null, 2));
  }
}

main();
