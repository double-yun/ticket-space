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
import { hasPrivateKey } from '@/lib/crypto/key-manager'
import { biometricLogin } from '@/lib/crypto/auth-signer'
import LoadingSpinner from '@/components/LoadingSpinner'
import toast from 'react-hot-toast'
import { Ticket, Shield, Gem, Zap } from 'lucide-react'

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
        toast.error('카카오 로그인 코드를 받지 못했습니다.')
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

        // 1. 이 기기에 개인키가 있는지 확인
        const keyExists = await hasPrivateKey(kakaoId)

        if (keyExists) {
          // 개인키 있음 → 생체 인증 로그인
          try {
            const loginResult = await biometricLogin(kakaoId)
            setAuthToken(loginResult.token)
            router.push('/')
            return
          } catch (error) {
            console.error('Biometric login failed:', error)
            const errorMessage = error instanceof Error ? error.message : '생체 인증 로그인에 실패했습니다'
            toast.error(errorMessage)
            return
          }
        }

        // 2. 개인키 없음 → 서버에서 계정 존재 여부 확인
        const userCheckResponse = await fetch('/api/auth/kakao/check', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ kakaoId })
        })

        if (userCheckResponse.ok) {
          const userCheckData = await userCheckResponse.json()

          if (userCheckData.userExists) {
            // 계정은 있지만 이 기기에 개인키 없음 → 다른 기기에서 생성됨
            toast.error('이 계정은 다른 기기에서 생성되었습니다.\n계정을 생성한 기기에서만 로그인할 수 있습니다.')
            return
          }
        }

        // 3. 새 사용자인 경우 - 전화번호 인증 단계로
        setKakaoUserInfo({
          kakaoId,
          nickname,
          email,
          phoneNumber: null
        })
        setShowPhoneVerification(true)
      } else {
        toast.error('카카오 로그인에 실패했습니다.')
      }
    } catch (error) {
      console.error('카카오 앱 콜백 처리 실패:', error)
      toast.error('카카오 로그인 처리 중 오류가 발생했습니다.')
    }
  }


  const handlePhoneVerificationSuccess = async (phoneNumber: string) => {
    // 전화번호 인증 완료 후 계정 생성 단계로 이동
    if (!kakaoUserInfo) {
      console.error('카카오 정보 없이 전화번호 인증이 호출되었습니다.')
      return
    }

    // 전화번호를 추가하고 계정 생성 단계로
    setKakaoUserInfo(prev => (prev ? { ...prev, phoneNumber } : prev))
    setShowPhoneVerification(false)
    setShowAccountCreation(true)
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
      // 네이티브 플랫폼에서만 키 페어 인증 사용
      if (Capacitor.isNativePlatform()) {
        // **[NEW]** 개인키 존재 확인
        const keyExists = await hasPrivateKey(variant)

        if (keyExists) {
          // 개인키 있음 → 생체 인증 로그인
          try {
            const loginResult = await biometricLogin(variant)
            setAuthToken(loginResult.token)
            router.push('/')
            return
          } catch (error) {
            console.error('Biometric login failed:', error)
            const errorMessage = error instanceof Error ? error.message : '생체 인증 로그인에 실패했습니다'
            toast.error(errorMessage)
            return
          }
        }

        // 개인키 없음 → 신규 사용자, 키페어 생성 필요
        // 서버에 공개키와 함께 계정 생성 요청
        const { generateKeyPair, getDeviceInfo, checkBiometricAvailability } = await import('@/lib/crypto/key-manager')

        console.log('[DEBUG] Demo login: Checking biometric availability...')
        const biometric = await checkBiometricAvailability()
        console.log('[DEBUG] Demo login: Biometric availability:', JSON.stringify(biometric))
        console.log('[DEBUG] Demo login: available =', biometric.available)
        console.log('[DEBUG] Demo login: biometryType =', biometric.biometryType)

        if (!biometric.available) {
          toast.error('기기에 생체 인증 또는 화면 잠금(PIN/비밀번호)을 설정해주세요.')
          return
        }

        console.log('[DEBUG] Demo login: Generating key pair for variant:', variant)
        const publicKey = await generateKeyPair(variant)
        console.log('[DEBUG] Demo login: Public key generated:', publicKey ? `${publicKey.substring(0, 20)}...` : 'null')

        const deviceInfo = await getDeviceInfo()
        console.log('[DEBUG] Demo login: Device info:', deviceInfo)

        // 공개키와 함께 데모 로그인 요청
        const response = await fetch('/api/auth/demo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            variant,
            name: label,
            publicKey,
            keyAlgorithm: 'ECDSA_P256',
            deviceInfo,
          }),
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
      } else {
        // 웹 플랫폼에서는 기존 방식 (키페어 없이)
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
      }
    } catch (error) {
      console.error('[DEBUG] Demo login error:', error)
      const message = error instanceof Error ? error.message : '로그인 중 문제가 발생했습니다.'
      toast.error(message)
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
    <div className="bg-gradient-to-br from-blue-50 via-purple-50 to-white min-h-screen relative overflow-y-auto">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-blue-400/10 to-purple-400/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-gradient-to-tr from-purple-400/10 to-pink-400/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

      <div className="min-h-screen flex flex-col items-center p-6 pt-20 pb-8 relative z-10">
        {/* 로고 영역 */}
        <div className="text-center mb-10 flex-shrink-0 animate-fade-in">
          <div className="w-28 h-28 bg-blue-500/10 backdrop-blur-xl border border-blue-200/30 rounded-3xl flex items-center justify-center mx-auto mb-6 active:scale-95 transition-transform duration-200">
            <Ticket size={56} className="text-blue-600" strokeWidth={2} />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-3 tracking-tight">
            Ticket Space
          </h1>
          <p className="text-base text-gray-600 font-medium">
            SBT 기반 블록체인 티켓팅 시스템
          </p>
        </div>

        {/* 카카오 로그인 버튼 */}
        <div className="w-full max-w-sm mb-6">
          <KakaoLogin />
        </div>

        {/* 임시 데모 로그인 */}
        <div className="w-full max-w-sm mb-8">
          <div className="bg-white/80 backdrop-blur-sm border border-gray-200 rounded-2xl p-5 shadow-sm">
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
                  className="w-full bg-gray-800/80 backdrop-blur-sm border border-gray-600/30 text-white font-semibold py-3 rounded-xl transition-all duration-200 disabled:opacity-50 shadow-sm active:scale-[0.98]"
                  disabled={demoLoading !== null}
                >
                  {demoLoading === demo.variant ? (
                    <span className="flex items-center justify-center gap-2">
                      <LoadingSpinner size={16} color="inherit" />
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
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-sm overflow-hidden border border-gray-100">
            <div className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-500/10 backdrop-blur-xl border border-blue-200/30 rounded-2xl flex items-center justify-center flex-shrink-0">
                <Shield size={28} className="text-blue-600" strokeWidth={2} />
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-gray-900 text-sm mb-0.5">개인 전용 블록체인 지갑</h4>
                <p className="text-xs text-gray-600">자동 생성되는 안전한 지갑</p>
              </div>
            </div>
          </div>

          <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-sm overflow-hidden border border-gray-100">
            <div className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-500/10 backdrop-blur-xl border border-purple-200/30 rounded-2xl flex items-center justify-center flex-shrink-0">
                <Gem size={28} className="text-purple-600" strokeWidth={2} />
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-gray-900 text-sm mb-0.5">SBT 티켓 소유권</h4>
                <p className="text-xs text-gray-600">블록체인으로 보장되는 진위성</p>
              </div>
            </div>
          </div>

          <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-sm overflow-hidden border border-gray-100">
            <div className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-500/10 backdrop-blur-xl border border-emerald-200/30 rounded-2xl flex items-center justify-center flex-shrink-0">
                <Zap size={28} className="text-emerald-600" strokeWidth={2} />
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
            <LoadingSpinner size={48} />
            <p className="text-gray-600">로그인 준비 중...</p>
          </div>
        </div>
      }
    >
      <LoginPageContent />
    </Suspense>
  )
}