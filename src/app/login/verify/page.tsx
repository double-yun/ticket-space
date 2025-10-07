'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Alert, Box, Button, Card, CardContent, CircularProgress, TextField, Typography } from '@mui/material'
import { setupRecaptcha, sendSMSVerification, verifySMSCode } from '@/lib/firebase'
import { RecaptchaVerifier, type ConfirmationResult } from 'firebase/auth'
import type { FirebaseError } from 'firebase/app'
import type { KakaoRegistrationPayload } from '@/types/kakao'
import type { PendingKakaoData } from '@/lib/auth/kakao-pending'

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
        // Query params에서 사용자 정보 가져오기
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

        // 쿠키에서 pending data 가져오기
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
    } finally {
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
      <Box sx={{ minHeight: '100vh', bgcolor: 'grey.50', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
        <Typography>로딩 중...</Typography>
      </Box>
    )
  }

  if (!pendingData) {
    return null
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'grey.50', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
      <Card sx={{ maxWidth: 420, width: '100%' }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h5" component="h1" align="center" fontWeight="bold" gutterBottom>
            휴대폰 인증
          </Typography>
          <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>
            {codeRequested
              ? `${displayPhoneNumber}로 전송된 인증번호를 입력해주세요`
              : '회원가입을 완료하기 위해 휴대폰 인증이 필요합니다'}
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {!codeRequested ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                fullWidth
                label="휴대폰 번호"
                value={phoneNumber}
                disabled
              />

              <Box id="recaptcha-container" sx={{ display: 'flex', justifyContent: 'center' }} />

              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button
                  variant="outlined"
                  onClick={handleGoBack}
                  disabled={loading}
                  fullWidth
                >
                  이전 단계
                </Button>
                <Button
                  variant="contained"
                  onClick={handleSendCode}
                  disabled={loading}
                  fullWidth
                  sx={{ backgroundColor: '#FEE500', color: '#000', '&:hover': { backgroundColor: '#FCDD00' } }}
                >
                  {loading ? <CircularProgress size={20} /> : '인증번호 받기'}
                </Button>
              </Box>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                fullWidth
                label="인증번호"
                value={verificationCode}
                onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                slotProps={{
                  htmlInput: {
                    maxLength: 6
                  }
                }}
              />

              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button
                  variant="outlined"
                  onClick={handleRetry}
                  disabled={loading}
                  fullWidth
                >
                  다시 받기
                </Button>
                <Button
                  variant="contained"
                  onClick={handleVerifyCode}
                  disabled={loading || verificationCode.length < 4}
                  fullWidth
                  sx={{ backgroundColor: '#FEE500', color: '#000', '&:hover': { backgroundColor: '#FCDD00' } }}
                >
                  {loading ? <CircularProgress size={20} /> : '인증 완료'}
                </Button>
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  )
}

export default function KakaoPhoneVerificationPage() {
  return (
    <Suspense
      fallback={
        <Box sx={{ minHeight: '100vh', bgcolor: 'grey.50', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
          <Typography>로딩 중...</Typography>
        </Box>
      }
    >
      <KakaoPhoneVerificationContent />
    </Suspense>
  )
}
