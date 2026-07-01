const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  console.log("🚀 Debugging live site view for parthagoswamig@gmail.com...");

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
    executablePath,
    defaultViewport: { width: 1280, height: 800 }
  });

  const page = await browser.newPage();

  try {
    console.log("1. Navigating to Login Page...");
    await page.goto('https://khatape360.vercel.app/', { waitUntil: 'networkidle2' });
    await page.waitForSelector('input[type="email"]');
    await delay(1000);

    // Dismiss update modal
    await page.evaluate(() => {
      const overlay = document.querySelector('.update-modal-overlay');
      if (overlay) {
        const btn = Array.from(overlay.querySelectorAll('button')).find(b => b.innerText.includes('Later'));
        if (btn) btn.click();
      }
    });

    console.log("2. Logging in with real credentials...");
    await page.type('input[type="email"]', 'parthagoswamig@gmail.com');
    await page.type('input[type="password"]', '9800975588');
    await page.click('button[type="submit"]');
    
    console.log("3. Waiting for dashboard...");
    await page.waitForSelector('.time-range-selector', { timeout: 15000 });
    await delay(2000);

    // Take screenshot of dashboard default
    await page.screenshot({ path: path.join(__dirname, 'debug_dashboard_default.png') });
    console.log("📸 Saved debug_dashboard_default.png");

    // Click 'This Year'
    console.log("4. Clicking 'This Year' filter...");
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('.time-range-selector button')).find(b => b.innerText.includes('Year'));
      if (btn) btn.click();
    });
    await delay(2000);
    await page.screenshot({ path: path.join(__dirname, 'debug_dashboard_year.png') });
    console.log("📸 Saved debug_dashboard_year.png");

    // Go to Invoices
    console.log("5. Checking Invoices Page...");
    await page.goto('https://khatape360.vercel.app/invoices', { waitUntil: 'networkidle2' });
    await delay(2000);
    await page.screenshot({ path: path.join(__dirname, 'debug_invoices_page.png') });
    console.log("📸 Saved debug_invoices_page.png");

    // Go to Customers
    console.log("6. Checking Customers Page...");
    await page.goto('https://khatape360.vercel.app/customers', { waitUntil: 'networkidle2' });
    await delay(2000);
    await page.screenshot({ path: path.join(__dirname, 'debug_customers_page.png') });
    console.log("📸 Saved debug_customers_page.png");

  } catch (err) {
    console.error("❌ Debug failed:", err);
  } finally {
    await browser.close();
  }
}

main();
