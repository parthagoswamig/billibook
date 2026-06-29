const puppeteer = require('puppeteer');

async function main() {
  // Find local Chrome path on Windows
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

    const data = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.stat-card'));
      return cards.map(c => {
        const valEl = c.querySelector('.stat-value');
        if (!valEl) return { label: c.innerText.substring(0, 100), hasValueEl: false };
        
        const style = window.getComputedStyle(valEl);
        return {
          label: c.innerText.substring(0, 100).replace(/\r?\n/g, ' '),
          hasValueEl: true,
          valText: valEl.innerText,
          color: style.color,
          display: style.display,
          visibility: style.visibility,
          opacity: style.opacity,
          fontSize: style.fontSize,
          height: style.height,
          offsetHeight: valEl.offsetHeight
        };
      });
    });

    console.log("=== COMPUTED STYLE DATA ===");
    console.log(JSON.stringify(data, null, 2));

  } catch (err) {
    console.error(err);
  } finally {
    await browser.close();
  }
}

main();
