'use client'

import SecureKey from '@/plugins/SecureKeyPlugin'
import { Capacitor } from '@capacitor/core'

/**
 * 챌린지 서명 (로그인 시)
 * @param userId - 사용자 고유 ID
 * @param challenge - 서버에서 받은 챌린지
 * @param promptMessage - 생체 인증 프롬프트 메시지
 * @returns signature - Base64 인코딩된 서명
 */
export async function signChallenge(
  userId: string,
  challenge: string,
  promptMessage: string = '로그인하려면 인증하세요'
): Promise<string> {
  if (!Capacitor.isNativePlatform()) {
    throw new Error('Biometric authentication is only available on mobile devices')
  }

  try {
    const result = await SecureKey.signData({
      userId,
      data: challenge,
      promptMessage
    })

    return result.signature
  } catch (error) {
    console.error('Challenge signing error:', error)
    throw error
  }
}

/**
 * 챌린지 기반 로그인 전체 플로우
 * @param kakaoId - 카카오 ID
 * @returns JWT 토큰 및 사용자 정보
 */
export async function biometricLogin(kakaoId: string): Promise<{
  token: string
  user: {
    id: string
    name: string | null
    email: string | null
    phoneNumber: string | null
    walletAddress: string | null
  }
}> {
  try {
    console.log('[DEBUG] biometricLogin - Starting for kakaoId:', kakaoId)

    // 1. 챌린지 요청
    console.log('[DEBUG] biometricLogin - Requesting challenge')
    const challengeResponse = await fetch('/api/auth/challenge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kakaoId })
    })

    console.log('[DEBUG] biometricLogin - Challenge response status:', challengeResponse.status)

    if (!challengeResponse.ok) {
      const error = await challengeResponse.json().catch(() => ({}))

      if (challengeResponse.status === 404) {
        throw new Error('계정을 찾을 수 없습니다')
      } else if (challengeResponse.status === 400) {
        throw new Error('생체 인증이 설정되지 않은 계정입니다')
      }

      throw new Error(error.error || '챌린지 요청에 실패했습니다')
    }

    const { challenge } = await challengeResponse.json()

    // 2. 챌린지 서명 (생체 인증)
    const signature = await signChallenge(kakaoId, challenge, '로그인하려면 생체 인증을 진행하세요')

    // 3. 서명 검증 및 로그인
    const verifyResponse = await fetch('/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kakaoId,
        challenge,
        signature
      })
    })

    if (!verifyResponse.ok) {
      const error = await verifyResponse.json().catch(() => ({}))

      if (verifyResponse.status === 401) {
        // 서명 검증 실패 = 이 기기의 개인키가 DB 공개키와 쌍이 아님
        // → 다른 기기에서 생성된 계정
        throw new Error('이 계정은 다른 기기에서 생성되었습니다.\n계정을 생성한 기기에서만 로그인할 수 있습니다.')
      } else if (verifyResponse.status === 400) {
        if (error.error?.includes('expired')) {
          throw new Error('인증 시간이 만료되었습니다. 다시 시도해주세요')
        } else if (error.error?.includes('used')) {
          throw new Error('이미 사용된 인증입니다. 다시 시도해주세요')
        }
      }

      throw new Error(error.error || '인증 검증에 실패했습니다')
    }

    const result = await verifyResponse.json()
    return result

  } catch (error) {
    console.error('Biometric login error:', error)
    throw error
  }
}
