import type { CapacitorConfig } from '@capacitor/cli';
import { config as loadEnv } from 'dotenv'

loadEnv()

const serverUrl = process.env.CAPACITOR_SERVER_URL
const serverConfig = serverUrl
  ? {
      url: serverUrl,
      androidScheme: serverUrl.startsWith('https') ? 'https' : 'http',
      cleartext: serverUrl.startsWith('http://'),
    }
  : undefined

const config: CapacitorConfig = {
  appId: 'com.yun.ticketing.app',
  appName: 'Ticket Space',
  webDir: '.next',
  ...(serverConfig ? { server: serverConfig } : {}),
  ios: {
    contentInset: 'automatic',
    limitsNavigationsToAppBoundDomains: false,
    allowsLinkPreview: false
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 3000,
      launchAutoHide: true,
      backgroundColor: '#4332dbff',
      androidScaleType: 'CENTER_CROP',
      showSpinner: true,
      spinnerStyle: 'large',
      spinnerColor: '#ffffff'
    },
    KakaoLogin: {
      kakaoAppKey: '9276367f0f032290567277690d083805'
    },
    App: {
      urlSchemes: ['ticketspace']
    },
    SecureKey: {
      // SecureKey plugin configuration
    }
  }
};

export default config;
