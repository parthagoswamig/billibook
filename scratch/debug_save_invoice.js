const puppeteer = require('puppeteer');
const fs = require('fs');

async function main() {
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

  const browser = await puppeteer.launch({
    headless: "new",
    executablePath
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  // Listen to browser console messages
  page.on('console', msg => console.log('PAGE CONSOLE:', msg.text()));

  try {
    console.log("Navigating to login...");
    await page.goto('https://khatape360.vercel.app/dashboard', { waitUntil: 'networkidle2' });
    await page.waitForSelector('input[type="email"]');

    // Dismiss update modal if present
    await page.evaluate(() => {
      const overlay = document.querySelector('.update-modal-overlay');
      if (overlay) {
        const btn = Array.from(overlay.querySelectorAll('button')).find(b => b.innerText.includes('Later'));
        if (btn) btn.click();
      }
    });

    console.log("Logging in...");
    await page.type('input[type="email"]', 'parthagoswamig@gmail.com');
    await page.type('input[type="password"]', '9800975588');
    await page.click('button[type="submit"]');

    console.log("Waiting for dashboard...");
    await page.waitForSelector('.stat-card', { timeout: 15000 });
    await new Promise(r => setTimeout(r, 1500));

    console.log("Navigating to Sales Invoices...");
    await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a.sidebar-link'));
      const salesLink = links.find(l => l.innerText.includes('Sales Invoice'));
      if (salesLink) salesLink.click();
    });
    await page.waitForSelector('.primary-button');
    await new Promise(r => setTimeout(r, 1000));

    console.log("Opening Create Modal...");
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button.primary-button')).find(b => b.innerText.includes('Create'));
      if (btn) btn.click();
    });
    await page.waitForSelector('.modal-content');
    await new Promise(r => setTimeout(r, 1000));

    console.log("Selecting Customer A...");
    await page.evaluate(() => {
      const select = document.querySelector('.invoice-fields-grid select');
      if (select) {
        const opt = Array.from(select.options).find(o => o.text.includes('Customer A'));
        if (opt) {
          select.value = opt.value;
          select.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    });

    console.log("Adding product Mustard Oil...");
    const inputSelector = '.spreadsheet-table tbody tr input.spreadsheet-input';
    await page.click(inputSelector);
    await page.type(inputSelector, 'Mustard Oil 1L');
    await new Promise(r => setTimeout(r, 1500));

    await page.evaluate(() => {
      const divs = Array.from(document.querySelectorAll('div'));
      const suggestion = divs.find(d => d.style.cursor === 'pointer' && d.innerText.includes('Stock:'));
      if (suggestion) suggestion.click();
    });
    await new Promise(r => setTimeout(r, 1000));

    console.log("Setting quantity to 2...");
    await page.evaluate(() => {
      const qtyInput = Array.from(document.querySelectorAll('input.spreadsheet-input'))[2];
      if (qtyInput) {
        qtyInput.value = '2';
        qtyInput.dispatchEvent(new Event('input', { bubbles: true }));
        qtyInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await new Promise(r => setTimeout(r, 1000));

    console.log("Clicking Save...");
    await page.click('.modal-actions button.primary-button');
    await new Promise(r => setTimeout(r, 4000));

    // Capture modal state or error message
    const errorText = await page.evaluate(() => {
      const errEl = document.querySelector('.form-message.form-error, .error-message');
      return errEl ? errEl.innerText : 'No visible UI error element';
    });
    console.log("UI Error message on save:", errorText);

    await page.screenshot({ path: 'scratch/ui_test_runs_3_records/save_invoice_debug_result.png' });
    console.log("📸 Screenshot saved to scratch/ui_test_runs_3_records/save_invoice_debug_result.png");

  } catch (err) {
    console.error("Execution failed:", err);
  } finally {
    await browser.close();
  }
}

main();
