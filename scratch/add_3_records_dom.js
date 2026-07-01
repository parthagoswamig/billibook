const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

// Create screenshots directory
const screenshotsDir = path.join(__dirname, 'ui_test_runs_3_records');
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
  console.log("🚀 Starting Puppeteer DOM Automation to add 3 records of everything...");
  const browser = await puppeteer.launch({
    headless: "new",
    executablePath,
    defaultViewport: { width: 1280, height: 800 }
  });

  const page = await browser.newPage();

  async function takeScreenshot(name) {
    const screenshotPath = path.join(screenshotsDir, `${name}.png`);
    await page.screenshot({ path: screenshotPath });
    console.log(`📸 Screenshot saved: ${screenshotPath}`);
  }

  try {
    // 1. LOGIN
    console.log("🔑 Navigating to Login Page...");
    await page.goto('https://khatape360.vercel.app/dashboard', { waitUntil: 'networkidle2' });
    await page.waitForSelector('input[type="email"]');
    await delay(1000);

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

    console.log("⏳ Waiting for Dashboard to load...");
    await page.waitForSelector('.time-range-selector', { timeout: 15000 });
    await delay(1500);
    console.log("✅ Logged in successfully!");

    // Helper for Navigation
    async function navigateTo(label) {
      console.log(`🧭 Navigating to sidebar option: ${label}...`);
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
          else throw new Error(`Link "${lbl}" not found.`);
        }
      }, label);
      await delay(2000);
    }

    // ==========================================
    // SECTION A: CREATE 3 SALES INVOICES
    // ==========================================
    const invoices = [
      { cust: 'Customer A', prod: 'Basmati Rice 5kg', qty: 3, paid: '500', label: 'invoice_1_partial' },
      { cust: 'Customer B', prod: 'Mustard Oil 1L', qty: 10, paid: '2124', label: 'invoice_2_full' },
      { cust: 'Customer C', prod: 'Sugar Premium 1kg', qty: 50, paid: '0', label: 'invoice_3_unpaid' }
    ];

    for (let i = 0; i < invoices.length; i++) {
      const inv = invoices[i];
      console.log(`\n📄 [Sales Invoice ${i+1}/3] Creating for ${inv.cust}...`);
      await navigateTo('Sales Invoice');
      await page.waitForSelector('.primary-button');

      // Click Create
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button.primary-button')).find(b => b.innerText.includes('Create') || b.innerText.includes('Add'));
        if (btn) btn.click();
      });
      await page.waitForSelector('.modal-content');
      await delay(1000);

      // Select Customer
      await page.evaluate((custName) => {
        const select = document.querySelector('.invoice-fields-grid select');
        if (select) {
          const opt = Array.from(select.options).find(o => o.text.includes(custName));
          if (opt) {
            select.value = opt.value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
      }, inv.cust);

      // Type Product Search
      const inputSelector = '.spreadsheet-table tbody tr input.spreadsheet-input';
      await page.click(inputSelector);
      await page.keyboard.down('Control');
      await page.keyboard.press('A');
      await page.keyboard.up('Control');
      await page.keyboard.press('Backspace');
      await page.type(inputSelector, inv.prod);
      await delay(1500);

      // Click suggestion
      await page.evaluate(() => {
        const divs = Array.from(document.querySelectorAll('div'));
        const suggestion = divs.find(d => d.style.cursor === 'pointer' && d.innerText.includes('Stock:'));
        if (suggestion) suggestion.click();
      });
      await delay(1000);

      // Set Qty with key presses and Tab to blur
      console.log(`🔢 Setting quantity: ${inv.qty}...`);
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
        await page.keyboard.type(String(inv.qty));
        await page.keyboard.press('Tab'); // Blur input to trigger React state calculate
        await delay(1500);
      }

      // Set Paid Amount
      console.log(`💵 Setting paid amount to: ${inv.paid}...`);
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
          await page.keyboard.type(String(inv.paid));
          await page.keyboard.press('Tab');
          await delay(1000);
        }
      }

      await takeScreenshot(`sales_${inv.label}`);
      
      // Save
      await page.click('.modal-actions button.primary-button');
      await delay(4000);
      console.log(`✅ Sales Invoice ${i+1}/3 saved!`);
    }

    // ==========================================
    // SECTION B: RECORD 3 PAYMENTS
    // ==========================================
    const payments = [
      { cust: 'Customer A', amt: '350', mode: 'Cash', note: 'Clear Invoice 1 balance', label: 'payment_1' },
      { cust: 'Customer C', amt: '1000', mode: 'UPI', note: 'Partial Invoice 3 payment', label: 'payment_2' },
      { cust: 'Customer A', amt: '500', mode: 'Card', note: 'Advance payment credit', label: 'payment_3' }
    ];

    for (let i = 0; i < payments.length; i++) {
      const pm = payments[i];
      console.log(`\n💳 [Payment Receipt ${i+1}/3] Recording for ${pm.cust}...`);
      await navigateTo('Payments');
      await page.waitForSelector('.primary-button');

      // Click + Record receipt
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button.primary-button')).find(b => b.innerText.includes('Record receipt') || b.innerText.includes('Record Payment'));
        if (btn) btn.click();
      });
      await page.waitForSelector('.modal-content');
      await delay(1000);

      // Select party
      await page.evaluate((custName) => {
        const select = document.querySelector('.modal-form select');
        if (select) {
          const opt = Array.from(select.options).find(o => o.text.includes(custName));
          if (opt) {
            select.value = opt.value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
      }, pm.cust);
      await delay(1000);

      // Set Amount
      await page.evaluate((amt) => {
        const inputs = Array.from(document.querySelectorAll('.modal-form input[type="number"]'));
        if (inputs[0]) {
          inputs[0].value = amt;
          inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
          inputs[0].dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, pm.amt);
      await delay(1000);

      // Click Auto Allocate if available
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Auto-Allocate'));
        if (btn) btn.click();
      });
      await delay(500);

      // Set Payment Mode
      await page.evaluate((mode) => {
        const selects = Array.from(document.querySelectorAll('.modal-form select'));
        const modeSelect = selects[1]; // Mode is the second select
        if (modeSelect) {
          modeSelect.value = mode;
          modeSelect.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, pm.mode);

      // Set Note
      await page.evaluate((noteText) => {
        const ta = document.querySelector('.modal-form textarea');
        if (ta) {
          ta.value = noteText;
          ta.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }, pm.note);

      await takeScreenshot(`payment_${pm.label}`);

      // Record
      await page.click('.modal-actions button.primary-button');
      await delay(4000);
      console.log(`✅ Payment Receipt ${i+1}/3 recorded!`);
    }

    // ==========================================
    // SECTION C: RECORD 3 EXPENSES
    // ==========================================
    const expenses = [
      { cat: 'Electricity', desc: 'Office AC Bill', amt: '2500', mode: 'UPI', label: 'expense_1' },
      { cat: 'Internet', desc: 'Broadband subscription', amt: '1200', mode: 'Bank Account', label: 'expense_2' },
      { cat: 'Snacks', desc: 'Tea and biscuits for clients', amt: '450', mode: 'Cash', label: 'expense_3' }
    ];

    for (let i = 0; i < expenses.length; i++) {
      const exp = expenses[i];
      console.log(`\n💸 [Expense ${i+1}/3] Recording category: ${exp.cat}...`);
      await navigateTo('Expenses');
      await page.waitForSelector('.primary-button');

      // Click Add
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button.primary-button')).find(b => b.innerText.includes('Add') || b.innerText.includes('Create'));
        if (btn) btn.click();
      });
      await page.waitForSelector('.modal-content');
      await delay(1000);

      // Set Category
      await page.evaluate((categoryVal) => {
        const select = document.querySelector('.modal-form select');
        if (select) {
          const opt = Array.from(select.options).find(o => o.text.toLowerCase().includes(categoryVal.toLowerCase()));
          if (opt) {
            select.value = opt.value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
      }, exp.cat);

      // Description & Amount
      const inputs = await page.$$('.modal-form input');
      if (inputs[0]) await inputs[0].type(exp.desc);
      if (inputs[1]) await inputs[1].type(exp.amt);

      // Payment Mode
      await page.evaluate((mode) => {
        const selects = Array.from(document.querySelectorAll('.modal-form select'));
        const modeSelect = selects[1];
        if (modeSelect) {
          const opt = Array.from(modeSelect.options).find(o => o.text.toLowerCase().includes(mode.toLowerCase()));
          if (opt) {
            modeSelect.value = opt.value;
            modeSelect.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
      }, exp.mode);

      await takeScreenshot(`expense_${exp.label}`);

      // Save
      await page.click('.modal-actions button.primary-button');
      await delay(3000);
      console.log(`✅ Expense ${i+1}/3 recorded!`);
    }

    // ==========================================
    // SECTION D: RECORD 3 STOCK ADJUSTMENTS
    // ==========================================
    const adjustments = [
      { prod: 'Basmati Rice 5kg', type: 'Add', qty: '15', reason: 'Correction', label: 'stock_adj_1' },
      { prod: 'Mustard Oil 1L', type: 'Reduce', qty: '5', reason: 'Damaged', label: 'stock_adj_2' },
      { prod: 'Sugar Premium 1kg', type: 'Add', qty: '25', reason: 'Correction', label: 'stock_adj_3' }
    ];

    for (let i = 0; i < adjustments.length; i++) {
      const adj = adjustments[i];
      console.log(`\n📦 [Stock Adjustment ${i+1}/3] Product: ${adj.prod}...`);
      await navigateTo('Inventory');
      await page.waitForSelector('.inventory-tabs');

      // Click Adjustment Tab
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('.inventory-tab-btn')).find(b => b.innerText.includes('Adjustment'));
        if (btn) btn.click();
      });
      await page.waitForSelector('form select');
      await delay(1000);

      // Select Product
      await page.evaluate((pName) => {
        const selects = Array.from(document.querySelectorAll('form select'));
        const prodSelect = selects[0];
        const opt = Array.from(prodSelect.options).find(o => o.text.includes(pName));
        if (opt) {
          prodSelect.value = opt.value;
          prodSelect.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, adj.prod);
      await delay(500);

      // Set Type (Add/Reduce)
      await page.evaluate((aType) => {
        const selects = Array.from(document.querySelectorAll('form select'));
        const typeSelect = selects[1];
        if (typeSelect) {
          typeSelect.value = aType;
          typeSelect.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, adj.type);
      await delay(500);

      // Set Quantity
      const qtyInput = await page.$('form input[type="number"]');
      await qtyInput.click();
      await page.keyboard.down('Control');
      await page.keyboard.press('A');
      await page.keyboard.up('Control');
      await page.keyboard.press('Backspace');
      await page.type('form input[type="number"]', adj.qty);

      // Set Reason
      await page.evaluate((rText) => {
        const selects = Array.from(document.querySelectorAll('form select'));
        const reasonSelect = selects[2];
        if (reasonSelect) {
          reasonSelect.value = rText;
          reasonSelect.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, adj.reason);

      await takeScreenshot(`inventory_${adj.label}`);

      // Submit
      await page.click('form button[type="submit"]');
      await delay(3500);
      console.log(`✅ Stock Adjustment ${i+1}/3 completed!`);
    }

    // ==========================================
    // SECTION E: CAPTURE FINAL DASHBOARD
    // ==========================================
    console.log("\n📊 Returning to Dashboard for final view...");
    await navigateTo('Dashboard');
    await takeScreenshot('final_dashboard_after_3_records');
    console.log("🎉 All 3 records for Invoices, Payments, Expenses, and Stock Adjustments completed via DOM automation!");

  } catch (error) {
    console.error("❌ Puppeteer Automation failed:", error);
    await takeScreenshot('automation_error');
  } finally {
    await browser.close();
  }
}

run();
