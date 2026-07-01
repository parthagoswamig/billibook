const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(process.env.REACT_APP_SUPABASE_URL, process.env.REACT_APP_SUPABASE_ANON_KEY);

async function main() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'parthagoswamig@gmail.com',
    password: '9800975588'
  });
  if (error) throw error;
  
  // Format exactly how Supabase saves it in localStorage
  const storageKey = `sb-fxnbzngnlqaaocljonzy-auth-token`;
  const storageValue = JSON.stringify(data.session);

  console.log("STORAGE_KEY:", storageKey);
  console.log("STORAGE_VALUE:", storageValue);
}

main().catch(err => {
  console.error(err);
});
