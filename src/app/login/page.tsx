'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import PhoneVerification from '@/components/PhoneVerification'
import AccountCreationForm from '@/components/AccountCreationForm'

// Cordova appAvailability 플러그인 선언
declare var appAvailability: any

export default function LoginPage() {
  const router = useRouter()
  const [isNative, setIsNative] = useState(false)
  const [kakaoAppAvailable, setKakaoAppAvailable] = useState(false)
  const [showPhoneVerification, setShowPhoneVerification] = useState(false)
  const [kakaoUserInfo, setKakaoUserInfo] = useState<any>(null)
  const [showAccountCreation, setShowAccountCreation] = useState(false)

  useEffect(() => {
    setIsNative(Capacitor.isNativePlatform())

    // 이미 로그인되어 있으면 홈으로 리다이렉트
    fetch('/api/auth/session')
      .then(res => res.json())
      .then(data => {
        if (data.user) {
          router.push('/')
        }
      })

    // 네이티브 환경에서 카카오톡 앱 설치 여부 확인
    if (Capacitor.isNativePlatform()) {
      checkKakaoAppAvailable()
      setupAppUrlListener()
    }
  }, [router])

  const checkKakaoAppAvailable = async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        // appAvailability 플러그인이 로드될 때까지 잠깐 기다림
        setTimeout(() => {
          if (typeof appAvailability !== 'undefined') {
            const scheme = Capacitor.getPlatform() === 'android'
              ? 'com.kakao.talk'  // 안드로이드 패키지명
              : 'kakaolink://'    // iOS URL 스킴

            appAvailability.check(
              scheme,
              () => {
                console.log('카카오톡 설치됨')
                setKakaoAppAvailable(true)
              },
              () => {
                console.log('카카오톡 없음')
                setKakaoAppAvailable(false)
              }
            )
          } else {
            console.log('appAvailability 플러그인 로드 안됨, 기본값으로 설정')
            setKakaoAppAvailable(true)
          }
        }, 1000)
      } catch (error) {
        console.log('카카오톡 앱 확인 중 에러:', error)
        setKakaoAppAvailable(true)
      }
    } else {
      setKakaoAppAvailable(false)
    }
  }

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
          const userCheckResponse = await fetch('/api/auth/kakao/check-user', {
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

  const handleKakaoLogin = async () => {
    // 네이티브 환경에서만 로그인 허용
    if (!isNative) {
      alert('모바일 앱에서만 사용 가능합니다.')
      return
    }

    // 카카오톡 앱이 설치되어 있지 않으면 차단
    if (!kakaoAppAvailable) {
      alert('카카오톡 앱이 설치되어 있지 않습니다. 카카오톡 앱을 설치한 후 다시 시도해주세요.')
      return
    }

    try {
      await handleKakaoAppLogin()
    } catch (error) {
      console.error('카카오톡 앱 로그인 실패:', error)
      alert('카카오톡 로그인에 실패했습니다. 다시 시도해주세요.')
    }
  }

  const handleKakaoAppLogin = async () => {
    // 카카오톡 앱으로 로그인 URL 생성
    const kakaoAppUrl = 'kakaotalk://login?' +
      new URLSearchParams({
        client_id: '654df22880e0fd9f308a63c1d8eeb8f3',
        redirect_uri: 'com.ticketing.app://oauth',
        response_type: 'code',
        scope: 'profile_nickname account_email',
      }).toString()

    // 카카오톡 앱 열기
    await App.openUrl({ url: kakaoAppUrl })
  }

  const handleWebKakaoLogin = () => {
    const kakaoAuthUrl = 'https://kauth.kakao.com/oauth/authorize?' +
      new URLSearchParams({
        client_id: '654df22880e0fd9f308a63c1d8eeb8f3',
        redirect_uri: `${window.location.origin}/api/auth/kakao/callback`,
        response_type: 'code',
        scope: 'profile_nickname account_email',
      }).toString()

    window.location.href = kakaoAuthUrl
  }

  const handlePhoneVerificationSuccess = async (phoneNumber: string) => {
    if (kakaoUserInfo) {
      // 카카오 로그인 플로우: 인증된 전화번호로 기존 계정 확인
      try {
        const userCheckResponse = await fetch('/api/auth/kakao/check-user', {
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
        setKakaoUserInfo(prev => ({ ...prev, phoneNumber }))
        setShowPhoneVerification(false)
        setShowAccountCreation(true)
      } catch (error) {
        console.error('사용자 확인 중 오류:', error)
        alert('사용자 확인 중 오류가 발생했습니다.')
      }
    } else {
      // 일반 휴대폰 로그인 플로우
      try {
        const response = await fetch('/api/auth/phone/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            phoneNumber
          })
        })

        if (response.ok) {
          router.push('/')
        } else {
          console.error('로그인 처리 실패')
        }
      } catch (error) {
        console.error('로그인 에러:', error)
      }
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

  if (showAccountCreation) {
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
          <button
            onClick={handleKakaoLogin}
            className="w-full bg-yellow-400 text-black font-semibold text-lg py-4 rounded-xl shadow-lg hover:bg-yellow-300 transition-all duration-200"
          >
            <div className="flex items-center justify-center gap-3">
              <span className="text-xl">💬</span>
              <div className="flex flex-col items-center">
                <span>카카오톡으로 시작하기</span>
                {isNative && (
                  <span className="text-xs font-normal opacity-75">
                    {kakaoAppAvailable ? '카카오톡 앱 필수' : '카카오톡 앱을 설치해주세요'}
                  </span>
                )}
              </div>
            </div>
          </button>
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