import { registerPlugin } from '@capacitor/core'

/**
 * SecureKeyPlugin 인터페이스
 * 네이티브 Secure Enclave 기반 키 관리 및 생체인증 관련 기능
 */
export interface SecureKeyPlugin {
  /**
   * 생체 인증을 통해 키페어를 생성하고 공개키(Base64)를 반환
   */
  generateKeyPair(options: {
    userId: string
    promptMessage?: string
  }): Promise<{ publicKey: string }>

  /**
   * 개인키 존재 여부 확인
   */
  hasPrivateKey(options: {
    userId: string
  }): Promise<{ exists: boolean }>

  /**
   * Secure Enclave에 저장된 개인키로 데이터 서명 (Base64 반환)
   */
  signData(options: {
    userId: string
    data: string
    promptMessage?: string
  }): Promise<{ signature: string }>

  /**
   * 공개키(Base64) 조회
   */
  getPublicKey(options: {
    userId: string
  }): Promise<{ publicKey: string | null }>

  /**
   * 생체 인증 가능 여부 확인
   */
  isBiometricAvailable(): Promise<{
    available: boolean
    biometryType: 'fingerprint' | 'face' | 'none'
  }>

  /**
   * 기기 정보 조회 (ex. iOS 17.0 - iPhone)
   */
  getDeviceInfo(): Promise<{ deviceInfo: string }>
}

const SecureKey = registerPlugin<SecureKeyPlugin>('SecureKey', {
  web: () => import('./web').then(m => new m.SecureKeyWeb()),
})

export default SecureKey