'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@mui/material'
import { Capacitor } from '@capacitor/core'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

// Capacitor 카카오 로그인 플러그인 직접 import
import { KakaoLoginPlugin as KakaoPlugin } from 'capacitor-kakao-login-plugin'
import type { KakaoProfile } from '@/types/kakao'

type KakaoAuthResult = {
  accessToken: string
  refreshToken?: string | null
  userData: KakaoProfile
}

// 플러그인 인터페이스
export interface KakaoLoginInterface {
  goLogin(): Promise<{ accessToken: string; refreshToken?: string }>
  getUserInfo(): Promise<KakaoProfile>
  goLogout(): Promise<void>
}

// 플러그인 사용
const KakaoLoginNative: KakaoLoginInterface = {
  goLogin: KakaoPlugin.goLogin,
  getUserInfo: async () => {
    const result = await KakaoPlugin.getUserInfo();
    return result.value as KakaoProfile;
  },
  goLogout: KakaoPlugin.goLogout,
};

export default function KakaoLogin() {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const { setAuthToken } = useAuth()

  // 휴대폰 번호 정규화 함수 ("+82 010-1234-5678" -> "01012345678")
  const normalizePhoneNumber = useCallback((phoneNumber: string) => {
    if (!phoneNumber) return ''
    return phoneNumber
      .replace(/^\+82\s?/, '0')  // +82를 0으로 변경
      .replace(/[-\s]/g, '')     // 하이픈과 공백 제거
  }, [])

  const processKakaoAuthResult = useCallback(async ({
    accessToken,
    refreshToken,
    userData,
  }: KakaoAuthResult) => {
    try {
      const normalizedPhone = normalizePhoneNumber(userData.kakao_account?.phone_number || '')

      const checkUserResponse = await fetch('/api/auth/kakao/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          kakaoId: userData.id.toString(),
        }),
      })

      if (!checkUserResponse.ok) {
        throw new Error('사용자 정보를 확인하지 못했습니다.')
      }

      const checkResult = await checkUserResponse.json()
      const isExistingUser = Boolean(checkResult.exists)

      if (isExistingUser) {
        // 기존 사용자: 즉시 로그인
        const loginResponse = await fetch('/api/auth/kakao/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            accessToken,
            refreshToken,
            userData,
          }),
        })

        if (!loginResponse.ok) {
          throw new Error('로그인 처리에 실패했습니다.')
        }

        const loginData = await loginResponse.json()

        // JWT 토큰 저장
        if (loginData.token) {
          setAuthToken(loginData.token)
        }

        // 로그인 성공 - 홈으로 이동
        router.push('/')
      } else {
        // 신규 사용자: 서버에 임시 데이터 저장 후 정보 입력 페이지로 이동
        const pendingData = {
          kakaoData: userData,
          accessToken,
          refreshToken: refreshToken ?? undefined,
          kakaoPhoneNumber: normalizedPhone || undefined,
        }

        const setPendingResponse = await fetch('/api/auth/kakao/pending', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(pendingData),
        })

        if (!setPendingResponse.ok) {
          throw new Error('임시 데이터 저장에 실패했습니다.')
        }

        router.push('/login/info')
      }
    } catch (error) {
      console.error('카카오 사용자 처리 실패:', error)
      if (error instanceof Error) {
        alert(error.message)
      } else {
        alert('카카오 로그인 정보를 처리하지 못했습니다. 다시 시도해주세요.')
      }
    }
  }, [normalizePhoneNumber, router, setAuthToken])


  const handleKakaoLogin = async () => {
    setIsLoading(true)

    try {
      if (Capacitor.isNativePlatform()) {
        // 네이티브 앱에서 카카오 SDK 사용
        console.log('네이티브 환경에서 카카오 로그인 시도')

        console.log('등록된 KakaoLogin 플러그인 사용')

        const result = await KakaoLoginNative.goLogin()
        console.log('카카오 로그인 성공:', result)

        // 사용자 정보 가져오기
        const userInfo = await KakaoLoginNative.getUserInfo()
        console.log('사용자 정보:', userInfo)

        // 액세스 토큰으로 사용자 정보 직접 가져오기 (휴대폰 번호 포함)
        const userResponse = await fetch('https://kapi.kakao.com/v2/user/me', {
          headers: {
            'Authorization': `Bearer ${result.accessToken}`,
            'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
          },
        })

        if (!userResponse.ok) {
          throw new Error('사용자 정보 요청 실패')
        }

        const userData = await userResponse.json()
        console.log('카카오 사용자 데이터:', userData)

        // 카카오 계정의 휴대폰 번호 추출
        const kakaoPhone = userData.kakao_account?.phone_number
        const normalizedKakaoPhone = normalizePhoneNumber(kakaoPhone || '')

        console.log('카카오 휴대폰 번호:', kakaoPhone, '정규화된 번호:', normalizedKakaoPhone)

        // 먼저 기존 사용자인지 확인
        await processKakaoAuthResult({
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          userData,
        })
      } else {
        console.log('웹 환경에서 카카오 로그인 시도')

        const clientId = process.env.NEXT_PUBLIC_KAKAO_CLIENT_ID
        if (!clientId) {
          throw new Error('NEXT_PUBLIC_KAKAO_CLIENT_ID가 설정되어 있지 않습니다.')
        }

        const redirectUri = `${window.location.origin}/api/auth/kakao/callback`

        const authorizeUrl = new URL('https://kauth.kakao.com/oauth/authorize')
        authorizeUrl.searchParams.set('client_id', clientId)
        authorizeUrl.searchParams.set('redirect_uri', redirectUri)
        authorizeUrl.searchParams.set('response_type', 'code')
        authorizeUrl.searchParams.set('scope', 'profile_nickname account_email')

        window.location.href = authorizeUrl.toString()
      }
    } catch (error) {
      console.error('카카오 로그인 실패:', error)
      if (error instanceof Error) {
        alert(`로그인 실패: ${error.message}`)
      } else {
        alert('로그인에 실패했습니다. 다시 시도해주세요.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      variant="contained"
      onClick={handleKakaoLogin}
      disabled={isLoading}
      sx={{
        backgroundColor: '#FEE500',
        color: '#000000',
        '&:hover': {
          backgroundColor: '#FCDD00',
        },
        fontSize: '16px',
        fontWeight: 'bold',
        padding: '12px 24px',
        borderRadius: '8px',
        width: '100%',
        maxWidth: '300px',
        margin: '0 auto',
        display: 'block',
      }}
    >
      {isLoading ? '로그인 중...' : '카카오톡으로 로그인'}
    </Button>
  )
}
