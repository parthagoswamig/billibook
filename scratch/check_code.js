const https = require('https');

https.get('https://khatape360.vercel.app/static/js/main.22899a3d.js', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    // Search for the project sub-domain or supabase
    console.log("Searching for supabase keywords...");
    console.log("fxnbzngnlqaaocljonzy exists in bundle:", data.includes('fxnbzngnlqaaocljonzy'));
    
    const idx = data.indexOf('supabase');
    if (idx !== -1) {
      console.log("Snippet around 'supabase' in live code:", data.substring(idx - 100, idx + 200));
    } else {
      console.log("Word 'supabase' not found in live JS code!");
    }
  });
}).on('error', err => {
  console.error(err);
});
