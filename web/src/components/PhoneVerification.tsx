'use client'

import { useState, useEffect, useRef } from 'react'
import { setupRecaptcha, sendSMSVerification, verifySMSCode } from '@/lib/firebase'
import { RecaptchaVerifier } from 'firebase/auth'

interface PhoneVerificationProps {
  onVerificationSuccess: (phoneNumber: string) => void
  onCancel: () => void
}

export default function PhoneVerification({ onVerificationSuccess, onCancel }: PhoneVerificationProps) {
  const [phoneNumber, setPhoneNumber] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [step, setStep] = useState<'phone' | 'code'>('phone')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [recaptchaVerifier, setRecaptchaVerifier] = useState<RecaptchaVerifier | null>(null)
  const [confirmationResult, setConfirmationResult] = useState<any>(null)

  useEffect(() => {
    // reCAPTCHA 설정
    const setupCaptcha = () => {
      try {
        const verifier = setupRecaptcha('recaptcha-container')
        setRecaptchaVerifier(verifier)
      } catch (error) {
        console.error('reCAPTCHA 설정 실패:', error)
        setError('reCAPTCHA 설정에 실패했습니다.')
      }
    }

    setupCaptcha()

    return () => {
      if (recaptchaVerifier) {
        recaptchaVerifier.clear()
      }
    }
  }, [])

  const formatPhoneNumber = (phone: string) => {
    // 한국 번호 형식으로 변환 (010-1234-5678 → +821012345678)
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned.startsWith('010')) {
      return `+82${cleaned.substring(1)}`
    }
    return phone
  }

  const handleSendCode = async () => {
    if (!phoneNumber.trim()) {
      setError('전화번호를 입력해주세요.')
      return
    }

    if (!recaptchaVerifier) {
      setError('reCAPTCHA가 준비되지 않았습니다. 페이지를 새로고침해주세요.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const formattedPhone = formatPhoneNumber(phoneNumber)
      const confirmation = await sendSMSVerification(formattedPhone, recaptchaVerifier)
      setConfirmationResult(confirmation)
      setStep('code')
    } catch (error: any) {
      console.error('SMS 전송 실패:', error)
      if (error.code === 'auth/too-many-requests') {
        setError('너무 많은 요청입니다. 잠시 후 다시 시도해주세요.')
      } else if (error.code === 'auth/invalid-phone-number') {
        setError('유효하지 않은 전화번호입니다.')
      } else if (error.code === 'auth/quota-exceeded') {
        setError('일일 SMS 한도를 초과했습니다.')
      } else {
        setError('인증번호 전송에 실패했습니다. 다시 시도해주세요.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyCode = async () => {
    if (!verificationCode.trim()) {
      setError('인증번호를 입력해주세요.')
      return
    }

    if (!confirmationResult) {
      setError('인증을 다시 시도해주세요.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const result = await verifySMSCode(confirmationResult, verificationCode)
      onVerificationSuccess(result.phoneNumber)
    } catch (error: any) {
      console.error('코드 확인 실패:', error)
      if (error.code === 'auth/invalid-verification-code') {
        setError('잘못된 인증번호입니다.')
      } else if (error.code === 'auth/code-expired') {
        setError('인증번호가 만료되었습니다.')
        setStep('phone')
        setConfirmationResult(null)
      } else {
        setError('인증에 실패했습니다. 다시 시도해주세요.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleBack = () => {
    if (step === 'code') {
      setStep('phone')
      setVerificationCode('')
      setError('')
    } else {
      onCancel()
    }
  }

  const handleRetryCode = () => {
    setStep('phone')
    setVerificationCode('')
    setConfirmationResult(null)
    setError('')
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 w-full max-w-md mx-4">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          휴대폰 인증
        </h2>
        <p className="text-gray-600">
          {step === 'phone'
            ? '휴대폰 번호를 입력하고 인증번호를 받아주세요'
            : '전송된 인증번호 6자리를 입력해주세요'
          }
        </p>
      </div>

      {step === 'phone' ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              휴대폰 번호
            </label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="010-1234-5678"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
              disabled={loading}
            />
          </div>

          {/* reCAPTCHA */}
          <div id="recaptcha-container" className="flex justify-center"></div>

          {error && (
            <div className="text-red-500 text-sm text-center bg-red-50 p-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleBack}
              className="flex-1 py-3 px-4 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
              disabled={loading}
            >
              취소
            </button>
            <button
              onClick={handleSendCode}
              disabled={loading}
              className="flex-1 bg-blue-500 text-white py-3 px-4 rounded-xl hover:bg-blue-600 transition-colors disabled:opacity-50"
            >
              {loading ? '전송 중...' : '인증번호 받기'}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              인증번호
            </label>
            <input
              type="text"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
              maxLength={6}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg text-center tracking-widest"
              disabled={loading}
            />
            <p className="text-sm text-gray-500 mt-2 text-center">
              {formatPhoneNumber(phoneNumber)}로 전송된 인증번호를 입력하세요
            </p>
          </div>

          {error && (
            <div className="text-red-500 text-sm text-center bg-red-50 p-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleBack}
              className="flex-1 py-3 px-4 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
              disabled={loading}
            >
              뒤로
            </button>
            <button
              onClick={handleVerifyCode}
              disabled={loading}
              className="flex-1 bg-blue-500 text-white py-3 px-4 rounded-xl hover:bg-blue-600 transition-colors disabled:opacity-50"
            >
              {loading ? '확인 중...' : '확인'}
            </button>
          </div>

          <button
            onClick={handleRetryCode}
            className="w-full text-blue-500 text-sm hover:underline"
            disabled={loading}
          >
            인증번호를 다시 받으시겠어요?
          </button>
        </div>
      )}
    </div>
  )
}