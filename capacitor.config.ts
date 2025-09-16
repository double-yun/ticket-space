import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ticketing.app',
  appName: '티켓팅',
  webDir: '.next',
  server: {
    androidScheme: 'https',
    // 개발 중에는 로컬 서버 사용 (Android, iOS 공통)
    url: 'http://192.168.200.139:3000',  // 실제 네트워크 IP
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
