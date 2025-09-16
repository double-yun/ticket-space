import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ticketing.app',
  appName: '티켓팅',
  webDir: '.next',
  server: {
    androidScheme: 'https',
    // 개발 중에는 로컬 서버 사용
    url: 'http://10.0.2.2:3000',  // Android emulator localhost
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#ffffff',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false
    }
  }
};

export default config;
