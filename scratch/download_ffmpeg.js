const https = require('https');
const fs = require('fs');
const path = require('path');

const url = 'https://raw.githubusercontent.com/brentvatne/ffmpeg-binaries/master/bin/ffmpeg.exe';
const dest = path.join(__dirname, 'ffmpeg.exe');

console.log(`Downloading ffmpeg.exe from ${url}...`);

function download(fileUrl, fileDest) {
  const file = fs.createWriteStream(fileDest);
  https.get(fileUrl, (response) => {
    // Handle redirects
    if (response.statusCode === 302 || response.statusCode === 301) {
      console.log(`Following redirect to ${response.headers.location}...`);
      download(response.headers.location, fileDest);
      return;
    }

    if (response.statusCode !== 200) {
      console.error(`Failed to download: ${response.statusCode} - ${response.statusMessage}`);
      return;
    }

    response.pipe(file);
    file.on('finish', () => {
      file.close();
      console.log('✅ ffmpeg.exe downloaded successfully!');
    });
  }).on('error', (err) => {
    fs.unlink(fileDest, () => {});
    console.error(`Error downloading file: ${err.message}`);
  });
}

download(url, dest);
