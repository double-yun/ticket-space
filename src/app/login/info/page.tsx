'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Alert, Box, Button, Card, CardContent, TextField, Typography } from '@mui/material'
import type { PendingKakaoData } from '@/lib/auth/kakao-pending'

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
      <Box sx={{ minHeight: '100vh', bgcolor: 'grey.50', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
        <Typography>로딩 중...</Typography>
      </Box>
    )
  }

  if (!pendingData) {
    return null
  }

  const isFormValid = userInfo.name.trim() && userInfo.phoneNumber.trim()

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'grey.50', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
      <Card sx={{ maxWidth: 420, width: '100%' }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h5" component="h1" align="center" fontWeight="bold" gutterBottom>
            회원가입
          </Typography>
          <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>
            서비스 이용을 위해 필수 정보를 입력해주세요
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box component="form" sx={{ mt: 2 }}>
            <TextField
              fullWidth
              label="이름"
              value={userInfo.name}
              onChange={(event) => setUserInfo({ ...userInfo, name: event.target.value })}
              margin="normal"
              required
            />
            <TextField
              fullWidth
              label="이메일"
              type="email"
              value={userInfo.email}
              onChange={(event) => setUserInfo({ ...userInfo, email: event.target.value })}
              margin="normal"
            />
            <TextField
              fullWidth
              label="휴대폰 번호"
              placeholder="010-1234-5678"
              value={userInfo.phoneNumber}
              onChange={(event) => setUserInfo({ ...userInfo, phoneNumber: event.target.value })}
              margin="normal"
              required
              helperText="필수 입력 항목입니다"
            />
            <TextField
              fullWidth
              label="생년월일"
              type="date"
              value={userInfo.birthDate}
              onChange={(event) => setUserInfo({ ...userInfo, birthDate: event.target.value })}
              margin="normal"
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              fullWidth
              label="성별"
              placeholder="선택 사항"
              value={userInfo.gender}
              onChange={(event) => setUserInfo({ ...userInfo, gender: event.target.value })}
              margin="normal"
            />

            <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
              <Button variant="outlined" onClick={handleCancel} fullWidth>
                취소
              </Button>
              <Button
                variant="contained"
                onClick={handleSubmit}
                fullWidth
                disabled={!isFormValid}
                sx={{ backgroundColor: '#FEE500', color: '#000', '&:hover': { backgroundColor: '#FCDD00' } }}
              >
                다음 단계로
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Box>
  )
}
