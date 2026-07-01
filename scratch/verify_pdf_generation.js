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
  await page.setViewport({ width: 1280, height: 1000 });

  try {
    console.log("Navigating to login...");
    await page.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle2' });
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
    await new Promise(r => setTimeout(r, 2000));

    console.log("Navigating to Invoices...");
    await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a.sidebar-link'));
      const salesLink = links.find(l => l.innerText.includes('Sales Invoice'));
      if (salesLink) salesLink.click();
    });
    await page.waitForSelector('.simple-table', { timeout: 10000 });
    await new Promise(r => setTimeout(r, 2000));

    console.log("Clicking on invoice row...");
    await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('.simple-table tbody tr'));
      // Find the row for INV-2026-001
      const row = rows.find(r => r.innerText.includes('INV-2026-001'));
      if (row) {
        row.click();
      } else if (rows.length > 0) {
        rows[0].click(); // fallback to first row
      }
    });

    console.log("Waiting for Invoice details page to load...");
    await page.waitForSelector('.billbook-invoice-wrapper', { timeout: 10000 });
    await new Promise(r => setTimeout(r, 2000));

    console.log("Capturing screen layout screenshot...");
    await page.screenshot({ path: 'scratch/ui_test_runs_3_records/new_invoice_screen_layout.png' });
    console.log("📸 Screenshot saved to scratch/ui_test_runs_3_records/new_invoice_screen_layout.png");

    console.log("Printing invoice to PDF...");
    await page.pdf({
      path: 'scratch/ui_test_runs_3_records/new_invoice_print.pdf',
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20px',
        bottom: '20px',
        left: '20px',
        right: '20px'
      }
    });
    console.log("📄 PDF invoice saved to scratch/ui_test_runs_3_records/new_invoice_print.pdf");

  } catch (err) {
    console.error("Verification failed:", err);
  } finally {
    await browser.close();
  }
}

main();
