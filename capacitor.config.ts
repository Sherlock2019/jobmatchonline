import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.jobsmatchnow.app',
  appName: 'JobsMatchNow',
  webDir: 'dist',
  server: { androidScheme: 'https' },
  plugins: {
    SplashScreen: { launchShowDuration: 1200, backgroundColor: '#fff8fb', showSpinner: false },
  },
};

export default config;
