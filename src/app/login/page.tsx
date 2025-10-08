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
    <div className="bg-gradient-to-br from-blue-50 via-purple-50 to-white min-h-screen relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-blue-400/10 to-purple-400/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-gradient-to-tr from-purple-400/10 to-pink-400/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

      <div className="min-h-screen flex flex-col items-center p-6 pt-20 pb-8 relative z-10">
        {/* 로고 영역 */}
        <div className="text-center mb-10 flex-shrink-0 animate-fade-in">
          <div className="w-28 h-28 bg-gradient-to-br from-blue-500 via-blue-600 to-purple-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-blue-500/30 transform hover:scale-105 transition-transform duration-300">
            <span className="text-5xl">🎫</span>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-3 tracking-tight">
            티켓팅
          </h1>
          <p className="text-base text-gray-600 font-medium">
            NFT 기반 안전한 티켓 거래 플랫폼
          </p>
        </div>

        {/* 카카오 로그인 버튼 */}
        <div className="w-full max-w-sm mb-6">
          <KakaoLogin />
        </div>

        {/* 임시 데모 로그인 */}
        <div className="w-full max-w-sm mb-8">
          <div className="bg-white/80 backdrop-blur-sm border border-gray-200 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse" />
              <p className="text-sm font-semibold text-gray-700">
                데모 계정으로 체험하기
              </p>
            </div>
            <p className="text-xs text-gray-500 mb-4 leading-relaxed">
              카카오 로그인 없이 바로 시작할 수 있습니다
            </p>
            <div className="grid grid-cols-1 gap-2.5">
              {demoUsers.map((demo) => (
                <button
                  key={demo.variant}
                  onClick={() => handleDemoLogin(demo.variant, demo.label)}
                  className="w-full bg-gradient-to-r from-gray-800 to-gray-900 text-white font-semibold py-3 rounded-xl hover:from-gray-900 hover:to-black transition-all duration-200 disabled:opacity-50 shadow-md active:scale-98"
                  disabled={demoLoading !== null}
                >
                  {demoLoading === demo.variant ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      로그인 중...
                    </span>
                  ) : (
                    `${demo.label}로 접속`
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 기능 소개 */}
        <div className="w-full max-w-sm space-y-3">
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg overflow-hidden border border-gray-100">
            <div className="p-4 flex items-center gap-4 hover:bg-blue-50/50 transition-colors">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg">
                <span className="text-xl">🔐</span>
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-gray-900 text-sm mb-0.5">개인 전용 블록체인 지갑</h4>
                <p className="text-xs text-gray-600">자동 생성되는 안전한 지갑</p>
              </div>
            </div>
          </div>

          <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg overflow-hidden border border-gray-100">
            <div className="p-4 flex items-center gap-4 hover:bg-purple-50/50 transition-colors">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg">
                <span className="text-xl">💎</span>
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-gray-900 text-sm mb-0.5">NFT 티켓 소유권</h4>
                <p className="text-xs text-gray-600">블록체인으로 보장되는 진위성</p>
              </div>
            </div>
          </div>

          <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg overflow-hidden border border-gray-100">
            <div className="p-4 flex items-center gap-4 hover:bg-green-50/50 transition-colors">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg">
                <span className="text-xl">⚡</span>
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-gray-900 text-sm mb-0.5">빠르고 안전한 거래</h4>
                <p className="text-xs text-gray-600">투명하고 신뢰할 수 있는 시스템</p>
              </div>
            </div>
          </div>
        </div>

        {/* 안내 문구 */}
        <div className="text-center mt-8 px-4">
          <p className="text-xs text-gray-500">
            최초 로그인 시 개인 지갑이 자동으로 생성됩니다
          </p>
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
