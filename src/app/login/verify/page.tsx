'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { setupRecaptcha, sendSMSVerification, verifySMSCode } from '@/lib/firebase'
import { RecaptchaVerifier, type ConfirmationResult } from 'firebase/auth'
import type { FirebaseError } from 'firebase/app'
import type { KakaoRegistrationPayload } from '@/types/kakao'
import type { PendingKakaoData } from '@/lib/auth/kakao-pending'
import { useAuth } from '@/contexts/AuthContext'
import { Capacitor } from '@capacitor/core'
import { generateKeyPair, getDeviceInfo, checkBiometricAvailability } from '@/lib/crypto/key-manager'
import LoadingSpinner from '@/components/LoadingSpinner'

const normalizePhoneNumber = (phoneNumber: string) => {
  if (!phoneNumber) return ''
  return phoneNumber.replace(/^\+82\s?/, '0').replace(/[-\s]/g, '')
}

const toE164 = (phoneNumber: string) => {
  const cleaned = phoneNumber.replace(/\D/g, '')
  if (cleaned.startsWith('0')) {
    return `+82${cleaned.substring(1)}`
  }
  return phoneNumber.startsWith('+') ? phoneNumber : `+${cleaned}`
}

function KakaoPhoneVerificationContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { setAuthToken } = useAuth()
  const [pendingData, setPendingData] = useState<PendingKakaoData | null>(null)
  const [phoneNumber, setPhoneNumber] = useState('')
  const [userInfo, setUserInfo] = useState({
    name: '',
    email: '',
    birthDate: '',
    gender: '',
  })
  const [verificationCode, setVerificationCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [error, setError] = useState('')
  const [recaptchaVerifier, setRecaptchaVerifier] = useState<RecaptchaVerifier | null>(null)
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null)
  const [codeRequested, setCodeRequested] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const phone = searchParams.get('phone') || ''
        const name = searchParams.get('name') || ''
        const email = searchParams.get('email') || ''
        const birthDate = searchParams.get('birthDate') || ''
        const gender = searchParams.get('gender') || ''

        if (!phone || !name) {
          router.replace('/login/info')
          return
        }

        setPhoneNumber(phone)
        setUserInfo({ name, email, birthDate, gender })

        const response = await fetch('/api/auth/kakao/pending')
        if (!response.ok) {
          router.replace('/login')
          return
        }

        const data: PendingKakaoData = await response.json()
        setPendingData(data)
      } catch (error) {
        console.error('Failed to load data:', error)
        router.replace('/login')
      } finally {
        setInitialLoading(false)
      }
    }

    fetchData()
  }, [router, searchParams])

  useEffect(() => {
    if (!recaptchaVerifier && !initialLoading) {
      try {
        const verifier = setupRecaptcha('recaptcha-container')
        setRecaptchaVerifier(verifier)
      } catch (error) {
        console.error('reCAPTCHA 초기화 실패:', error)
        setError('reCAPTCHA 설정에 실패했습니다. 페이지를 새로고침해주세요.')
      }
    }

    return () => {
      recaptchaVerifier?.clear()
    }
  }, [recaptchaVerifier, initialLoading])

  const displayPhoneNumber = useMemo(() => {
    if (!phoneNumber) return ''
    const normalized = normalizePhoneNumber(phoneNumber)
    if (normalized.length === 11) {
      return `${normalized.substring(0, 3)}-${normalized.substring(3, 7)}-${normalized.substring(7)}`
    }
    return normalized
  }, [phoneNumber])

  const isFirebaseError = (value: unknown): value is FirebaseError => {
    return typeof value === 'object' && value !== null && 'code' in value
  }

  const handleSendCode = async () => {
    const normalized = normalizePhoneNumber(phoneNumber)
    if (!normalized) {
      setError('휴대폰 번호가 유효하지 않습니다.')
      return
    }

    if (!recaptchaVerifier) {
      setError('reCAPTCHA가 준비되지 않았습니다. 페이지를 새로고침해주세요.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const formattedPhone = toE164(normalized)
      const confirmation = await sendSMSVerification(formattedPhone, recaptchaVerifier)
      setConfirmationResult(confirmation)
      setCodeRequested(true)
    } catch (error: unknown) {
      console.error('인증번호 전송 실패:', error)
      if (isFirebaseError(error) && error.code === 'auth/too-many-requests') {
        setError('너무 많은 요청입니다. 잠시 후 다시 시도해주세요.')
      } else if (isFirebaseError(error) && error.code === 'auth/invalid-phone-number') {
        setError('유효하지 않은 전화번호입니다.')
      } else if (isFirebaseError(error) && error.code === 'auth/quota-exceeded') {
        setError('일일 문자 전송 한도를 초과했습니다. 잠시 후 다시 시도해주세요.')
      } else {
        setError('인증번호 전송에 실패했습니다. 다시 시도해주세요.')
      }
    }
    finally {
      setLoading(false)
    }
  }

  const handleVerifyCode = async () => {
    if (!verificationCode.trim()) {
      setError('인증번호를 입력해주세요.')
      return
    }

    if (!confirmationResult) {
      setError('인증번호를 다시 요청해주세요.')
      return
    }

    if (!pendingData) {
      setError('로그인 세션 정보를 찾을 수 없습니다. 다시 시도해주세요.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const verificationResult = await verifySMSCode(confirmationResult, verificationCode)
      const verifiedPhoneNumber = verificationResult.phoneNumber

      let publicKey = ''
      let deviceInfo = ''

      if (Capacitor.isNativePlatform()) {
        const biometric = await checkBiometricAvailability()

        if (!biometric.available) {
          setError('기기에 생체 인증 또는 화면 잠금(PIN/비밀번호)을 설정해주세요.')
          setLoading(false)
          return
        }

        try {
          publicKey = await generateKeyPair(pendingData.kakaoData.id.toString())
          deviceInfo = await getDeviceInfo()
        } catch (keyError) {
          console.error('Key generation error:', keyError)
          setError(`보안 키 생성에 실패했습니다: ${keyError instanceof Error ? keyError.message : '인증을 다시 시도해주세요.'}`)
          setLoading(false)
          return
        }
      }

      const registrationPayload: KakaoRegistrationPayload = {
        kakaoId: pendingData.kakaoData.id.toString(),
        name: userInfo.name,
        email: userInfo.email,
        phoneNumber: verifiedPhoneNumber,
        birthDate: userInfo.birthDate,
        gender: userInfo.gender,
        accessToken: pendingData.accessToken,
        refreshToken: pendingData.refreshToken,
        phoneVerified: true,
        publicKey,
        keyAlgorithm: 'ECDSA_P256',
        deviceInfo,
      }

      const response = await fetch('/api/auth/kakao/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(registrationPayload),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || '회원가입에 실패했습니다.')
      }

      const data = await response.json()

      if (data.token) {
        setAuthToken(data.token)
      }

      router.replace('/')
    } catch (error: unknown) {
      console.error('전화번호 인증 실패:', error)
      if (isFirebaseError(error) && error.code === 'auth/invalid-verification-code') {
        setError('인증번호가 올바르지 않습니다.')
      } else if (isFirebaseError(error) && error.code === 'auth/code-expired') {
        setError('인증번호가 만료되었습니다. 다시 요청해주세요.')
        setConfirmationResult(null)
        setCodeRequested(false)
        setVerificationCode('')
      } else if (error instanceof Error) {
        setError(error.message)
      } else {
        setError('인증 처리 중 오류가 발생했습니다.')
      }
    }
    finally {
      setLoading(false)
    }
  }

  const handleGoBack = () => {
    router.push('/login/info')
  }

  const handleRetry = () => {
    setCodeRequested(false)
    setVerificationCode('')
    setConfirmationResult(null)
    setError('')
  }

  if (initialLoading) {
    return (
      <div className="bg-gradient-to-b from-blue-50/30 via-white to-purple-50/30 min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  if (!pendingData) {
    return null
  }

  return (
    <div className="bg-gradient-to-b from-blue-50/30 via-white to-purple-50/30 min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-8 shadow-lg border border-gray-200/50">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">휴대폰 인증</h1>
            <p className="text-gray-500 mt-2">
              {codeRequested
                ? `${displayPhoneNumber}로 전송된 인증번호를 입력해주세요`
                : '회원가입을 완료하기 위해 휴대폰 인증이 필요합니다'}
            </p>
          </div>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl relative mb-6" role="alert">
              <span className="block sm:inline">{error}</span>
            </div>
          )}

          {!codeRequested ? (
            <div className="space-y-6">
              <div>
                <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700">
                  휴대폰 번호
                </label>
                <input
                  type="tel"
                  id="phoneNumber"
                  value={displayPhoneNumber}
                  disabled
                  className="mt-1 block w-full px-4 py-3 bg-gray-100/80 border border-gray-300/50 rounded-xl shadow-sm placeholder-gray-400 cursor-not-allowed"
                />
              </div>

              <div id="recaptcha-container" className="flex justify-center" />

              <div className="flex flex-col sm:flex-row gap-4 pt-2">
                <button
                  type="button"
                  onClick={handleGoBack}
                  disabled={loading}
                  className="w-full bg-gray-200/80 text-gray-800 py-3 px-4 rounded-xl font-semibold transition-all hover:bg-gray-300/80 active:scale-[0.99] disabled:opacity-50"
                >
                  이전 단계
                </button>
                <button
                  type="button"
                  onClick={handleSendCode}
                  disabled={loading}
                  className="w-full bg-yellow-400 text-black py-3 px-4 rounded-xl font-bold transition-all hover:bg-yellow-500 active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? <LoadingSpinner size={20} /> : '인증번호 받기'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <label htmlFor="verificationCode" className="block text-sm font-medium text-gray-700">
                  인증번호
                </label>
                <input
                  type="text"
                  id="verificationCode"
                  value={verificationCode}
                  onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                  maxLength={6}
                  className="mt-1 block w-full px-4 py-3 bg-white/50 border border-gray-300/50 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-2xl tracking-[0.5em]"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-4 pt-2">
                <button
                  type="button"
                  onClick={handleRetry}
                  disabled={loading}
                  className="w-full bg-gray-200/80 text-gray-800 py-3 px-4 rounded-xl font-semibold transition-all hover:bg-gray-300/80 active:scale-[0.99] disabled:opacity-50"
                >
                  다시 받기
                </button>
                <button
                  type="button"
                  onClick={handleVerifyCode}
                  disabled={loading || verificationCode.length < 4}
                  className="w-full bg-yellow-400 text-black py-3 px-4 rounded-xl font-bold transition-all hover:bg-yellow-500 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? <LoadingSpinner size={20} /> : '인증 완료'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function KakaoPhoneVerificationPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-gradient-to-b from-blue-50/30 via-white to-purple-50/30 min-h-screen flex items-center justify-center">
          <LoadingSpinner />
        </div>
      }
    >
      <KakaoPhoneVerificationContent />
    </Suspense>
  )
}
