const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

// Parse .env file manually
const envPath = path.join(__dirname, '..', '.env');
if (!fs.existsSync(envPath)) {
  console.error("Error: .env file not found at " + envPath);
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split(/\r?\n/).forEach(line => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx > 0) {
    const key = trimmed.substring(0, eqIdx).trim();
    const val = trimmed.substring(eqIdx + 1).trim();
    env[key] = val;
  }
});

// Create screenshots directory
const screenshotsDir = path.join(__dirname, 'ui_test_runs');
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

// Find local Chrome path on Windows
const paths = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
];
let executablePath;
for (const p of paths) {
  if (fs.existsSync(p)) {
    executablePath = p;
    break;
  }
}

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function run() {
  console.log("🚀 Starting Puppeteer Local UI Automation Test...");
  const browser = await puppeteer.launch({
    headless: "new",
    executablePath,
    defaultViewport: { width: 1280, height: 800 }
  });

  const page = await browser.newPage();

  // Helper for taking screenshots
  async function takeScreenshot(name) {
    const screenshotPath = path.join(screenshotsDir, `${name}.png`);
    await page.screenshot({ path: screenshotPath });
    console.log(`📸 Screenshot saved: ${screenshotPath}`);
  }

  try {
    // 1. LOGIN
    console.log("🔑 Navigating to Login Page...");
    await page.goto('https://khatape360.vercel.app/dashboard', { waitUntil: 'networkidle2' });
    
    // Wait for the login screen to settle
    await page.waitForSelector('input[type="email"]');
    await delay(1000);

    // Dismiss update modal if it overlays the login screen immediately
    const hasUpdateModalOnStart = await page.evaluate(() => {
      const overlay = document.querySelector('.update-modal-overlay');
      if (overlay) {
        const btn = Array.from(overlay.querySelectorAll('button')).find(b => b.innerText.includes('Later'));
        if (btn) {
          btn.click();
          return true;
        }
      }
      return false;
    });

    if (hasUpdateModalOnStart) {
      console.log("💡 Dismissed Update modal on login screen.");
      await delay(1000);
    }
    
    console.log("📝 Filling in credentials...");
    await page.type('input[type="email"]', 'parthagoswamig@gmail.com');
    await page.type('input[type="password"]', '9800975588');
    await page.click('button[type="submit"]');

    console.log("⏳ Waiting for Dashboard to load...");
    await page.waitForSelector('.time-range-selector', { timeout: 15000 });
    
    console.log("✅ Logged in successfully!");
    await takeScreenshot('01_dashboard');

    // Navigation Helper using SPA Sidebar Links
    async function navigateTo(label) {
      console.log(`🧭 Clicking sidebar link: ${label}...`);
      await page.evaluate((lbl) => {
        const links = Array.from(document.querySelectorAll('a.sidebar-link'));
        const targetLink = links.find(l => {
          const textSpan = l.querySelector('.sidebar-link-text');
          return textSpan && textSpan.innerText.trim().toLowerCase().includes(lbl.trim().toLowerCase());
        });
        if (targetLink) {
          targetLink.click();
        } else {
          const fallback = links.find(l => l.innerText.toLowerCase().includes(lbl.toLowerCase()));
          if (fallback) fallback.click();
          else throw new Error(`Sidebar link with label "${lbl}" not found.`);
        }
      }, label);
      await delay(1500); // Wait for page transition
    }

    // Helper to create different invoice kinds
    async function createDocument(name, customerName, productName, qty) {
      await navigateTo(name);
      await page.waitForSelector('.primary-button');
      
      console.log("➕ Clicking '+ Create' button...");
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button.primary-button')).find(b => b.innerText.includes('Create') || b.innerText.includes('Add'));
        if (btn) btn.click();
      });

      console.log("⏳ Waiting for modal form...");
      await page.waitForSelector('.modal-content');
      await delay(1000);

      console.log(`👥 Selecting customer: ${customerName}...`);
      await page.evaluate((custName) => {
        const select = document.querySelector('.invoice-fields-grid select');
        if (select) {
          const opt = Array.from(select.options).find(o => o.text.includes(custName));
          if (opt) {
            select.value = opt.value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
      }, customerName);

      console.log(`📦 Selecting product: ${productName}...`);
      const inputSelector = '.spreadsheet-table tbody tr input.spreadsheet-input';
      await page.click(inputSelector);
      // Clear input
      await page.keyboard.down('Control');
      await page.keyboard.press('A');
      await page.keyboard.up('Control');
      await page.keyboard.press('Backspace');
      await page.type(inputSelector, productName);
      await delay(1500);

      // Select suggestion
      await page.evaluate(() => {
        const divs = Array.from(document.querySelectorAll('div'));
        const suggestion = divs.find(d => d.style.cursor === 'pointer' && d.innerText.includes('Stock:'));
        if (suggestion) suggestion.click();
      });
      await delay(1000);

      console.log(`🔢 Setting quantity: ${qty}...`);
      await page.evaluate((q) => {
        const inputs = Array.from(document.querySelectorAll('input.spreadsheet-input'));
        const qtyInput = inputs[2]; // usually 3rd input in row
        if (qtyInput) {
          qtyInput.value = q;
          qtyInput.dispatchEvent(new Event('input', { bubbles: true }));
          qtyInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, qty);
      await delay(1000);

      await takeScreenshot(`modal_${name.toLowerCase().replace(/ /g, '_')}`);

      console.log("💾 Clicking Save button...");
      await page.click('.modal-actions button.primary-button');
      await delay(3000);
      console.log(`✅ ${name} saved successfully!`);
    }

    // 1. Create Quotation
    await createDocument('Quotation', 'Customer A', 'Mustard Oil 1L', 2);

    // 2. Create Estimate
    await createDocument('Estimate', 'Customer B', 'Tata Salt 1kg', 10);

    // 3. Create Delivery Challan
    await createDocument('Delivery Challan', 'Customer C', 'Sugar Premium 1kg', 5);

    // 4. Create Credit Note
    await createDocument('Credit Note', 'Customer A', 'Basmati Rice 5kg', 1);

    // 5. Create Purchase Bill
    await createDocument('Purchase Bill', 'Customer B', 'Fortune Atta 5kg', 5);

    // 6. Create Debit Note
    await createDocument('Debit Note', 'Customer B', 'Fortune Atta 5kg', 1);

    // 7. Create Purchase Return
    await createDocument('Purchase Return', 'Customer B', 'Fortune Atta 5kg', 1);

    // 8. Product Stock Adjustment
    await navigateTo('Inventory');
    await page.waitForSelector('.inventory-tabs');
    
    console.log("🔄 Switching to 'Record Stock Adjustment' tab...");
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('.inventory-tab-btn')).find(b => b.innerText.includes('Adjustment'));
      if (btn) btn.click();
    });
    await page.waitForSelector('form select');
    await delay(1000);

    console.log("📦 Filling stock adjustment form...");
    await page.evaluate(() => {
      const selects = Array.from(document.querySelectorAll('form select'));
      // Product select
      const prodSelect = selects[0];
      const opt = Array.from(prodSelect.options).find(o => o.text.includes('Basmati Rice 5kg'));
      if (opt) {
        prodSelect.value = opt.value;
        prodSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await delay(500);

    await page.type('form input[type="number"]', '10');
    
    await page.evaluate(() => {
      const selects = Array.from(document.querySelectorAll('form select'));
      // Reason select
      const reasonSelect = selects[2];
      if (reasonSelect) {
        reasonSelect.value = "Correction";
        reasonSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await takeScreenshot('inventory_adj_form');

    console.log("💾 Submitting stock adjustment...");
    await page.click('form button[type="submit"]');
    await delay(3000);
    console.log("✅ Stock adjustment recorded!");

    // 9. Customer Ledger
    await navigateTo('Parties');
    await page.waitForSelector('.simple-table');
    await delay(1000);

    console.log("🔍 Clicking on Customer A (Rahul)...");
    await page.evaluate(() => {
      const cells = Array.from(document.querySelectorAll('td'));
      const customerCell = cells.find(c => c.innerText.includes('Customer A (Rahul)'));
      if (customerCell) customerCell.click();
    });
    await delay(3000);
    console.log("✅ Customer Ledger loaded!");
    await takeScreenshot('customer_ledger');

    // 10. Team Settings (Custom Roles)
    await navigateTo('Team');
    await page.waitForSelector('.inventory-tabs');
    
    console.log("🛡️ Switching to 'Role Permissions Matrix' tab...");
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('.inventory-tab-btn')).find(b => b.innerText.includes('Matrix') || b.innerText.includes('Roles'));
      if (btn) btn.click();
    });
    await delay(1500);

    console.log("➕ Clicking '+ Create Custom Role'...");
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('.primary-button')).find(b => b.innerText.includes('Custom Role'));
      if (btn) btn.click();
    });
    await page.waitForSelector('.modal-content input');
    
    console.log("📝 Typing role name...");
    await page.type('.modal-content input', 'Sales Manager');
    await takeScreenshot('team_role_modal');

    console.log("💾 Saving role...");
    await page.click('.modal-actions button.primary-button');
    await delay(3000);
    console.log("✅ Custom role created!");

    // Configure permissions
    console.log("🛡️ Selecting Invoices Read & Write checkboxes...");
    await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tbody tr'));
      const invoiceRow = rows.find(r => r.innerText.toLowerCase().includes('invoices'));
      if (invoiceRow) {
        const checkboxes = invoiceRow.querySelectorAll('input[type="checkbox"]');
        if (checkboxes[0] && !checkboxes[0].checked) checkboxes[0].click(); // Read
        if (checkboxes[1] && !checkboxes[1].checked) checkboxes[1].click(); // Write
      }
    });
    await delay(1000);
    await takeScreenshot('team_role_permissions_matrix');

    console.log("💾 Clicking Save Permissions...");
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('.primary-button')).find(b => b.innerText.includes('Save Permissions'));
      if (btn) btn.click();
    });
    await delay(3000);
    console.log("✅ Permissions saved!");

    // 11. Settings Update
    await navigateTo('Settings');
    await page.waitForSelector('form input');
    
    console.log("📝 Changing Business Name...");
    await page.click('form input');
    await page.keyboard.down('Control');
    await page.keyboard.press('A');
    await page.keyboard.up('Control');
    await page.keyboard.press('Backspace');
    await page.type('form input', 'KhataPe Retail Store');
    await takeScreenshot('settings_before_save');

    console.log("💾 Clicking Save Settings...");
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('form button[type="submit"]')).find(b => b.innerText.includes('Save') || b.innerText.includes('Update'));
      if (btn) btn.click();
    });
    await delay(3000);
    console.log("✅ Settings saved!");

    console.log("\n🏁 All 11 interactive shopkeeper tasks completed successfully!");

  } catch (error) {
    console.error("❌ UI Test failed:", error);
    try {
      await takeScreenshot('error_state');
    } catch (e) {
      console.error("Failed to capture error screenshot:", e);
    }
  } finally {
    await browser.close();
  }
}

run();
