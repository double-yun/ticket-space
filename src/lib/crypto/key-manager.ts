'use client'

import SecureKey from '@/plugins/SecureKeyPlugin'
import { Capacitor } from '@capacitor/core'

/**
 * 키페어 생성 (계정 생성 시)
 * @param userId - 사용자 고유 ID
 * @returns publicKey - Base64 인코딩된 공개키
 */
export async function generateKeyPair(userId: string): Promise<string> {
  // 네이티브 플랫폼 확인
  if (!Capacitor.isNativePlatform()) {
    throw new Error('Biometric authentication is only available on mobile devices')
  }

  try {
    // 생체 인증 가능 여부 확인
    const { available } = await SecureKey.isBiometricAvailable()
    if (!available) {
      throw new Error('생체 인증을 사용할 수 없습니다. 기기 설정에서 지문 또는 얼굴 인식을 등록해주세요.')
    }

    // 키페어 생성
    const result = await SecureKey.generateKeyPair({
      userId,
      promptMessage: '보안 키를 생성하기 위해 인증하세요'
    })

    return result.publicKey
  } catch (error: any) {
    console.error('Key generation error:', error)

    // Android 10 이하에서 생체 인증 미등록 에러 처리
    if (error?.message?.includes('Biometric authentication is required')) {
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
  console.log('[DEBUG] hasPrivateKey - Checking for userId:', userId)
  console.log('[DEBUG] hasPrivateKey - isNativePlatform:', Capacitor.isNativePlatform())

  if (!Capacitor.isNativePlatform()) {
    console.log('[DEBUG] hasPrivateKey - Not native platform, returning false')
    return false
  }

  try {
    const result = await SecureKey.hasPrivateKey({ userId })
    console.log('[DEBUG] hasPrivateKey - Result:', result)
    console.log('[DEBUG] hasPrivateKey - Key exists:', result.exists)
    return result.exists
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
  if (!Capacitor.isNativePlatform()) {
    return null
  }

  try {
    const result = await SecureKey.getPublicKey({ userId })
    return result.publicKey
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
  if (!Capacitor.isNativePlatform()) {
    return { available: false, biometryType: 'none' }
  }

  try {
    return await SecureKey.isBiometricAvailable()
  } catch (error) {
    console.error('Biometric availability check error:', error)
    return { available: false, biometryType: 'none' }
  }
}
