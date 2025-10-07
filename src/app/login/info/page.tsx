'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Alert, Box, Button, Card, CardContent, TextField, Typography } from '@mui/material'
import type { PendingKakaoUserData } from '@/types/kakao'

type StoredPendingUser = PendingKakaoUserData & {
  requiresInfoStep: boolean
}

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
  const [pendingUser, setPendingUser] = useState<StoredPendingUser | null>(null)
  const [userInfo, setUserInfo] = useState<UserInfoForm>({
    name: '',
    email: '',
    phoneNumber: '',
    birthDate: '',
    gender: '',
  })
  const [error, setError] = useState('')

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

      if (!parsed.requiresInfoStep) {
        router.replace('/login/verify')
        return
      }

      setPendingUser(parsed)

      const storedUserInfo = sessionStorage.getItem('kakaoUserInfo')
      if (storedUserInfo) {
        const parsedInfo = JSON.parse(storedUserInfo) as UserInfoForm
        setUserInfo(parsedInfo)
        return
      }

      setUserInfo({
        name: parsed.kakaoData.properties?.nickname || parsed.kakaoData.kakao_account?.profile?.nickname || '',
        email: parsed.kakaoData.kakao_account?.email || '',
        phoneNumber: parsed.kakaoPhoneNumber || '',
        birthDate: '',
        gender: '',
      })
    } catch (parseError) {
      console.error('카카오 임시 로그인 데이터를 불러오지 못했습니다:', parseError)
      sessionStorage.removeItem('kakaoPendingUser')
      router.replace('/login')
    }
  }, [router])

  const isExistingUserWithoutPhone = useMemo(() => {
    return Boolean(pendingUser?.isExistingUser && !pendingUser?.kakaoPhoneNumber)
  }, [pendingUser])

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

    if (typeof window !== 'undefined') {
      const normalizedPhone = normalizePhoneNumber(userInfo.phoneNumber)
      const updatedInfo: UserInfoForm = {
        ...userInfo,
        phoneNumber: normalizedPhone,
      }

      sessionStorage.setItem('kakaoUserInfo', JSON.stringify(updatedInfo))

      const storedPending = sessionStorage.getItem('kakaoPendingUser')
      if (storedPending) {
        try {
          const parsed: StoredPendingUser = JSON.parse(storedPending)
          const updatedPending: StoredPendingUser = {
            ...parsed,
            kakaoPhoneNumber: normalizedPhone,
            requiresInfoStep: false,
          }
          sessionStorage.setItem('kakaoPendingUser', JSON.stringify(updatedPending))
        } catch (error) {
          console.error('카카오 임시 데이터를 업데이트하지 못했습니다:', error)
        }
      }
    }

    router.push('/login/verify')
  }

  const handleCancel = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('kakaoPendingUser')
      sessionStorage.removeItem('kakaoUserInfo')
    }
    router.replace('/login')
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'grey.50', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
      <Card sx={{ maxWidth: 420, width: '100%' }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h5" component="h1" align="center" fontWeight="bold" gutterBottom>
            {isExistingUserWithoutPhone ? '본인 확인 정보 입력' : '추가 정보 입력'}
          </Typography>
          <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>
            {isExistingUserWithoutPhone
              ? '카카오 계정과 동일한 휴대폰 번호를 입력한 뒤 본인 확인을 진행해주세요'
              : '서비스 이용을 위해 추가 정보를 입력해주세요'}
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
