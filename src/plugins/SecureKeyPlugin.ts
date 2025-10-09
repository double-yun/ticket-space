import { registerPlugin } from '@capacitor/core'

export interface SecureKeyPlugin {
  /**
   * 키페어 생성 (개인키는 HSM에 저장, 공개키 반환)
   * @param options.userId - 사용자 고유 ID (키 식별자로 사용)
   * @param options.promptMessage - 생체 인증 프롬프트 메시지
   * @returns publicKey - Base64 인코딩된 공개키 (SPKI 형식)
   */
  generateKeyPair(options: {
    userId: string
    promptMessage: string
  }): Promise<{ publicKey: string }>

  /**
   * 개인키 존재 여부 확인
   * @param options.userId - 사용자 고유 ID
   * @returns exists - 개인키 존재 여부
   */
  hasPrivateKey(options: { userId: string }): Promise<{ exists: boolean }>

  /**
   * 데이터 서명 (생체 인증 필수)
   * @param options.userId - 사용자 고유 ID
   * @param options.data - 서명할 데이터 (챌린지)
   * @param options.promptMessage - 생체 인증 프롬프트 메시지
   * @returns signature - Base64 인코딩된 서명
   */
  signData(options: {
    userId: string
    data: string
    promptMessage: string
  }): Promise<{ signature: string }>

  /**
   * 공개키 조회
   * @param options.userId - 사용자 고유 ID
   * @returns publicKey - Base64 인코딩된 공개키, null이면 키 없음
   */
  getPublicKey(options: { userId: string }): Promise<{ publicKey: string | null }>

  /**
   * 생체 인증 가능 여부 확인
   * @returns available - 생체 인증 사용 가능 여부
   * @returns biometryType - 생체 인증 타입 (fingerprint, face, iris, none)
   */
  isBiometricAvailable(): Promise<{
    available: boolean
    biometryType: 'fingerprint' | 'face' | 'iris' | 'none'
  }>

  /**
   * 기기 정보 조회
   * @returns deviceInfo - OS, 모델, OS 버전 등
   */
  getDeviceInfo(): Promise<{ deviceInfo: string }>
}

const SecureKey = registerPlugin<SecureKeyPlugin>('SecureKey', {
  web: () => import('./web').then(m => new m.SecureKeyWeb()),
})

export default SecureKey
