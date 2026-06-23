const fs = require('fs');
const path = require('path');

const files = [
  'supabase_upgrades.sql',
  'supabase_rbac_migration.sql',
  'supabase_schema.sql',
  'supabase_schema_complete.sql'
];

for (const file of files) {
  const filePath = path.join('c:\\Users\\HP\\Desktop\\billbook', file);
  if (!fs.existsSync(filePath)) continue;
  
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  
  console.log(`Checking ${file}:`);
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].toLowerCase().includes('get_tenant_id')) {
      console.log(`Line ${i + 1}: ${lines[i].trim()}`);
    }
  }
}
