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
    } catch (e) {
      // Ignore capture errors during quick page reloads
    }
  }, 100); // 10 FPS (every 100ms)
}

function stopRecording() {
  isRecording = false;
  clearInterval(recordingInterval);
  console.log(`📹 Captured ${frameCount} frames.`);
}

function compileVideo() {
  return new Promise((resolve, reject) => {
    console.log("🎬 Compiling frames into MP4 using ffmpeg...");
    
    const outputVideo = path.join(__dirname, '..', 'public', 'khatape_demo.mp4');
    
    // Ensure public directory exists
    const publicDir = path.dirname(outputVideo);
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }

    if (fs.existsSync(outputVideo)) {
      fs.unlinkSync(outputVideo);
    }

    const ffmpegArgs = [
      '-y',
      '-framerate', '10', // 10 FPS
      '-i', path.join(framesDir, 'frame_%05d.png'),
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-vf', 'scale=1280:-2',
      outputVideo
    ];

    console.log(`Running: ffmpeg ${ffmpegArgs.join(' ')}`);
    const ffmpeg = spawn(ffmpegPath, ffmpegArgs);

    ffmpeg.stdout.on('data', (data) => console.log(`ffmpeg: ${data}`));
    ffmpeg.stderr.on('data', (data) => {
      // ffmpeg output logs
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ MP4 Video created successfully at: ${outputVideo}`);
        resolve();
      } else {
        reject(new Error(`ffmpeg exited with code ${code}`));
      }
    });
  });
}

function cleanFrames() {
  console.log("🧹 Cleaning up temporary frame images...");
  if (fs.existsSync(framesDir)) {
    const files = fs.readdirSync(framesDir);
    for (const file of files) {
      fs.unlinkSync(path.join(framesDir, file));
    }
    fs.rmdirSync(framesDir);
  }
  console.log("✅ Cleanup complete!");
}

async function run() {
  const chromePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
  ];
  let executablePath;
  for (const p of chromePaths) {
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
    // Navigate to login page
    console.log("🧭 Opening Vercel site...");
    await page.goto('https://khatape360.vercel.app/', { waitUntil: 'networkidle2' });
    await delay(2000);

    // Clear any existing localStorage
    await page.evaluate(() => {
      window.localStorage.clear();
    });
    await page.reload({ waitUntil: 'networkidle2' });
    await page.waitForSelector('input[type="email"]');
    await delay(1500);

    // Dismiss update modal
    await page.evaluate(() => {
      const overlay = document.querySelector('.update-modal-overlay');
      if (overlay) {
        const btn = Array.from(overlay.querySelectorAll('button')).find(b => b.innerText.includes('Later'));
        if (btn) btn.click();
      }
    });

    // Start frame capture
    await recordFrames(page);

    // Type credentials slowly
    console.log("📝 Typing credentials...");
    await page.type('input[type="email"]', 'parthagoswamig@gmail.com', {delay: 50});
    await delay(500);
    await page.type('input[type="password"]', '9800975588', {delay: 50});
    await delay(2000);

    // Submit form
    console.log("🔑 Logging in...");
    await page.click('button[type="submit"]');
    
    // Wait for Dashboard
    await page.waitForSelector('.time-range-selector', { timeout: 15000 });
    await delay(3000);

    // Dismiss update modal if visible
    await page.evaluate(() => {
      const overlay = document.querySelector('.update-modal-overlay');
      if (overlay) {
        const btn = Array.from(overlay.querySelectorAll('button')).find(b => b.innerText.includes('Later'));
        if (btn) btn.click();
      }
    });

    // Select This Year filter
    console.log("📈 Selecting 'This Year' metrics filter...");
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('.time-range-selector button')).find(b => b.innerText.includes('Year'));
      if (btn) btn.click();
    });
    await delay(3500); // Wait longer on dashboard

    // Sidebar navigation flow
    const flow = [
      { name: 'Parties', path: '/customers', showForm: true, formBtnText: 'Add' },
      { name: 'Products', path: '/products', showForm: true, formBtnText: 'Add' },
      { name: 'Inventory', path: '/inventory', showForm: true, formBtnText: 'Stock' },
      { name: 'Expenses', path: '/expenses', showForm: true, formBtnText: 'Add' },
      { name: 'Sales Invoice', path: '/invoices', showForm: true, formBtnText: 'Create' },
      { name: 'Quotation', path: '/quotations', showForm: true, formBtnText: 'Create' },
      { name: 'Estimate', path: '/estimates', showForm: true, formBtnText: 'Create' },
      { name: 'Proforma', path: '/proforma', showForm: true, formBtnText: 'Create' },
      { name: 'Delivery Challan', path: '/delivery-challans', showForm: true, formBtnText: 'Create' },
      { name: 'Credit Note', path: '/credit-notes', showForm: true, formBtnText: 'Create' },
      { name: 'Purchase Bill', path: '/purchases', showForm: true, formBtnText: 'Create' },
      { name: 'Purchase Return', path: '/purchase-returns', showForm: true, formBtnText: 'Create' },
      { name: 'Debit Note', path: '/debit-notes', showForm: true, formBtnText: 'Create' },
      { name: 'Payments', path: '/payments', showForm: false },
      { name: 'Accounting Books', path: '/accounting', showForm: false },
      { name: 'Migration', path: '/migration', showForm: false },
      { name: 'Reports & GST', path: '/reports', showForm: false },
      { name: 'Settings', path: '/settings', showForm: false }
    ];

    for (const step of flow) {
      console.log(`🧭 Navigating to ${step.name} (${step.path})...`);
      await page.goto(`https://khatape360.vercel.app${step.path}`, { waitUntil: 'networkidle2' });
      await delay(2500); // Slower pause to view page

      // Dismiss update modal if visible
      await page.evaluate(() => {
        const overlay = document.querySelector('.update-modal-overlay');
        if (overlay) {
          const btn = Array.from(overlay.querySelectorAll('button')).find(b => b.innerText.includes('Later'));
          if (btn) btn.click();
        }
      });

      if (step.showForm) {
        console.log(`🎨 Opening ${step.name} Form...`);
        const clicked = await page.evaluate((btnText) => {
          // Search in buttons and links
          const elements = Array.from(document.querySelectorAll('button, a'));
          const btn = elements.find(el => el.innerText.includes(btnText));
          if (btn) {
            btn.click();
            return true;
          }
          return false;
        }, step.formBtnText);

        if (clicked) {
          await delay(3500); // Wait longer with form open
          
          console.log(`🎨 Closing ${step.name} Form...`);
          await page.evaluate(() => {
            const closeBtn = document.querySelector('.modal-close, .btn-close');
            if (closeBtn) {
              closeBtn.click();
            } else {
              const elements = Array.from(document.querySelectorAll('button, a'));
              const cancelBtn = elements.find(el => el.innerText.toLowerCase().includes('cancel') || el.innerText.toLowerCase().includes('close'));
              if (cancelBtn) cancelBtn.click();
            }
          });
          await delay(1500);
        } else {
          console.log(`⚠️ Could not find '${step.formBtnText}' button for ${step.name}`);
        }
      } else {
        await delay(2500);
      }
    }

    // Go back to Dashboard to end
    console.log("🧭 Returning to Dashboard...");
    await page.goto('https://khatape360.vercel.app/dashboard', { waitUntil: 'networkidle2' });
    await delay(4000);

    stopRecording();
    await browser.close();

    // Compile into MP4
    await compileVideo();
    cleanFrames();

    console.log("🎉 social media video successfully compiled!");

  } catch (error) {
    console.error("❌ Recording failed:", error);
    stopRecording();
    await browser.close();
    cleanFrames();
  }
}

run();
