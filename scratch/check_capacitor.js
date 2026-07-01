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
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));

  try {
    console.log("Navigating to Vercel site...");
    await page.goto('https://khatape360.vercel.app/', { waitUntil: 'networkidle2' });
    
    const info = await page.evaluate(() => {
      return {
        protocol: window.location.protocol,
        hasCapacitor: !!window.Capacitor,
        capacitorKeys: window.Capacitor ? Object.keys(window.Capacitor) : null,
        capacitorPlatform: window.Capacitor ? window.Capacitor.platform : null,
        isNativeEvaluation: !!(window.Capacitor && window.Capacitor.platform !== 'web') || window.location.protocol === 'file:',
        bodyHtml: document.body.innerHTML.substring(0, 1000)
      };
    });

    console.log("Evaluation details:", JSON.stringify(info, null, 2));

  } catch (err) {
    console.error("Diagnostic failed:", err);
  } finally {
    await browser.close();
  }
}

main();
