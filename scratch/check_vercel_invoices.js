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
    
    console.log("Navigating to Invoices...");
    await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a.sidebar-link'));
      const salesLink = links.find(l => l.innerText.includes('Sales Invoice'));
      if (salesLink) salesLink.click();
    });
    await page.waitForSelector('.simple-table', { timeout: 10000 });
    await new Promise(r => setTimeout(r, 2000));

    const invoiceRows = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('.simple-table tbody tr'));
      return rows.map(r => r.innerText.replace(/\r?\n/g, ' '));
    });

    console.log("=== INVOICES RENDERED ON PAGE ===");
    console.log(invoiceRows);

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await browser.close();
  }
}

main();
