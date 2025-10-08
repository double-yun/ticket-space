'use client'

import { useState } from 'react'
import type { KakaoUserInfo } from '@/types/kakao'
import { useAuth } from '@/contexts/AuthContext'

interface AccountCreationFormProps {
  kakaoUserInfo: KakaoUserInfo
  onAccountCreated: () => void
  onCancel: () => void
}

export default function AccountCreationForm({ kakaoUserInfo, onAccountCreated, onCancel }: AccountCreationFormProps) {
  const { setAuthToken } = useAuth()
  const [nickname, setNickname] = useState(kakaoUserInfo?.nickname || '')
  const [email, setEmail] = useState(kakaoUserInfo?.email || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!nickname.trim()) {
      setError('닉네임을 입력해주세요.')
      return
    }

    if (!email.trim()) {
      setError('이메일을 입력해주세요.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/auth/kakao/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          kakaoId: kakaoUserInfo.kakaoId,
          phoneNumber: kakaoUserInfo.phoneNumber,
          name: nickname.trim(),
          email: email.trim(),
          phoneVerified: true,
        })
      })

      if (response.ok) {
        const data = await response.json()

        // JWT 토큰 저장
        if (data.token) {
          setAuthToken(data.token)
        }

        onAccountCreated()
      } else {
        const data = await response.json()
        setError(data.error || '계정 생성에 실패했습니다.')
      }
    } catch (error) {
      console.error('계정 생성 에러:', error)
      setError('계정 생성 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 w-full max-w-md mx-4">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          계정 생성
        </h2>
        <p className="text-gray-600">
          마지막 단계입니다. 닉네임과 이메일을 입력해주세요.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            카카오 계정 정보
          </label>
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-sm text-gray-600">
              전화번호: {kakaoUserInfo?.phoneNumber}
            </p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            닉네임 *
          </label>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="닉네임을 입력하세요"
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={loading}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            이메일 *
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="example@email.com"
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={loading}
            required
          />
        </div>

        {error && (
          <div className="text-red-500 text-sm text-center bg-red-50 p-3 rounded-lg">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 px-4 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
            disabled={loading}
          >
            취소
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-blue-500 text-white py-3 px-4 rounded-xl hover:bg-blue-600 transition-colors disabled:opacity-50"
          >
            {loading ? '생성 중...' : '계정 생성'}
          </button>
        </div>
      </form>

      <div className="mt-6 text-center">
        <p className="text-xs text-gray-500">
          계정 생성 시 서비스 이용약관 및 개인정보처리방침에 동의한 것으로 간주됩니다.
        </p>
      </div>
    </div>
  )
}
