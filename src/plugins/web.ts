import { WebPlugin } from '@capacitor/core'
import type { SecureKeyPlugin } from './SecureKeyPlugin'

export class SecureKeyWeb extends WebPlugin implements SecureKeyPlugin {
  async generateKeyPair(_options: { userId: string; promptMessage: string }): Promise<{ publicKey: string }> {
    console.warn('SecureKey: Web platform does not support secure key generation')
    throw new Error('Biometric authentication is only available on native platforms (iOS/Android)')
  }

  async hasPrivateKey(_options: { userId: string }): Promise<{ exists: boolean }> {
    // 웹에서는 항상 false
    return { exists: false }
  }

  async signData(_options: {
    userId: string
    data: string
    promptMessage: string
  }): Promise<{ signature: string }> {
    console.warn('SecureKey: Web platform does not support biometric signing')
    throw new Error('Biometric authentication is only available on native platforms (iOS/Android)')
  }

  async getPublicKey(_options: { userId: string }): Promise<{ publicKey: string | null }> {
    // 웹에서는 항상 null
    return { publicKey: null }
  }

  async isBiometricAvailable(): Promise<{
    available: boolean
    biometryType: 'fingerprint' | 'face' | 'none'
  }> {
    // 웹에서는 생체 인증 불가
    return { available: false, biometryType: 'none' }
  }

  async getDeviceInfo(): Promise<{ deviceInfo: string }> {
    const userAgent = navigator.userAgent
    const platform = navigator.platform
    return {
      deviceInfo: `Web - ${platform} - ${userAgent}`
    }
  }
}
