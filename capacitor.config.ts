import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.etsamani.app',
  appName: 'Ets AMANI',
  webDir: 'dist',

  server: {
    androidScheme: 'https'
  }
};

export default config;
