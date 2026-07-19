import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.jobmatchai.app',
  appName: 'JobMatch AI',
  webDir: 'dist',
  server: {
    url: 'https://ais-dev-wgqrbi75j2kcer5dfjpsgt-788856885719.asia-east1.run.app',
    cleartext: true
  }
};

export default config;
