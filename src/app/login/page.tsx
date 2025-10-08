'use client'

export const dynamic = 'force-dynamic'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import PhoneVerification from '@/components/PhoneVerification'
import AccountCreationForm from '@/components/AccountCreationForm'
import KakaoLogin from '@/components/KakaoLogin'
import type { KakaoUserInfo } from '@/types/kakao'
import { useAuth } from '@/contexts/AuthContext'

function LoginPageContent() {
  const router = useRouter()
  const { user, isLoading: authLoading, setAuthToken } = useAuth()
  const [showPhoneVerification, setShowPhoneVerification] = useState(false)
  const [kakaoUserInfo, setKakaoUserInfo] = useState<KakaoUserInfo | null>(null)
  const [showAccountCreation, setShowAccountCreation] = useState(false)
  const [demoLoading, setDemoLoading] = useState<string | null>(null)

  const demoUsers = [
    { variant: 'demo1', label: '데모 사용자 1' },
    { variant: 'demo2', label: '데모 사용자 2' },
    { variant: 'demo3', label: '데모 사용자 3' },
  ]

  const searchParams = useSearchParams()

  const callbackUrl = searchParams.get('callbackUrl') ?? '/'
  const tokenFromUrl = searchParams.get('token')
  const redirectUrl = searchParams.get('redirect')

  // Handle token from OAuth callback
  useEffect(() => {
    if (tokenFromUrl) {
      setAuthToken(tokenFromUrl)
      // Clean URL and redirect
      const targetUrl = redirectUrl || callbackUrl
      router.replace(targetUrl)
    }
  }, [tokenFromUrl, redirectUrl, callbackUrl, setAuthToken, router])

  // Check if user is already logged in via JWT
  useEffect(() => {
    if (authLoading) return

    if (user && !tokenFromUrl) {
      // User is already authenticated, redirect to callback URL
      router.replace(callbackUrl)
    }
  }, [user, authLoading, router, callbackUrl, tokenFromUrl])

  useEffect(() => {
    // 네이티브 환경에서 앱 URL 리스너 설정 (콜백 처리용)
    if (Capacitor.isNativePlatform()) {
      setupAppUrlListener()
    }
  }, [])


  const setupAppUrlListener = () => {
    if (Capacitor.isNativePlatform()) {
      App.addListener('appUrlOpen', (event) => {
        console.log('App URL 수신:', event.url)

        // 카카오 OAuth 콜백 URL 확인
        if (event.url.startsWith('com.ticketing.app://oauth')) {
          handleKakaoAppCallback(event.url)
        }
      })
    }
  }

  const handleKakaoAppCallback = async (url: string) => {
    try {
      // URL에서 authorization code 추출
      const urlObj = new URL(url)
      const code = urlObj.searchParams.get('code')

      if (!code) {
        alert('카카오 로그인 코드를 받지 못했습니다.')
        return
      }

      // 백엔드에 코드 전송하여 사용자 정보 가져오기
      const response = await fetch('/api/auth/kakao/app-callback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code })
      })

      if (!response.ok) {
        throw new Error('카카오 로그인 처리 실패')
      }

      const data = await response.json()

      if (data.success) {
        const { kakaoId, nickname, email, phoneNumber } = data

        // 전화번호가 있는 경우 기존 계정 확인
        if (phoneNumber) {
          const userCheckResponse = await fetch('/api/auth/kakao/check', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ kakaoId, phoneNumber })
          })

          if (userCheckResponse.ok) {
            const userCheckData = await userCheckResponse.json()

            if (userCheckData.userExists) {
              // 기존 사용자 자동 로그인
              router.push('/')
              return
            }
          }
        }

        // 새 사용자인 경우 - 전화번호 인증 단계로 (카카오에서는 전화번호를 제공하지 않음)
        setKakaoUserInfo({
          kakaoId,
          nickname,
          email,
          phoneNumber: null // 카카오에서는 전화번호를 제공하지 않음
        })
        setShowPhoneVerification(true)
      } else {
        alert('카카오 로그인에 실패했습니다.')
      }
    } catch (error) {
      console.error('카카오 앱 콜백 처리 실패:', error)
      alert('카카오 로그인 처리 중 오류가 발생했습니다.')
    }
  }


  const handlePhoneVerificationSuccess = async (phoneNumber: string) => {
    // 카카오 로그인 플로우에서만 호출됨: 인증된 전화번호로 기존 계정 확인
    if (!kakaoUserInfo) {
      console.error('카카오 정보 없이 전화번호 인증이 호출되었습니다.')
      return
    }

    try {
      const userCheckResponse = await fetch('/api/auth/kakao/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          kakaoId: kakaoUserInfo.kakaoId,
          phoneNumber
        })
      })

      if (userCheckResponse.ok) {
        const userCheckData = await userCheckResponse.json()

        if (userCheckData.userExists) {
          // 기존 사용자 자동 로그인
          router.push('/')
          return
        }
      }

      // 새 사용자인 경우 계정 생성 단계로
      setKakaoUserInfo(prev => (prev ? { ...prev, phoneNumber } : prev))
      setShowPhoneVerification(false)
      setShowAccountCreation(true)
    } catch (error) {
      console.error('사용자 확인 중 오류:', error)
      alert('사용자 확인 중 오류가 발생했습니다.')
    }
  }

  const handleAccountCreated = () => {
    router.push('/')
  }

  const handleCancelAccountCreation = () => {
    setShowAccountCreation(false)
    setKakaoUserInfo(null)
    setShowPhoneVerification(false)
  }

  const handleDemoLogin = async (variant: string, label: string) => {
    if (demoLoading) return

    setDemoLoading(variant)
    try {
      const response = await fetch('/api/auth/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variant, name: label }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || '로그인에 실패했습니다.')
      }

      const data = await response.json()
      if (data.token) {
        setAuthToken(data.token)
      }

      router.push('/')
    } catch (error) {
      const message = error instanceof Error ? error.message : '로그인 중 문제가 발생했습니다.'
      alert(message)
    } finally {
      setDemoLoading(null)
    }
  }

  if (showAccountCreation && kakaoUserInfo) {
    return (
      <div className="bg-gradient-to-b from-blue-50 to-white min-h-screen">
        <div className="min-h-screen flex flex-col justify-center items-center p-4">
          <AccountCreationForm
            kakaoUserInfo={kakaoUserInfo}
            onAccountCreated={handleAccountCreated}
            onCancel={handleCancelAccountCreation}
          />
        </div>
      </div>
    )
  }

  if (showAccountCreation && !kakaoUserInfo) {
    return null
  }

  if (showPhoneVerification) {
    return (
      <div className="bg-gradient-to-b from-blue-50 to-white min-h-screen">
        <div className="min-h-screen flex flex-col justify-center items-center p-4">
          <PhoneVerification
            onVerificationSuccess={handlePhoneVerificationSuccess}
            onCancel={() => {
              setShowPhoneVerification(false)
              if (kakaoUserInfo) {
                setKakaoUserInfo(null)
              }
            }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-b from-blue-50 to-white min-h-screen">
      <div className="min-h-screen flex flex-col justify-center items-center p-4">
        {/* 로고 영역 */}
        <div className="text-center mb-12">
          <div className="w-24 h-24 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
            <span className="text-4xl">🎫</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            티켓팅 시스템
          </h1>
          <p className="text-lg text-gray-600">
            NFT 티켓으로 안전하고 투명한 티켓 거래
          </p>
        </div>

        {/* 카카오 로그인 버튼 */}
        <div className="w-full max-w-sm mb-8">
          <KakaoLogin />
        </div>

        {/* 임시 데모 로그인 */}
        <div className="w-full max-w-sm mb-10">
          <div className="bg-white/70 border border-dashed border-gray-200 rounded-2xl p-4 shadow-sm">
            <p className="text-sm text-gray-600 mb-3">
              카카오 로그인을 사용할 수 없다면 아래 데모 계정으로 임시 접속할 수 있습니다.
            </p>
            <div className="grid grid-cols-1 gap-2">
              {demoUsers.map((demo) => (
                <button
                  key={demo.variant}
                  onClick={() => handleDemoLogin(demo.variant, demo.label)}
                  className="w-full bg-gray-900 text-white font-medium py-2.5 rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50"
                  disabled={demoLoading !== null}
                >
                  {demoLoading === demo.variant ? '로그인 중...' : `${demo.label}로 접속`}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 안내 문구 */}
        <div className="text-center mb-8 px-4">
          <p className="text-sm text-gray-500 mb-2">
            최초 로그인 시 개인 지갑이 자동으로 생성됩니다
          </p>
          <p className="text-sm text-gray-500">
            카카오 계정으로 간편하게 시작하세요
          </p>
        </div>

        {/* 기능 소개 */}
        <div className="w-full max-w-sm">
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                <span className="text-lg">🔐</span>
              </div>
              <div>
                <h4 className="font-semibold text-gray-800">개인 전용 블록체인 지갑</h4>
                <p className="text-sm text-gray-600">자동 생성되는 안전한 지갑</p>
              </div>
            </div>
            <div className="p-4 border-b border-gray-100 flex items-center">
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center mr-3">
                <span className="text-lg">💎</span>
              </div>
              <div>
                <h4 className="font-semibold text-gray-800">NFT 티켓 소유권</h4>
                <p className="text-sm text-gray-600">블록체인으로 보장되는 진위성</p>
              </div>
            </div>
            <div className="p-4 flex items-center">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mr-3">
                <span className="text-lg">⚡</span>
              </div>
              <div>
                <h4 className="font-semibold text-gray-800">빠르고 안전한 거래</h4>
                <p className="text-sm text-gray-600">투명하고 신뢰할 수 있는 시스템</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-white">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4" />
            <p className="text-gray-600">로그인 준비 중...</p>
          </div>
        </div>
      }
    >
      <LoginPageContent />
    </Suspense>
  )
}
