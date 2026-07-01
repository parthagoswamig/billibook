const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

const framesDir = path.join(__dirname, 'video_frames');
if (!fs.existsSync(framesDir)) {
  fs.mkdirSync(framesDir, { recursive: true });
}

let frameCount = 0;
let isRecording = false;
let recordingInterval;

async function recordFrames(page) {
  isRecording = true;
  console.log("📹 Starting frame capture at 10 FPS...");
  recordingInterval = setInterval(async () => {
    if (!isRecording) return;
    try {
      frameCount++;
      const filename = path.join(framesDir, `frame_${String(frameCount).padStart(5, '0')}.png`);
      await page.screenshot({ path: filename });
    } catch (e) {}
  }, 100);
}

function stopRecording() {
  isRecording = false;
  clearInterval(recordingInterval);
  console.log(`📹 Captured ${frameCount} frames.`);
}

function compileVideo() {
  return new Promise((resolve, reject) => {
    console.log("🎬 Compiling frames into MP4...");
    const outputVideo = path.join(__dirname, '..', 'public', 'khatape_demo.mp4');
    if (fs.existsSync(outputVideo)) fs.unlinkSync(outputVideo);
    const ffmpegArgs = [
      '-y', '-framerate', '10',
      '-i', path.join(framesDir, 'frame_%05d.png'),
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
      '-vf', 'scale=1280:-2',
      outputVideo
    ];
    const ffmpeg = spawn(ffmpegPath, ffmpegArgs);
    ffmpeg.on('close', (code) => {
      if (code === 0) { console.log(`✅ Video saved: ${outputVideo}`); resolve(); }
      else reject(new Error(`ffmpeg error code ${code}`));
    });
  });
}

function cleanFrames() {
  if (fs.existsSync(framesDir)) {
    for (const f of fs.readdirSync(framesDir)) fs.unlinkSync(path.join(framesDir, f));
    fs.rmdirSync(framesDir);
  }
  console.log("✅ Frames cleaned up.");
}

async function clickSidebarLink(page, labelText) {
  console.log(`🔗 Clicking sidebar: ${labelText}...`);
  const clicked = await page.evaluate((text) => {
    const links = Array.from(document.querySelectorAll('.sidebar-link'));
    const link = links.find(l => l.innerText.includes(text));
    if (link) { link.click(); return true; }
    return false;
  }, labelText);
  if (!clicked) console.log(`  ⚠️ Sidebar link "${labelText}" not found — navigating directly`);
  return clicked;
}

async function openHamburger(page) {
  // Open hamburger/mobile menu if sidebar is hidden
  await page.evaluate(() => {
    const ham = document.querySelector('.hamburger-btn, .menu-toggle, .sidebar-toggle, [aria-label="menu"]');
    if (ham) ham.click();
  });
  await delay(500);
}

async function clickAddOrCreate(page, pageName) {
  const found = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('button, a'));
    const btn = els.find(el => {
      const t = el.innerText?.trim() || '';
      return t.startsWith('+ Add') || t.startsWith('Add ') || t.startsWith('Create ') || t.startsWith('+ Create') || t === 'Add' || t === 'Create' || t.includes('Stock');
    });
    if (btn) { btn.click(); return btn.innerText.trim(); }
    return null;
  });
  if (found) console.log(`  ✅ Opened form: "${found}"`);
  else console.log(`  ⚠️ No Add/Create button found on ${pageName}`);
  return !!found;
}

async function closeModal(page) {
  await page.evaluate(() => {
    const closeBtn = document.querySelector('.modal-close, .btn-close, [aria-label="close"]');
    if (closeBtn) { closeBtn.click(); return; }
    const btns = Array.from(document.querySelectorAll('button'));
    const cancel = btns.find(b => b.innerText.toLowerCase().includes('cancel') || b.innerText.toLowerCase().includes('close'));
    if (cancel) cancel.click();
  });
  await delay(1000);
}

async function run() {
  const chromePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
  ];
  let executablePath;
  for (const p of chromePaths) { if (fs.existsSync(p)) { executablePath = p; break; } }

  const browser = await puppeteer.launch({
    headless: "new",
    executablePath,
    defaultViewport: { width: 1280, height: 800 }
  });

  const page = await browser.newPage();

  try {
    console.log("🧭 Opening KhataPe...");
    await page.goto('https://khatape360.vercel.app/', { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(2000);

    // Reset session so we see a clean login
    await page.evaluate(() => window.localStorage.clear());
    await page.reload({ waitUntil: 'networkidle2' });
    await page.waitForSelector('input[type="email"]', { timeout: 15000 });
    await delay(1500);

    // Inject CSS to visually mask the email field (shows dots like a password field)
    // Real credentials are typed properly so React controlled inputs work correctly
    await page.addStyleTag({
      content: `
        input[type="email"] {
          -webkit-text-security: disc !important;
          color: #333 !important;
        }
      `
    });

    await recordFrames(page);

    // Type real credentials (React controlled inputs need proper typing events)
    await page.click('input[type="email"]');
    await page.type('input[type="email"]', 'parthagoswamig@gmail.com', { delay: 60 });
    await delay(500);
    await page.click('input[type="password"]');
    await page.type('input[type="password"]', '9800975588', { delay: 60 });
    await delay(1500);

    // Click Sign In
    console.log("🔑 Signing in...");
    await page.click('button[type="submit"]');
    await page.waitForSelector('.sidebar, .sidebar-link, .dashboard-stats', { timeout: 20000 });
    await delay(3000);

    // Dismiss any update modal
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const later = btns.find(b => b.innerText.includes('Later') || b.innerText.includes('Dismiss'));
      if (later) later.click();
    });
    await delay(1000);

    // Dashboard - show "This Year"
    console.log("📊 Dashboard...");
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const yr = btns.find(b => b.innerText.includes('Year'));
      if (yr) yr.click();
    });
    await delay(4000);

    const sidebarFlow = [
      { label: 'Parties', path: '/customers', form: true },
      { label: 'Products', path: '/products', form: true },
      { label: 'Inventory', path: '/inventory', form: true },
      { label: 'Expenses', path: '/expenses', form: true },
      { label: 'Sales Invoice', path: '/invoices', form: true },
      { label: 'Quotation', path: '/quotations', form: true },
      { label: 'Estimate', path: '/estimates', form: true },
      { label: 'Proforma', path: '/proforma', form: true },
      { label: 'Delivery Challan', path: '/delivery-challans', form: true },
      { label: 'Credit Note', path: '/credit-notes', form: true },
      { label: 'Purchase Bill', path: '/purchases', form: true },
      { label: 'Purchase Return', path: '/purchase-returns', form: true },
      { label: 'Debit Note', path: '/debit-notes', form: true },
      { label: 'Payments', path: '/payments', form: false },
      { label: 'Accounting Books', path: '/accounting', form: false },
      { label: 'Migration', path: '/migration', form: false },
      { label: 'Reports & GST', path: '/reports', form: false },
      { label: 'Settings', path: '/settings', form: false },
    ];

    for (const step of sidebarFlow) {
      console.log(`\n🧭 → ${step.label}`);
      // Navigate via URL (reliable), sidebar highlighting happens automatically
      await page.goto(`https://khatape360.vercel.app${step.path}`, { waitUntil: 'networkidle2', timeout: 20000 });
      // Dismiss modal
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const later = btns.find(b => b.innerText.includes('Later') || b.innerText.includes('Dismiss'));
        if (later) later.click();
      });
      await delay(3000); // View the page list

      if (step.form) {
        const opened = await clickAddOrCreate(page, step.label);
        if (opened) {
          await delay(3500); // View the form for a while
          await closeModal(page);
          await delay(1500);
        }
      } else {
        await delay(3000); // Extra time for info pages
      }
    }

    // Return to dashboard at end
    console.log("\n🏠 Back to Dashboard...");
    await page.goto('https://khatape360.vercel.app/dashboard', { waitUntil: 'networkidle2' });
    await delay(5000);

    stopRecording();
    await browser.close();
    await compileVideo();
    cleanFrames();

    console.log("\n🎉 Video recording complete! File: public/khatape_demo.mp4");

  } catch (err) {
    console.error("❌ Error:", err.message);
    stopRecording();
    try { await browser.close(); } catch {}
    cleanFrames();
  }
}

run();
