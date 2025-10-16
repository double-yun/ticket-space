'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { PendingKakaoData } from '@/lib/auth/kakao-pending'
import LoadingSpinner from '@/components/LoadingSpinner'

type UserInfoForm = {
  name: string
  email: string
  phoneNumber: string
  birthDate: string
  gender: string
}

const normalizePhoneNumber = (phoneNumber: string) => {
  if (!phoneNumber) return ''
  return phoneNumber.replace(/^\+82\s?/, '0').replace(/[-\s]/g, '')
}

export default function KakaoAdditionalInfoPage() {
  const router = useRouter()
  const [pendingData, setPendingData] = useState<PendingKakaoData | null>(null)
  const [userInfo, setUserInfo] = useState<UserInfoForm>({
    name: '',
    email: '',
    phoneNumber: '',
    birthDate: '',
    gender: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchPendingData = async () => {
      try {
        const response = await fetch('/api/auth/kakao/pending')

        if (!response.ok) {
          router.replace('/login')
          return
        }

        const data: PendingKakaoData = await response.json()
        setPendingData(data)

        setUserInfo({
          name: data.kakaoData.properties?.nickname || data.kakaoData.kakao_account?.profile?.nickname || '',
          email: data.kakaoData.kakao_account?.email || '',
          phoneNumber: data.kakaoPhoneNumber || '',
          birthDate: '',
          gender: '',
        })
      } catch (error) {
        console.error('Failed to fetch pending kakao data:', error)
        router.replace('/login')
      } finally {
        setLoading(false)
      }
    }

    fetchPendingData()
  }, [router])

  const handleSubmit = () => {
    if (!userInfo.name.trim()) {
      setError('이름을 입력해주세요.')
      return
    }

    if (!userInfo.phoneNumber.trim()) {
      setError('휴대폰 번호를 입력해주세요.')
      return
    }

    setError('')

    const normalizedPhone = normalizePhoneNumber(userInfo.phoneNumber)
    router.push(`/login/verify?phone=${encodeURIComponent(normalizedPhone)}&name=${encodeURIComponent(userInfo.name)}&email=${encodeURIComponent(userInfo.email)}&birthDate=${encodeURIComponent(userInfo.birthDate)}&gender=${encodeURIComponent(userInfo.gender)}`)
  }

  const handleCancel = async () => {
    try {
      await fetch('/api/auth/kakao/pending', { method: 'DELETE' })
    } catch (error) {
      console.error('Failed to clear pending data:', error)
    }
    router.replace('/login')
  }

  if (loading) {
    return (
      <div className="bg-gradient-to-b from-blue-50/30 via-white to-purple-50/30 min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  if (!pendingData) {
    return null
  }

  const isFormValid = userInfo.name.trim() && userInfo.phoneNumber.trim()

  return (
    <div className="bg-gradient-to-b from-blue-50/30 via-white to-purple-50/30 min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-8 shadow-lg border border-gray-200/50">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">회원가입</h1>
            <p className="text-gray-500 mt-2">서비스 이용을 위해 필수 정보를 입력해주세요</p>
          </div>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl relative mb-6" role="alert">
              <span className="block sm:inline">{error}</span>
            </div>
          )}

          <form className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                이름 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="name"
                value={userInfo.name}
                onChange={(event) => setUserInfo({ ...userInfo, name: event.target.value })}
                className="mt-1 block w-full px-4 py-3 bg-white/50 border border-gray-300/50 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                이메일
              </label>
              <input
                type="email"
                id="email"
                value={userInfo.email}
                onChange={(event) => setUserInfo({ ...userInfo, email: event.target.value })}
                className="mt-1 block w-full px-4 py-3 bg-white/50 border border-gray-300/50 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700">
                휴대폰 번호 <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                id="phoneNumber"
                placeholder="010-1234-5678"
                value={userInfo.phoneNumber}
                onChange={(event) => setUserInfo({ ...userInfo, phoneNumber: event.target.value })}
                className="mt-1 block w-full px-4 py-3 bg-white/50 border border-gray-300/50 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label htmlFor="birthDate" className="block text-sm font-medium text-gray-700">
                생년월일
              </label>
              <input
                type="date"
                id="birthDate"
                value={userInfo.birthDate}
                onChange={(event) => setUserInfo({ ...userInfo, birthDate: event.target.value })}
                className="mt-1 block w-full px-4 py-3 bg-white/50 border border-gray-300/50 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label htmlFor="gender" className="block text-sm font-medium text-gray-700">
                성별
              </label>
              <input
                type="text"
                id="gender"
                placeholder="선택 사항"
                value={userInfo.gender}
                onChange={(event) => setUserInfo({ ...userInfo, gender: event.target.value })}
                className="mt-1 block w-full px-4 py-3 bg-white/50 border border-gray-300/50 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <button
                type="button"
                onClick={handleCancel}
                className="w-full bg-gray-200/80 text-gray-800 py-3 px-4 rounded-xl font-semibold transition-all hover:bg-gray-300/80 active:scale-[0.99]"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!isFormValid}
                className="w-full bg-yellow-400 text-black py-3 px-4 rounded-xl font-bold transition-all hover:bg-yellow-500 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                다음 단계로
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
