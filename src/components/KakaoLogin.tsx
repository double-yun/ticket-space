'use client'

import { useState } from 'react'
import { Button } from '@mui/material'
import { Capacitor } from '@capacitor/core'
import { useRouter } from 'next/navigation'

// Capacitor 카카오 로그인 플러그인 직접 import
import { KakaoLoginPlugin as KakaoPlugin } from 'capacitor-kakao-login-plugin'
import NewUserRegistration from './NewUserRegistration'
import type { KakaoProfile, PendingKakaoUserData, KakaoRegistrationPayload } from '@/types/kakao'

// 플러그인 인터페이스
export interface KakaoLoginInterface {
  goLogin(): Promise<{ accessToken: string; refreshToken?: string }>
  getUserInfo(): Promise<KakaoProfile>
  goLogout(): Promise<void>
}

// 플러그인 사용
const KakaoLoginNative = KakaoPlugin as KakaoLoginInterface

export default function KakaoLogin() {
  const [isLoading, setIsLoading] = useState(false)
  const [showRegistration, setShowRegistration] = useState(false)
  const [pendingUserData, setPendingUserData] = useState<PendingKakaoUserData | null>(null)
  const [showPhoneVerification, setShowPhoneVerification] = useState(false)
  const [kakaoPhoneNumber, setKakaoPhoneNumber] = useState<string>('')
  const router = useRouter()

  // 휴대폰 번호 정규화 함수 ("+82 010-1234-5678" -> "01012345678")
  const normalizePhoneNumber = (phoneNumber: string) => {
    if (!phoneNumber) return ''
    return phoneNumber
      .replace(/^\+82\s?/, '0')  // +82를 0으로 변경
      .replace(/[-\s]/g, '')     // 하이픈과 공백 제거
  }

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
        const checkUserResponse = await fetch('/api/auth/kakao/check-user', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            kakaoId: userData.id.toString()
          }),
        })

        const checkResult = await checkUserResponse.json()

        if (checkResult.exists) {
          // 기존 사용자 - 휴대폰 번호 검증 후 로그인 처리
          if (!normalizedKakaoPhone) {
            throw new Error('카카오 계정에 휴대폰 번호가 등록되어 있지 않습니다.')
          }

          // 휴대폰 번호 검증을 위한 데이터 저장
          setKakaoPhoneNumber(normalizedKakaoPhone)
          setPendingUserData({
            kakaoData: userData,
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
            isExistingUser: true
          })
          setShowPhoneVerification(true)
        } else {
          // 신규 사용자 - 추가 정보 입력 필요
          setPendingUserData({
            kakaoData: userData,
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
            kakaoPhoneNumber: normalizedKakaoPhone
          })
          setShowRegistration(true)
        }
      } else {
        console.log('웹 환경에서 카카오 로그인 시도')

        const clientId = process.env.NEXT_PUBLIC_KAKAO_CLIENT_ID
        if (!clientId) {
          throw new Error('NEXT_PUBLIC_KAKAO_CLIENT_ID가 설정되어 있지 않습니다.')
        }

        const redirectUri =
          process.env.NEXT_PUBLIC_KAKAO_REDIRECT_URI ??
          `${window.location.origin}/api/auth/kakao/callback`

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

  const handleRegistrationComplete = async (completeUserData: KakaoRegistrationPayload) => {
    setIsLoading(true)
    try {
      // 완전한 사용자 정보로 계정 생성
      const response = await fetch('/api/auth/kakao/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(completeUserData),
      })

      if (response.ok) {
        const data = await response.json()
        console.log('신규 사용자 등록 성공:', data)
        setShowRegistration(false)
        router.push('/') // 메인 페이지로 리다이렉트
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || '계정 생성 실패')
      }
    } catch (error) {
      console.error('계정 생성 실패:', error)
      alert('계정 생성에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRegistrationCancel = () => {
    setShowRegistration(false)
    setPendingUserData(null)
  }

  // 휴대폰 번호 검증 완료 후 기존 사용자 로그인 처리
  const handlePhoneVerificationComplete = async (verifiedPhoneNumber: string) => {
    if (!pendingUserData) {
      alert('카카오 사용자 정보를 찾을 수 없습니다. 처음부터 다시 시도해주세요.')
      return
    }
    setIsLoading(true)
    try {
      // Firebase에서 인증된 휴대폰 번호와 카카오 휴대폰 번호 비교
      const normalizedVerifiedPhone = normalizePhoneNumber(verifiedPhoneNumber)

      console.log('검증된 번호:', normalizedVerifiedPhone, '카카오 번호:', kakaoPhoneNumber)

      if (normalizedVerifiedPhone !== kakaoPhoneNumber) {
        throw new Error('인증된 휴대폰 번호와 카카오 계정의 휴대폰 번호가 다릅니다. 계정 도용 방지를 위해 로그인이 차단됩니다.')
      }

      // 휴대폰 번호 검증 성공 - 로그인 진행
      const loginResponse = await fetch('/api/auth/kakao/app-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accessToken: pendingUserData.accessToken,
          refreshToken: pendingUserData.refreshToken,
          userData: pendingUserData.kakaoData,
          verifiedPhoneNumber: normalizedVerifiedPhone
        }),
      })

      if (loginResponse.ok) {
        const data = await loginResponse.json()
        console.log('기존 사용자 로그인 성공:', data)
        setShowPhoneVerification(false)
        setPendingUserData(null)
        router.push('/') // 메인 페이지로 리다이렉트
      } else {
        throw new Error('로그인 실패')
      }
    } catch (error) {
      console.error('휴대폰 번호 검증 실패:', error)
      if (error instanceof Error) {
        alert(error.message)
      } else {
        alert('휴대폰 번호 검증에 실패했습니다.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handlePhoneVerificationCancel = () => {
    setShowPhoneVerification(false)
    setPendingUserData(null)
    setKakaoPhoneNumber('')
  }

  // 기존 사용자 휴대폰 번호 검증 화면
  if (showPhoneVerification && pendingUserData) {
    return (
      <NewUserRegistration
        kakaoUserData={{
          id: pendingUserData.kakaoData.id.toString(),
          nickname: pendingUserData.kakaoData.properties?.nickname || pendingUserData.kakaoData.kakao_account?.profile?.nickname,
          email: pendingUserData.kakaoData.kakao_account?.email
        }}
        accessToken={pendingUserData.accessToken}
        refreshToken={pendingUserData.refreshToken}
        onComplete={handlePhoneVerificationComplete}
        onCancel={handlePhoneVerificationCancel}
        isExistingUserVerification={true}
        expectedPhoneNumber={kakaoPhoneNumber}
      />
    )
  }

  // 신규 사용자 등록 화면 표시
  if (showRegistration && pendingUserData) {
    return (
      <NewUserRegistration
        kakaoUserData={{
          id: pendingUserData.kakaoData.id.toString(),
          nickname: pendingUserData.kakaoData.properties?.nickname || pendingUserData.kakaoData.kakao_account?.profile?.nickname,
          email: pendingUserData.kakaoData.kakao_account?.email
        }}
        accessToken={pendingUserData.accessToken}
        refreshToken={pendingUserData.refreshToken}
        onComplete={handleRegistrationComplete}
        onCancel={handleRegistrationCancel}
        kakaoPhoneNumber={pendingUserData.kakaoPhoneNumber}
      />
    )
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
