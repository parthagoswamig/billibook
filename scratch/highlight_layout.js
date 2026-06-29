const puppeteer = require('puppeteer');

async function main() {
  const paths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
  ];
  const fs = require('fs');
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
    await new Promise(r => setTimeout(r, 2000));

    console.log("Highlighting elements...");
    await page.evaluate(() => {
      document.querySelectorAll('.stat-card').forEach(c => {
        c.style.border = '2px solid red';
        const header = c.querySelector('.stat-header');
        if (header) header.style.border = '2px solid blue';
        const val = c.querySelector('.stat-value');
        if (val) val.style.border = '2px solid green';
        const footer = c.querySelector('.stat-footer');
        if (footer) footer.style.border = '2px solid orange';
      });
    });

    const screenshotPath = 'scratch/ui_test_runs/highlighted_layout.png';
    await page.screenshot({ path: screenshotPath });
    console.log("📸 Highlighted screenshot saved to " + screenshotPath);

  } catch (err) {
    console.error(err);
  } finally {
    await browser.close();
  }
}

main();
