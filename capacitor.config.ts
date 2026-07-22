import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.jobsmatchnow.app',
  appName: 'JobsMatchNow',
  webDir: 'dist',
  // Load the LIVE web app so the native build always mirrors production
  // (never a stale bundled snapshot). Override with CAP_SERVER_URL for local dev.
  server: { url: process.env.CAP_SERVER_URL || 'https://jobsmatchnow.com/app/', androidScheme: 'https', cleartext: false },
  plugins: {
    SplashScreen: { launchShowDuration: 1200, backgroundColor: '#fff8fb', showSpinner: false },
  },
};

export default config;
