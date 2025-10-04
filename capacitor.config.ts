import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.yun.ticketing.app',
  appName: 'Ticket Space',
  webDir: '.next',
  server: {
    androidScheme: 'https',
    // 개발 중에는 로컬 서버 사용 (Android, iOS 공통)
    url: process.env.CAPACITOR_SERVER_URL || 'http://localhost:3000',
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#ffffff',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false
    },
    KakaoLogin: {
      kakaoAppKey: '9276367f0f032290567277690d083805'
    }
  }
};

export default config;
