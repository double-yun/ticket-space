'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'

export default function LoginPage() {
  const router = useRouter()
  const [isNative, setIsNative] = useState(false)
  const [kakaoAppAvailable, setKakaoAppAvailable] = useState(false)

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
    }
  }, [router])

  const checkKakaoAppAvailable = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        // 카카오톡 앱 URL 스킴으로 앱 설치 여부 확인
        const canOpen = await App.canOpenUrl({ url: 'kakaotalk://login' })
        setKakaoAppAvailable(canOpen.value)
      }
    } catch (error) {
      console.log('카카오톡 앱 확인 실패:', error)
      setKakaoAppAvailable(false)
    }
  }

  const handleKakaoLogin = async () => {
    // 네이티브 환경이고 카카오톡 앱이 설치되어 있으면 앱으로 로그인 시도
    if (isNative && kakaoAppAvailable) {
      try {
        await handleKakaoAppLogin()
      } catch (error) {
        console.error('카카오톡 앱 로그인 실패:', error)
        // 앱 로그인 실패 시 웹 로그인으로 fallback
        handleWebKakaoLogin()
      }
    } else {
      // 웹 환경이거나 카카오톡 앱이 없으면 웹 로그인
      handleWebKakaoLogin()
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
                <span>카카오로 시작하기</span>
                {isNative && (
                  <span className="text-xs font-normal opacity-75">
                    {kakaoAppAvailable ? '카카오톡 앱으로 로그인' : '웹 로그인'}
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