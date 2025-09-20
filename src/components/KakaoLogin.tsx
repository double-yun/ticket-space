'use client'

import { useState } from 'react'
import { Button } from '@mui/material'
import { Capacitor } from '@capacitor/core'
import { useRouter } from 'next/navigation'

// Capacitor 카카오 로그인 플러그인 직접 import
import { KakaoLoginPlugin as KakaoPlugin } from 'capacitor-kakao-login-plugin'

// 플러그인 인터페이스
export interface KakaoLoginInterface {
  goLogin(): Promise<{ accessToken: string; refreshToken?: string }>
  getUserInfo(): Promise<any>
  goLogout(): Promise<void>
}

// 플러그인 사용
const KakaoLoginNative = KakaoPlugin as KakaoLoginInterface

export default function KakaoLogin() {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

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

        // 액세스 토큰으로 사용자 정보 직접 가져오기
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

        // 서버에 액세스 토큰과 사용자 정보 전송하여 인증 처리
        const response = await fetch('/api/auth/kakao/app-login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
            userData: userData
          }),
        })

        if (response.ok) {
          const data = await response.json()
          console.log('서버 인증 성공:', data)
          router.push('/') // 메인 페이지로 리다이렉트
        } else {
          throw new Error('서버 인증 실패')
        }
      } else {
        // 웹에서는 NextAuth 사용
        console.log('웹 환경에서 카카오 로그인 시도')
        const { signIn } = await import('next-auth/react')
        await signIn('kakao')
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
      }}
    >
      {isLoading ? '로그인 중...' : '카카오톡으로 로그인'}
    </Button>
  )
}