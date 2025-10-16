'use client'

import { useState } from 'react'
import type { KakaoUserInfo } from '@/types/kakao'
import { useAuth } from '@/contexts/AuthContext'
import { generateKeyPair, getDeviceInfo, checkBiometricAvailability, isPasskeySupported } from '@/lib/crypto/key-manager'
import { Capacitor } from '@capacitor/core'
import { Clipboard } from '@capacitor/clipboard'

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
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null)
  const [showRecoveryCode, setShowRecoveryCode] = useState(false)

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
      let publicKey = ''
      let deviceInfo = ''

      console.log('[DEBUG] Starting account creation process')

      if (!isPasskeySupported()) {
        setError('PassKey를 지원하지 않는 환경입니다. 모바일 앱 또는 최신 브라우저에서 다시 시도해주세요.')
        setLoading(false)
        return
      }

      console.log('[DEBUG] Checking biometric availability...')
      const biometric = await checkBiometricAvailability()
      console.log('[DEBUG] Biometric availability:', biometric)

      if (!biometric.available) {
        setError('PassKey를 사용하려면 기기 보안 설정(생체 인증 또는 화면 잠금)이 필요합니다.')
        setLoading(false)
        return
      }

      try {
        console.log('[DEBUG] Generating key pair for userId:', kakaoUserInfo.kakaoId)
        publicKey = await generateKeyPair(kakaoUserInfo.kakaoId)
        console.log('[DEBUG] Public key generated:', publicKey ? `${publicKey.substring(0, 20)}...` : 'null')
        console.log('[DEBUG] Full public key length:', publicKey ? publicKey.length : 0)

        console.log('[DEBUG] Getting device info...')
        deviceInfo = await getDeviceInfo()
        console.log('[DEBUG] Device info:', deviceInfo)
      } catch (keyError) {
        console.error('Key generation error:', keyError)
        setError(`보안 키 생성에 실패했습니다: ${keyError instanceof Error ? keyError.message : '인증을 다시 시도해주세요.'}`)
        setLoading(false)
        return
      }

      console.log('[DEBUG] Sending registration request with publicKey:', !!publicKey)
      console.log('[DEBUG] Public key value:', publicKey)
      console.log('[DEBUG] Device info value:', deviceInfo)

      // 2. 서버에 계정 생성 요청 (공개키 포함)
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
          // 비대칭 키 인증 필드
          publicKey,
          keyAlgorithm: 'ECDSA_P256',
          deviceInfo,
        })
      })

      if (response.ok) {
        const data = await response.json()
        console.log('[DEBUG] Registration response data:', data)
        console.log('[DEBUG] Recovery code received:', data.recoveryCode)

        // JWT 토큰 저장
        if (data.token) {
          setAuthToken(data.token)
        }

        // 복구 코드가 있으면 표시
        if (data.recoveryCode) {
          console.log('[DEBUG] Setting recovery code and showing UI')
          setRecoveryCode(data.recoveryCode)
          setShowRecoveryCode(true)
        } else {
          // 복구 코드가 없으면 바로 완료
          console.log('[DEBUG] No recovery code, proceeding to onAccountCreated')
          onAccountCreated()
        }
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

  // 복구 코드 복사 함수
  const copyRecoveryCode = async () => {
    if (recoveryCode) {
      try {
        if (Capacitor.isNativePlatform()) {
          // 네이티브 플랫폼에서는 Capacitor Clipboard API 사용
          await Clipboard.write({
            string: recoveryCode
          })
        } else {
          // 웹에서는 navigator.clipboard 사용
          await navigator.clipboard.writeText(recoveryCode)
        }
        alert('복구 코드가 클립보드에 복사되었습니다.')
      } catch (err) {
        console.error('복사 실패:', err)
        alert('복구 코드 복사에 실패했습니다.')
      }
    }
  }

  // 복구 코드 확인 후 완료
  const handleRecoveryCodeConfirm = () => {
    onAccountCreated()
  }

  // 복구 코드 표시 화면
  if (showRecoveryCode && recoveryCode) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-6 w-full max-w-md mx-4">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🔑</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            복구 코드 저장
          </h2>
          <p className="text-gray-600 text-sm">
            <strong className="text-red-600">반드시 안전한 곳에 보관하세요!</strong>
          </p>
        </div>

        {/* 암표 거래 방지 보안 경고 */}
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 mb-4">
          <div className="flex items-start gap-2 mb-2">
            <span className="text-red-600 text-lg flex-shrink-0">🛡️</span>
            <div>
              <p className="text-sm font-bold text-red-900 mb-2">암표 거래 방지 보안 정책</p>
              <p className="text-xs text-red-800 leading-relaxed mb-2">
                본 서비스는 <strong>암표 거래 방지</strong>를 위해 강력한 보안 조치를 적용하고 있습니다.
              </p>
              <p className="text-xs text-red-800 leading-relaxed">
                앱 삭제, 기기 분실/변경 시 계정 복구가 필요하며, <strong className="text-red-900">계정 복구 시 이전에 예매한 티켓은 모두 사용할 수 없습니다.</strong>
              </p>
            </div>
          </div>
        </div>

        <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4 mb-4">
          <p className="text-xs text-yellow-800 font-semibold mb-2">복구 코드 (12단어)</p>
          <div className="bg-white p-3 rounded-lg font-mono text-sm text-gray-800 break-all">
            {recoveryCode}
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
          <p className="text-xs text-amber-800">
            ⚠️ <strong>중요:</strong> 이 코드는 다시 확인할 수 없습니다. 지금 바로 안전한 곳에 저장하세요.
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={copyRecoveryCode}
            className="w-full bg-blue-500 text-white py-3 px-4 rounded-xl hover:bg-blue-600 transition-colors"
          >
            📋 복구 코드 복사
          </button>
          <button
            onClick={handleRecoveryCodeConfirm}
            className="w-full bg-gray-500 text-white py-3 px-4 rounded-xl hover:bg-gray-600 transition-colors"
          >
            ✅ 복구 코드를 안전하게 보관했습니다
          </button>
        </div>

        <div className="mt-4 text-center">
          <p className="text-xs text-gray-500">
            복구 코드를 분실하면 기기 변경 시 계정을 복구할 수 없습니다.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 w-full max-w-md mx-4">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          계정 생성
        </h2>
        <p className="text-gray-600 mb-2">
          마지막 단계입니다. 닉네임과 이메일을 입력해주세요.
        </p>
        {Capacitor.isNativePlatform() && (
          <div className="bg-blue-50 p-3 rounded-lg mt-3">
            <p className="text-xs text-blue-700">
              🔐 보안 강화를 위해 생체 인증 또는 화면 잠금 인증이 필요합니다
            </p>
          </div>
        )}
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
