'use client'

import SecureKey from '@/plugins/SecureKeyPlugin'
import { Capacitor } from '@capacitor/core'

function isNative(): boolean {
  return Capacitor.isNativePlatform()
}

function isWebSecureContext(): boolean {
  return typeof window !== 'undefined' && window.isSecureContext && !!window.crypto?.subtle
}

export async function generateKeyPair(userId: string): Promise<string> {
  try {
    const availability = await SecureKey.isBiometricAvailable()
    if (!availability.available) {
      if (isNative()) {
        throw new Error('생체 인증을 사용할 수 없습니다. 기기 설정에서 지문 또는 얼굴 인식을 등록해주세요.')
      }
      throw new Error('이 브라우저에서는 PassKey를 지원하지 않습니다. 최신 브라우저를 사용하거나 보안 환경을 확인해주세요.')
    }

    const result = await SecureKey.generateKeyPair({
      userId,
      promptMessage: isNative() ? '보안 키를 생성하기 위해 인증하세요' : undefined,
    })

    return result.publicKey
  } catch (error: unknown) {
    console.error('Key generation error:', error)

    if (isNative() && error instanceof Error && error.message.includes('Biometric authentication is required')) {
      throw new Error('Android 10 이하 버전에서는 지문 또는 얼굴 인식 등록이 필수입니다.\n기기 설정에서 생체 인증을 등록해주세요.')
    }

    throw error
  }
}

/**
 * 개인키 존재 확인
 * @param userId - 사용자 고유 ID
 * @returns 개인키 존재 여부
 */
export async function hasPrivateKey(userId: string): Promise<boolean> {
  try {
    const result = await SecureKey.hasPrivateKey({ userId })
    return !!result.exists
  } catch (error) {
    console.error('[DEBUG] hasPrivateKey - Error:', error)
    return false
  }
}

/**
 * 공개키 조회
 * @param userId - 사용자 고유 ID
 * @returns publicKey - Base64 인코딩된 공개키 또는 null
 */
export async function getPublicKey(userId: string): Promise<string | null> {
  try {
    const result = await SecureKey.getPublicKey({ userId })
    return result.publicKey ?? null
  } catch (error) {
    console.error('Get public key error:', error)
    return null
  }
}

/**
 * 기기 정보 조회
 * @returns 기기 정보 문자열
 */
export async function getDeviceInfo(): Promise<string> {
  try {
    const result = await SecureKey.getDeviceInfo()
    return result.deviceInfo
  } catch (error) {
    console.error('Get device info error:', error)
    if (typeof navigator !== 'undefined') {
      return `Web - ${navigator.platform} - ${navigator.userAgent}`
    }
    return 'Unknown device'
  }
}

/**
 * 생체 인증 가능 여부 확인
 * @returns 생체 인증 정보
 */
export async function checkBiometricAvailability(): Promise<{
  available: boolean
  biometryType: 'fingerprint' | 'face' | 'iris' | 'none'
}> {
  try {
    const result = await SecureKey.isBiometricAvailable()
    if (!result.available && !isNative() && isWebSecureContext()) {
      // 웹 환경에서는 생체 인증 대신 PassKey 지원 여부만 확인
      return { available: true, biometryType: 'none' }
    }
    return result
  } catch (error) {
    console.error('Biometric availability check error:', error)
    if (!isNative() && isWebSecureContext()) {
      return { available: true, biometryType: 'none' }
    }
    return { available: false, biometryType: 'none' }
  }
}

export function isPasskeySupported(): boolean {
  return isNative() || isWebSecureContext()
}
