const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const screenshotsDir = path.join(__dirname, 'ui_test_runs_all_sidebar');
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

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
  console.log("🚀 Starting DOM Automation to populate all sidebar options with 3 records each...");
  const browser = await puppeteer.launch({
    headless: "new",
    executablePath,
    defaultViewport: { width: 1280, height: 800 }
  });

  const page = await browser.newPage();

  async function takeScreenshot(name) {
    const screenshotPath = path.join(screenshotsDir, `${name}.png`);
    await page.screenshot({ path: screenshotPath });
    console.log(`📸 Screenshot: ${name}`);
  }

  try {
    // 1. LOGIN
    console.log("🔑 Navigating to Login Page...");
    await page.goto('https://khatape360.vercel.app/dashboard', { waitUntil: 'networkidle2' });
    await page.waitForSelector('input[type="email"]');
    await delay(500);

    // Dismiss update modal if present
    await page.evaluate(() => {
      const overlay = document.querySelector('.update-modal-overlay');
      if (overlay) {
        const btn = Array.from(overlay.querySelectorAll('button')).find(b => b.innerText.includes('Later'));
        if (btn) btn.click();
      }
    });

    console.log("📝 Logging in...");
    await page.type('input[type="email"]', 'parthagoswamig@gmail.com');
    await page.type('input[type="password"]', '9800975588');
    await page.click('button[type="submit"]');
    await page.waitForSelector('.time-range-selector', { timeout: 15000 });
    await delay(500);
    console.log("✅ Logged in!");

    // Helper to Navigate Directly to URL (Faster than sidebar clicks)
    async function gotoPage(urlPath) {
      console.log(`🧭 Navigating directly to URL: ${urlPath}...`);
      await page.goto(`https://khatape360.vercel.app${urlPath}`, { waitUntil: 'networkidle2' });
      await delay(1000);
      // Dismiss update modal if present
      await page.evaluate(() => {
        const overlay = document.querySelector('.update-modal-overlay');
        if (overlay) {
          const btn = Array.from(overlay.querySelectorAll('button')).find(b => b.innerText.includes('Later'));
          if (btn) btn.click();
        }
      });
      await delay(500);
    }

    // ==========================================
    // 1. ADD PARTIES (3 CUSTOMERS & 3 SUPPLIERS)
    // ==========================================
    const parties = [
      { type: 'customer', name: 'Cust X', phone: '9999911111', state: 'West Bengal' },
      { type: 'customer', name: 'Cust Y', phone: '9999922222', state: 'West Bengal' },
      { type: 'customer', name: 'Cust Z', phone: '9999932222', state: 'West Bengal' },
      { type: 'supplier', name: 'Supp X', phone: '8888811111', state: 'West Bengal' },
      { type: 'supplier', name: 'Supp Y', phone: '8888822222', state: 'West Bengal' },
      { type: 'supplier', name: 'Supp Z', phone: '8888832222', state: 'West Bengal' }
    ];

    for (const party of parties) {
      console.log(`👤 Adding ${party.type}: ${party.name}...`);
      await gotoPage('/customers');
      await page.waitForSelector('.filter-tabs');

      // Click correct tab (Customer/Supplier)
      await page.evaluate((t) => {
        const btn = Array.from(document.querySelectorAll('.filter-tab')).find(b => b.innerText.toLowerCase().includes(t));
        if (btn) btn.click();
      }, party.type);
      await delay(500);

      // Click + Add
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button.primary-button')).find(b => b.innerText.includes('Add'));
        if (btn) btn.click();
      });
      await page.waitForSelector('.modal-content');
      await delay(500);

      // Fill Name and Phone
      await page.evaluate((p) => {
        const labels = Array.from(document.querySelectorAll('.modal-form label'));
        const nameLabel = labels.find(l => l.innerText.includes('Name'));
        const nameInput = nameLabel.querySelector('input');
        nameInput.value = p.name;
        nameInput.dispatchEvent(new Event('input', { bubbles: true }));

        const phoneLabel = labels.find(l => l.innerText.includes('Phone'));
        const phoneInput = phoneLabel.querySelector('input');
        phoneInput.value = p.phone;
        phoneInput.dispatchEvent(new Event('input', { bubbles: true }));

        const stateSelect = document.querySelector('.modal-form select');
        if (stateSelect) {
          stateSelect.value = p.state;
          stateSelect.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, party);

      // Save
      await page.click('.modal-form button[type="submit"]');
      await delay(2000);
    }
    console.log("✅ 3 Customers & 3 Suppliers Added!");
    await takeScreenshot('parties_list');

    // ==========================================
    // 2. ADD 3 PRODUCTS
    // ==========================================
    const products = [
      { name: 'Prod X', stock: '120', sale: '150', purchase: '120' },
      { name: 'Prod Y', stock: '200', sale: '80', purchase: '60' },
      { name: 'Prod Z', stock: '75', sale: '250', purchase: '180' }
    ];

    for (const prod of products) {
      console.log(`📦 Adding product: ${prod.name}...`);
      await gotoPage('/products');
      await page.waitForSelector('button.primary-button');

      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button.primary-button')).find(b => b.innerText.includes('Add'));
        if (btn) btn.click();
      });
      await page.waitForSelector('.modal-content');
      await delay(500);

      // Fill name, stock, sale, purchase price
      await page.evaluate((p) => {
        const labels = Array.from(document.querySelectorAll('.modal-form label'));
        const nameLabel = labels.find(l => l.innerText.includes('Product Name'));
        const nameInput = nameLabel.querySelector('input');
        nameInput.value = p.name;
        nameInput.dispatchEvent(new Event('input', { bubbles: true }));

        const stockLabel = labels.find(l => l.innerText.includes('Opening Stock'));
        const stockInput = stockLabel.querySelector('input');
        stockInput.value = p.stock;
        stockInput.dispatchEvent(new Event('input', { bubbles: true }));

        const saleLabel = labels.find(l => l.innerText.includes('Sale Price'));
        const saleInput = saleLabel.querySelector('input');
        saleInput.value = p.sale;
        saleInput.dispatchEvent(new Event('input', { bubbles: true }));

        const purchaseLabel = labels.find(l => l.innerText.includes('Purchase Price'));
        const purchaseInput = purchaseLabel.querySelector('input');
        purchaseInput.value = p.purchase;
        purchaseInput.dispatchEvent(new Event('input', { bubbles: true }));
      }, prod);

      // Save
      await page.click('.modal-form button[type="submit"]');
      await delay(2000);
    }
    console.log("✅ 3 Products Added!");
    await takeScreenshot('products_list');

    // ==========================================
    // 3. BULK DOCUMENT GENERATION (Estimates, Quotations, Proformas, Challans, Credit Notes, Purchases, Purchase Returns, Debit Notes)
    // ==========================================
    const documentTypes = [
      { path: '/estimates', label: 'estimate', party: 'Cust X', prod: 'Prod X', qty: 5, paid: '0' },
      { path: '/estimates', label: 'estimate', party: 'Cust Y', prod: 'Prod Y', qty: 10, paid: '0' },
      { path: '/estimates', label: 'estimate', party: 'Cust Z', prod: 'Prod Z', qty: 2, paid: '0' },

      { path: '/quotations', label: 'quotation', party: 'Cust X', prod: 'Prod X', qty: 3, paid: '0' },
      { path: '/quotations', label: 'quotation', party: 'Cust Y', prod: 'Prod Y', qty: 25, paid: '0' },
      { path: '/quotations', label: 'quotation', party: 'Cust Z', prod: 'Prod Z', qty: 1, paid: '0' },

      { path: '/proforma', label: 'proforma_invoice', party: 'Cust X', prod: 'Prod X', qty: 8, paid: '0' },
      { path: '/proforma', label: 'proforma_invoice', party: 'Cust Y', prod: 'Prod Y', qty: 15, paid: '0' },
      { path: '/proforma', label: 'proforma_invoice', party: 'Cust Z', prod: 'Prod Z', qty: 4, paid: '0' },

      { path: '/delivery-challans', label: 'delivery_challan', party: 'Cust X', prod: 'Prod X', qty: 12, paid: '0' },
      { path: '/delivery-challans', label: 'delivery_challan', party: 'Cust Y', prod: 'Prod Y', qty: 30, paid: '0' },
      { path: '/delivery-challans', label: 'delivery_challan', party: 'Cust Z', prod: 'Prod Z', qty: 6, paid: '0' },

      { path: '/credit-notes', label: 'credit_note', party: 'Cust X', prod: 'Prod X', qty: 2, paid: '0' },
      { path: '/credit-notes', label: 'credit_note', party: 'Cust Y', prod: 'Prod Y', qty: 5, paid: '0' },
      { path: '/credit-notes', label: 'credit_note', party: 'Cust Z', prod: 'Prod Z', qty: 1, paid: '0' },

      { path: '/purchases', label: 'purchase_bill', party: 'Supp X', prod: 'Prod X', qty: 20, paid: '2400' },
      { path: '/purchases', label: 'purchase_bill', party: 'Supp Y', prod: 'Prod Y', qty: 50, paid: '3000' },
      { path: '/purchases', label: 'purchase_bill', party: 'Supp Z', prod: 'Prod Z', qty: 10, paid: '1800' },

      { path: '/purchase-returns', label: 'purchase_return', party: 'Supp X', prod: 'Prod X', qty: 2, paid: '0' },
      { path: '/purchase-returns', label: 'purchase_return', party: 'Supp Y', prod: 'Prod Y', qty: 5, paid: '0' },
      { path: '/purchase-returns', label: 'purchase_return', party: 'Supp Z', prod: 'Prod Z', qty: 1, paid: '0' },

      { path: '/debit-notes', label: 'debit_note', party: 'Supp X', prod: 'Prod X', qty: 1, paid: '0' },
      { path: '/debit-notes', label: 'debit_note', party: 'Supp Y', prod: 'Prod Y', qty: 4, paid: '0' },
      { path: '/debit-notes', label: 'debit_note', party: 'Supp Z', prod: 'Prod Z', qty: 2, paid: '0' }
    ];

    let currentPath = '';
    for (let idx = 0; idx < documentTypes.length; idx++) {
      const doc = documentTypes[idx];
      console.log(`📄 Creating ${doc.label} (${idx % 3 + 1}/3) for ${doc.party}...`);

      if (currentPath !== doc.path) {
        currentPath = doc.path;
        await gotoPage(doc.path);
      }
      await page.waitForSelector('.primary-button');

      // Click Create/Add
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button.primary-button')).find(b => b.innerText.includes('Create') || b.innerText.includes('Add'));
        if (btn) btn.click();
      });
      await page.waitForSelector('.modal-content');
      await delay(800);

      // Select party (Customer/Supplier)
      await page.evaluate((partyName) => {
        const select = document.querySelector('.invoice-fields-grid select');
        if (select) {
          const opt = Array.from(select.options).find(o => o.text.includes(partyName));
          if (opt) {
            select.value = opt.value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
      }, doc.party);
      await delay(500);

      // Type Product Search
      const inputSelector = '.spreadsheet-table tbody tr input.spreadsheet-input';
      await page.click(inputSelector);
      await page.keyboard.down('Control');
      await page.keyboard.press('A');
      await page.keyboard.up('Control');
      await page.keyboard.press('Backspace');
      await page.type(inputSelector, doc.prod);
      await delay(1200);

      // Click suggestion
      await page.evaluate(() => {
        const divs = Array.from(document.querySelectorAll('div'));
        const suggestion = divs.find(d => d.style.cursor === 'pointer' && d.innerText.includes('Stock:'));
        if (suggestion) suggestion.click();
      });
      await delay(800);

      // Set Qty
      const qtyInputEl = await page.evaluateHandle(() => {
        const inputs = Array.from(document.querySelectorAll('input.spreadsheet-input'));
        return inputs[2]; // usually 3rd input in row
      });
      if (qtyInputEl) {
        await qtyInputEl.click();
        await page.keyboard.down('Control');
        await page.keyboard.press('A');
        await page.keyboard.up('Control');
        await page.keyboard.press('Backspace');
        await page.keyboard.type(String(doc.qty));
        await page.keyboard.press('Tab'); // Blur input to trigger calculations
        await delay(1000);
      }

      // Set Paid Amount
      const paidInputHandle = await page.evaluateHandle(() => {
        const labels = Array.from(document.querySelectorAll('.modal-content label'));
        const paidLabel = labels.find(l => l.innerText.includes('Amount Paid'));
        return paidLabel ? paidLabel.querySelector('input') : null;
      });
      if (paidInputHandle) {
        const inputEl = paidInputHandle.asElement();
        if (inputEl) {
          await inputEl.click();
          await page.keyboard.down('Control');
          await page.keyboard.press('A');
          await page.keyboard.up('Control');
          await page.keyboard.press('Backspace');
          await page.keyboard.type(String(doc.paid));
          await page.keyboard.press('Tab');
          await delay(800);
        }
      }

      // Save
      await page.click('.modal-actions button.primary-button');
      await delay(3500);

      // Take screenshot of first completed list of each doc kind
      if (idx % 3 === 2) {
        await takeScreenshot(`${doc.label}_list_complete`);
      }
    }

    console.log("🎉 Successfully added 3 records for all sidebar document and party configurations!");

  } catch (error) {
    console.error("❌ Puppeteer Automation failed:", error);
    await takeScreenshot('automation_all_error');
  } finally {
    await browser.close();
  }
}

run();
