'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Alert, Box, Button, Card, CardContent, CircularProgress, TextField, Typography } from '@mui/material'
import { setupRecaptcha, sendSMSVerification, verifySMSCode } from '@/lib/firebase'
import { RecaptchaVerifier, type ConfirmationResult } from 'firebase/auth'
import type { FirebaseError } from 'firebase/app'
import type { KakaoRegistrationPayload, PendingKakaoUserData } from '@/types/kakao'

type StoredPendingUser = PendingKakaoUserData & {
  requiresInfoStep: boolean
}

type StoredUserInfo = {
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

const toE164 = (phoneNumber: string) => {
  const cleaned = phoneNumber.replace(/\D/g, '')
  if (cleaned.startsWith('0')) {
    return `+82${cleaned.substring(1)}`
  }
  return phoneNumber.startsWith('+') ? phoneNumber : `+${cleaned}`
}

export default function KakaoPhoneVerificationPage() {
  const router = useRouter()
  const [pendingUser, setPendingUser] = useState<StoredPendingUser | null>(null)
  const [userInfo, setUserInfo] = useState<StoredUserInfo | null>(null)
  const [phoneNumber, setPhoneNumber] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [recaptchaVerifier, setRecaptchaVerifier] = useState<RecaptchaVerifier | null>(null)
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null)
  const [codeRequested, setCodeRequested] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const storedPending = sessionStorage.getItem('kakaoPendingUser')
    if (!storedPending) {
      router.replace('/login')
      return
    }

    try {
      const parsed: StoredPendingUser = JSON.parse(storedPending)

      if (parsed.requiresInfoStep) {
        router.replace('/login/info')
        return
      }

      setPendingUser(parsed)

      const storedInfo = sessionStorage.getItem('kakaoUserInfo')
      if (storedInfo) {
        const parsedInfo = JSON.parse(storedInfo) as StoredUserInfo
        setUserInfo(parsedInfo)
        setPhoneNumber(parsedInfo.phoneNumber)
      } else if (parsed.kakaoPhoneNumber) {
        setPhoneNumber(parsed.kakaoPhoneNumber)
      } else {
        router.replace('/login/info')
      }
    } catch (parseError) {
      console.error('카카오 임시 로그인 데이터를 불러오지 못했습니다:', parseError)
      sessionStorage.removeItem('kakaoPendingUser')
      router.replace('/login')
    }
  }, [router])

  useEffect(() => {
    if (!recaptchaVerifier) {
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
  }, [recaptchaVerifier])

  const expectedPhone = useMemo(() => pendingUser?.kakaoPhoneNumber ?? '', [pendingUser])

  const canEditPhone = useMemo(() => {
    if (!pendingUser) return false
    if (!pendingUser.isExistingUser) {
      return true
    }
    if (!pendingUser.kakaoPhoneNumber) {
      return true
    }
    // 기존 사용자이지만 정보 입력 단계에서 번호를 직접 입력한 경우
    return Boolean(userInfo)
  }, [pendingUser, userInfo])

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
      setError('휴대폰 번호가 유효하지 않습니다. 이전 단계로 돌아가 다시 입력해주세요.')
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

    if (!pendingUser) {
      setError('로그인 세션 정보를 찾을 수 없습니다. 다시 시도해주세요.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const verificationResult = await verifySMSCode(confirmationResult, verificationCode)
      const verifiedPhoneNumber = verificationResult.phoneNumber
      const normalizedVerified = normalizePhoneNumber(verifiedPhoneNumber)
      const normalizedExpected = normalizePhoneNumber(phoneNumber)

      if (pendingUser.kakaoPhoneNumber && normalizedVerified !== normalizedExpected) {
        throw new Error('인증된 휴대폰 번호가 카카오 계정 정보와 일치하지 않습니다.')
      }

      if (pendingUser.isExistingUser) {
        const response = await fetch('/api/auth/kakao/app-login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            accessToken: pendingUser.accessToken,
            refreshToken: pendingUser.refreshToken,
            userData: pendingUser.kakaoData,
            verifiedPhoneNumber: normalizedVerified,
          }),
        })

        if (!response.ok) {
          throw new Error('로그인 처리에 실패했습니다.')
        }
      } else {
        if (!userInfo) {
          throw new Error('사용자 추가 정보를 찾을 수 없습니다. 처음부터 다시 시도해주세요.')
        }

        const registrationPayload: KakaoRegistrationPayload = {
          kakaoId: pendingUser.kakaoData.id.toString(),
          name: userInfo.name,
          email: userInfo.email,
          phoneNumber: verifiedPhoneNumber,
          birthDate: userInfo.birthDate,
          gender: userInfo.gender,
          accessToken: pendingUser.accessToken,
          refreshToken: pendingUser.refreshToken,
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
      }

      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('kakaoPendingUser')
        sessionStorage.removeItem('kakaoUserInfo')
        sessionStorage.removeItem('kakaoAuthData')
        sessionStorage.removeItem('kakaoLoginRedirect')
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
              : '서비스 이용을 위해 휴대폰 인증이 필요합니다'}
          </Typography>

          {pendingUser?.isExistingUser && expectedPhone && (
            <Box sx={{ mb: 2, p: 2, bgcolor: 'info.light', borderRadius: 1 }}>
              <Typography variant="body2" align="center">
                카카오 계정에 등록된 번호: {displayPhoneNumber}
              </Typography>
            </Box>
          )}

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
                onChange={(event) => setPhoneNumber(event.target.value)}
                disabled={!canEditPhone || loading}
              />

              <Box id="recaptcha-container" sx={{ display: 'flex', justifyContent: 'center' }} />

              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button
                  variant="outlined"
                  onClick={canEditPhone ? handleGoBack : () => router.replace('/login')}
                  disabled={loading}
                  fullWidth
                >
                  {canEditPhone ? '이전 단계' : '취소'}
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
                inputProps={{ maxLength: 6 }}
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
