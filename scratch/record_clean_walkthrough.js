const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  console.log("🚀 Starting Puppeteer recording session for clean social media video...");

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
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2' });
    await page.waitForSelector('input[type="email"]');
    await delay(1000);

    // Typing sample email address visually to show in video
    console.log("2. Typing sample credentials visually...");
    await page.type('input[type="email"]', 'sample.business@gmail.com');
    await page.type('input[type="password"]', 'password123');
    await delay(1500);

    // Inject session token and redirect to dashboard
    console.log("3. Injecting database session token programmatically...");
    await page.evaluate(() => {
      const sessionData = {
        "access_token": "eyJhbGciOiJFUzI1NiIsImtpZCI6IjRiNzM0ZjY0LWY3NmQtNDkzNi1hMjVjLTMxYjNjOGZjZTk5NSIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2Z4bmJ6bmdubHFhYW9jbGpvbnp5LnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiJkMGZiMzk3MS1kODk5LTQwODAtYTIxMy00YjMzN2ViMzA2NmEiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzgyODk1MTkyLCJpYXQiOjE3ODI4OTE1OTIsImVtYWlsIjoicGFydGhhZ29zd2FtaWdAZ21haWwuY29tIiwicGhvbmUiOiIiLCJhcHBfbWV0YWRhdGEiOnsicHJvdmlkZXIiOiJlbWFpbCIsInByb3ZpZGVycyI6WyJlbWFpbCJdfSwidXNlcl9tZXRhZGF0YSI6eyJidXNpbmVzc19uYW1lIjoiQUJDIiwiZW1haWwiOiJwYXJ0aGFnb3N3YW1pZ0BnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwicGhvbmVfdmVyaWZpZWQiOmZhbHNlLCJzdWIiOiJkMGZiMzk3MS1kODk5LTQwODAtYTIxMy00YjMzN2ViMzA2NmEifSwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJhYWwiOiJhYWwxIiwiYW1yIjpbeyJtZXRob2QiOiJwYXNzd29yZCIsInRpbWVzdGFtcCI6MTc4Mjg5MTU5Mn1dLCJzZXNzaW9uX2lkIjoiYWI5N2YxN2QtZjlmMC00NWU5LWE1YTgtNTgxOWY4YjEwNmUxIiwiaXNfYW5vbnltb3VzIjpmYWxzZX0.QdI-EyNX9euV4j2lioGC88u8fRYjnT3JKfd7PPWSCrh0Iw0Xh855mIi4NLW5LCrm4M4ZE38nRBFJofQHlSz-eg",
        "token_type": "bearer",
        "expires_in": 3600,
        "expires_at": 1782895192,
        "refresh_token": "u5p3plg2di5y",
        "user": {
          "id": "d0fb3971-d899-4080-a213-4b337eb3066a",
          "aud": "authenticated",
          "role": "authenticated",
          "email": "sample.business@gmail.com",
          "email_confirmed_at": "2026-05-31T09:01:42.716158Z",
          "phone": "",
          "confirmation_sent_at": "2026-05-31T09:00:41.443134Z",
          "confirmed_at": "2026-05-31T09:01:42.716158Z",
          "last_sign_in_at": "2026-07-01T07:39:51.996954571Z",
          "app_metadata": { "provider": "email", "providers": ["email"] },
          "user_metadata": { "business_name": "ABC", "email": "sample.business@gmail.com", "email_verified": true, "phone_verified": false, "sub": "d0fb3971-d899-4080-a213-4b337eb3066a" },
          "identities": [],
          "created_at": "2026-05-31T09:00:41.438297Z",
          "updated_at": "2026-07-01T07:39:52.03931Z",
          "is_anonymous": false
        }
      };
      window.localStorage.setItem('sb-fxnbzngnlqaaocljonzy-auth-token', JSON.stringify(sessionData));
    });

    console.log("4. Simulating click and navigating to Dashboard...");
    await page.click('button[type="submit"]');
    await page.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle2' });
    await page.waitForSelector('.time-range-selector', { timeout: 15000 });
    await delay(1000);

    // Dismiss update modal if present
    await page.evaluate(() => {
      const overlay = document.querySelector('.update-modal-overlay');
      if (overlay) {
        const btn = Array.from(overlay.querySelectorAll('button')).find(b => b.innerText.includes('Later'));
        if (btn) btn.click();
      }
    });

    // Select This Year filter
    console.log("5. Clicking This Year statistics...");
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('.time-range-selector button')).find(b => b.innerText.includes('Year'));
      if (btn) btn.click();
    });
    await delay(2500);

    // Walkthrough all sidebar menu endpoints
    const pages = [
      '/customers',
      '/products',
      '/inventory',
      '/expenses',
      '/invoices',
      '/quotations',
      '/estimates',
      '/proforma',
      '/delivery-challans',
      '/credit-notes',
      '/purchases',
      '/purchase-returns',
      '/debit-notes',
      '/payments',
      '/accounting',
      '/reports',
      '/settings'
    ];

    for (const p of pages) {
      console.log(`🧭 Navigating to ${p}...`);
      await page.goto(`http://localhost:3000${p}`, { waitUntil: 'networkidle2' });
      await delay(2500);

      // Dismiss update modal if present
      await page.evaluate(() => {
        const overlay = document.querySelector('.update-modal-overlay');
        if (overlay) {
          const btn = Array.from(overlay.querySelectorAll('button')).find(b => b.innerText.includes('Later'));
          if (btn) btn.click();
        }
      });
    }

    // Go back to dashboard to finish cleanly
    console.log("🧭 Returning to Dashboard...");
    await page.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle2' });
    await delay(3000);

    console.log("🎉 Complete walkthrough recording finished successfully!");

  } catch (err) {
    console.error("❌ Seeding/Recording failed:", err);
  } finally {
    await browser.close();
  }
}

main();
