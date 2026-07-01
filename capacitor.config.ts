import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.khatape.app',
  appName: 'KhataPe',
  webDir: 'build',
  server: {
    // Always load latest from Vercel — automatic OTA updates without rebuilding APK
    url: 'https://khatape360.vercel.app',
    cleartext: false,
    androidScheme: 'https',
  },
};

export default config;
