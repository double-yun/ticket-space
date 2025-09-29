'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [demoLoading, setDemoLoading] = useState<string | null>(null)

  useEffect(() => {
    // 이미 로그인되어 있으면 홈으로 리다이렉트
    fetch('/api/auth/session')
      .then(res => res.json())
      .then(data => {
        if (data.user) {
          router.push('/')
        }
      })
  }, [router])

  const handleKakaoLogin = () => {
    const kakaoAuthUrl = 'https://kauth.kakao.com/oauth/authorize?' +
      new URLSearchParams({
        client_id: '654df22880e0fd9f308a63c1d8eeb8f3',
        redirect_uri: `${window.location.origin}/api/auth/kakao/callback`,
        response_type: 'code',
        scope: 'profile_nickname account_email',
      }).toString()

    window.location.href = kakaoAuthUrl
  }

  const demoUsers = [
    { variant: 'demo1', label: '데모 사용자 1' },
    { variant: 'demo2', label: '데모 사용자 2' },
    { variant: 'demo3', label: '데모 사용자 3' },
  ]

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

      router.push('/')
    } catch (error) {
      const message = error instanceof Error ? error.message : '로그인 중 문제가 발생했습니다.'
      alert(message)
    } finally {
      setDemoLoading(null)
    }
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
              카카오로 시작하기
            </div>
          </button>
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
