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

  try {
    console.log("Navigating to Vercel site...");
    await page.goto('https://khatape360.vercel.app/dashboard', { waitUntil: 'networkidle2' });
    
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
    await page.waitForSelector('.time-range-selector', { timeout: 15000 });

    const keys = await page.evaluate(() => {
      return Object.keys(window.localStorage);
    });

    console.log("LocalStorage Keys found on live site:", keys);

  } catch (err) {
    console.error("Diagnostic failed:", err);
  } finally {
    await browser.close();
  }
}

main();
