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
    // 1. 챌린지 요청
    const challengeResponse = await fetch('/api/auth/challenge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kakaoId })
    })

    if (!challengeResponse.ok) {
      const error = await challengeResponse.json()
      throw new Error(error.error || 'Failed to get challenge')
    }

    const { challenge } = await challengeResponse.json()

    // 2. 챌린지 서명 (생체 인증)
    const signature = await signChallenge(kakaoId, challenge)

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
      const error = await verifyResponse.json()
      throw new Error(error.error || 'Authentication failed')
    }

    const result = await verifyResponse.json()
    return result

  } catch (error) {
    console.error('Biometric login error:', error)
    throw error
  }
}
