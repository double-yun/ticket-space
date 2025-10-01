'use client'

import { useState, useEffect } from 'react'
import { Button, TextField, Box, Typography, Card, CardContent, Alert, CircularProgress } from '@mui/material'
import { setupRecaptcha, sendSMSVerification, verifySMSCode } from '@/lib/firebase'
import { RecaptchaVerifier } from 'firebase/auth'

interface NewUserRegistrationProps {
  kakaoUserData: {
    id: string
    nickname?: string
    email?: string
  }
  accessToken: string
  refreshToken?: string
  onComplete: (userInfo: any) => void
  onCancel: () => void
  isExistingUserVerification?: boolean // 기존 사용자 검증 모드
  expectedPhoneNumber?: string // 카카오 계정 휴대폰 번호 (기존 사용자용)
  kakaoPhoneNumber?: string // 카카오 계정 휴대폰 번호 (신규 사용자용)
}

export default function NewUserRegistration({
  kakaoUserData,
  accessToken,
  refreshToken,
  onComplete,
  onCancel,
  isExistingUserVerification = false,
  expectedPhoneNumber = '',
  kakaoPhoneNumber = ''
}: NewUserRegistrationProps) {
  // 기존 사용자 검증 모드일 때는 바로 phone 단계로, 신규 사용자일 때는 info 단계부터
  const [step, setStep] = useState<'info' | 'phone' | 'verify'>(isExistingUserVerification ? 'phone' : 'info')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // 사용자 정보
  const [userInfo, setUserInfo] = useState({
    name: kakaoUserData.nickname || '',
    email: kakaoUserData.email || '',
    phoneNumber: isExistingUserVerification ? expectedPhoneNumber : '',
    birthDate: '',
    gender: ''
  })

  // 휴대폰 인증
  const [phoneNumber, setPhoneNumber] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [recaptchaVerifier, setRecaptchaVerifier] = useState<RecaptchaVerifier | null>(null)
  const [confirmationResult, setConfirmationResult] = useState<any>(null)
  const [isCodeSent, setIsCodeSent] = useState(false)

  useEffect(() => {
    // reCAPTCHA 설정 (휴대폰 인증 단계에서만)
    if (step === 'phone' && !recaptchaVerifier) {
      const verifier = setupRecaptcha('recaptcha-container')
      setRecaptchaVerifier(verifier)
    }
  }, [step, recaptchaVerifier])

  const handleUserInfoSubmit = () => {
    if (!userInfo.name.trim()) {
      setError('이름을 입력해주세요.')
      return
    }
    if (!userInfo.phoneNumber.trim()) {
      setError('휴대폰 번호를 입력해주세요.')
      return
    }

    setPhoneNumber(userInfo.phoneNumber)
    setError('')
    setStep('phone')
  }

  const handleSendVerificationCode = async () => {
    if (!recaptchaVerifier) {
      setError('reCAPTCHA를 완료해주세요.')
      return
    }

    setLoading(true)
    setError('')

    try {
      // 국제번호 형식으로 변환 (+82)
      const formattedPhoneNumber = userInfo.phoneNumber.startsWith('010')
        ? '+82' + userInfo.phoneNumber.substring(1)
        : userInfo.phoneNumber

      const result = await sendSMSVerification(formattedPhoneNumber, recaptchaVerifier)
      setConfirmationResult(result)
      setIsCodeSent(true)
      setStep('verify')
    } catch (error: any) {
      console.error('SMS 전송 실패:', error)
      setError('인증번호 전송에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyCode = async () => {
    if (!confirmationResult || !verificationCode.trim()) {
      setError('인증번호를 입력해주세요.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const verificationResult = await verifySMSCode(confirmationResult, verificationCode)

      if (isExistingUserVerification) {
        // 기존 사용자 검증 모드 - 검증된 번호를 콜백으로 전달
        onComplete(verificationResult.phoneNumber)
      } else {
        // 신규 사용자 등록 모드 - 카카오 휴대폰 번호와 인증된 번호 비교
        if (kakaoPhoneNumber) {
          const normalizePhoneNumber = (phoneNumber: string) => {
            if (!phoneNumber) return ''
            return phoneNumber
              .replace(/^\+82\s?/, '0')  // +82를 0으로 변경
              .replace(/[-\s]/g, '')     // 하이픈과 공백 제거
          }

          const normalizedVerified = normalizePhoneNumber(verificationResult.phoneNumber)
          const normalizedKakao = normalizePhoneNumber(kakaoPhoneNumber)

          if (normalizedVerified !== normalizedKakao) {
            throw new Error('인증된 휴대폰 번호와 카카오 계정의 휴대폰 번호가 다릅니다. 계정 도용 방지를 위해 가입이 차단됩니다.')
          }
        }

        // 인증 성공 - 백엔드에 사용자 정보 전송
        const finalUserData = {
          kakaoId: kakaoUserData.id,
          name: userInfo.name,
          email: userInfo.email,
          phoneNumber: verificationResult.phoneNumber,
          birthDate: userInfo.birthDate,
          gender: userInfo.gender,
          accessToken,
          refreshToken,
          phoneVerified: true
        }

        onComplete(finalUserData)
      }
    } catch (error: any) {
      console.error('인증번호 확인 실패:', error)
      if (error instanceof Error) {
        setError(error.message)
      } else {
        setError('인증번호가 올바르지 않습니다.')
      }
    } finally {
      setLoading(false)
    }
  }

  const renderUserInfoStep = () => (
    <Card sx={{ maxWidth: 400, mx: 'auto', mt: 4 }}>
      <CardContent sx={{ p: 4 }}>
        <Typography variant="h5" component="h2" gutterBottom align="center" fontWeight="bold">
          추가 정보 입력
        </Typography>
        <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>
          서비스 이용을 위해 추가 정보를 입력해주세요
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Box component="form" sx={{ mt: 2 }}>
          <TextField
            fullWidth
            label="이름"
            value={userInfo.name}
            onChange={(e) => setUserInfo({ ...userInfo, name: e.target.value })}
            margin="normal"
            required
          />
          <TextField
            fullWidth
            label="이메일"
            type="email"
            value={userInfo.email}
            onChange={(e) => setUserInfo({ ...userInfo, email: e.target.value })}
            margin="normal"
          />
          <TextField
            fullWidth
            label="휴대폰 번호"
            placeholder="010-1234-5678"
            value={userInfo.phoneNumber}
            onChange={(e) => setUserInfo({ ...userInfo, phoneNumber: e.target.value })}
            margin="normal"
            required
          />
          <TextField
            fullWidth
            label="생년월일"
            type="date"
            value={userInfo.birthDate}
            onChange={(e) => setUserInfo({ ...userInfo, birthDate: e.target.value })}
            margin="normal"
            InputLabelProps={{ shrink: true }}
          />

          <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              onClick={onCancel}
              fullWidth
            >
              취소
            </Button>
            <Button
              variant="contained"
              onClick={handleUserInfoSubmit}
              fullWidth
              sx={{ backgroundColor: '#FEE500', color: '#000', '&:hover': { backgroundColor: '#FCDD00' } }}
            >
              다음
            </Button>
          </Box>
        </Box>
      </CardContent>
    </Card>
  )

  const renderPhoneVerificationStep = () => (
    <Card sx={{ maxWidth: 400, mx: 'auto', mt: 4 }}>
      <CardContent sx={{ p: 4 }}>
        <Typography variant="h5" component="h2" gutterBottom align="center" fontWeight="bold">
          {isExistingUserVerification ? '본인 확인' : '휴대폰 인증'}
        </Typography>
        <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>
          {isExistingUserVerification
            ? `카카오 계정에 등록된 휴대폰 번호로 본인 확인을 진행합니다`
            : `${userInfo.phoneNumber}로 인증번호를 발송합니다`
          }
        </Typography>

        {isExistingUserVerification && (
          <Box sx={{ mb: 2, p: 2, bgcolor: 'info.light', borderRadius: 1 }}>
            <Typography variant="body2" align="center">
              📱 인증번호를 받을 번호: {userInfo.phoneNumber}
            </Typography>
          </Box>
        )}

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {/* reCAPTCHA */}
        <Box id="recaptcha-container" sx={{ mb: 3, display: 'flex', justifyContent: 'center' }}></Box>

        <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            onClick={isExistingUserVerification ? onCancel : () => setStep('info')}
            fullWidth
          >
            {isExistingUserVerification ? '취소' : '이전'}
          </Button>
          <Button
            variant="contained"
            onClick={handleSendVerificationCode}
            disabled={loading}
            fullWidth
            sx={{ backgroundColor: '#FEE500', color: '#000', '&:hover': { backgroundColor: '#FCDD00' } }}
          >
            {loading ? <CircularProgress size={20} /> : '인증번호 발송'}
          </Button>
        </Box>
      </CardContent>
    </Card>
  )

  const renderVerificationStep = () => (
    <Card sx={{ maxWidth: 400, mx: 'auto', mt: 4 }}>
      <CardContent sx={{ p: 4 }}>
        <Typography variant="h5" component="h2" gutterBottom align="center" fontWeight="bold">
          인증번호 확인
        </Typography>
        <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>
          {userInfo.phoneNumber}로 전송된 인증번호를 입력해주세요
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <TextField
          fullWidth
          label="인증번호"
          value={verificationCode}
          onChange={(e) => setVerificationCode(e.target.value)}
          margin="normal"
          placeholder="6자리 인증번호"
          inputProps={{ maxLength: 6 }}
        />

        <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            onClick={() => setStep('phone')}
            fullWidth
          >
            다시 발송
          </Button>
          <Button
            variant="contained"
            onClick={handleVerifyCode}
            disabled={loading || !verificationCode.trim()}
            fullWidth
            sx={{ backgroundColor: '#FEE500', color: '#000', '&:hover': { backgroundColor: '#FCDD00' } }}
          >
            {loading ? <CircularProgress size={20} /> : '인증 완료'}
          </Button>
        </Box>
      </CardContent>
    </Card>
  )

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'grey.50', py: 4 }}>
      {step === 'info' && renderUserInfoStep()}
      {step === 'phone' && renderPhoneVerificationStep()}
      {step === 'verify' && renderVerificationStep()}
    </Box>
  )
}