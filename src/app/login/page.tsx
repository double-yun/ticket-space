'use client'

// 커스텀 인증으로 변경
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Box,
  Button,
  Container,
  Paper,
  Typography,
  Stack,
  Avatar,
  useTheme
} from '@mui/material'
import { Phone, AccountCircle } from '@mui/icons-material'

export default function LoginPage() {
  const router = useRouter()
  const theme = useTheme()

  useEffect(() => {
    // 이미 로그인되어 있으면 홈으로 리다이렉트
    fetch('/api/auth/session')
      .then(res => res.json())
      .then(data => {
        if (data.user) {
          router.push('/')
        }
      })
  }, [router])

  const handleKakaoLogin = () => {
    const kakaoAuthUrl = 'https://kauth.kakao.com/oauth/authorize?' +
      new URLSearchParams({
        client_id: '654df22880e0fd9f308a63c1d8eeb8f3',
        redirect_uri: `${window.location.origin}/api/auth/kakao/callback`,
        response_type: 'code',
        scope: 'profile_nickname account_email',
      }).toString()

    window.location.href = kakaoAuthUrl
  }

  return (
    <Container maxWidth="sm" sx={{ height: '100vh', display: 'flex', alignItems: 'center' }}>
      <Paper
        elevation={0}
        sx={{
          width: '100%',
          p: 4,
          textAlign: 'center',
          backgroundColor: 'transparent'
        }}
      >
        <Stack spacing={4} alignItems="center">
          {/* 로고 영역 */}
          <Box sx={{ mb: 2 }}>
            <Avatar
              sx={{
                width: 80,
                height: 80,
                bgcolor: theme.palette.primary.main,
                mx: 'auto',
                mb: 2
              }}
            >
              🎫
            </Avatar>
            <Typography variant="h4" component="h1" fontWeight="bold" gutterBottom>
              티켓팅 시스템
            </Typography>
            <Typography variant="body1" color="text.secondary">
              NFT 티켓으로 안전하고 투명한 티켓 거래
            </Typography>
          </Box>

          {/* 모바일 최적화된 로그인 버튼 */}
          <Box sx={{ width: '100%', mt: 4 }}>
            <Button
              fullWidth
              variant="contained"
              size="large"
              onClick={handleKakaoLogin}
              sx={{
                py: 2,
                fontSize: '1.1rem',
                fontWeight: 'bold',
                backgroundColor: '#FEE500',
                color: '#000',
                '&:hover': {
                  backgroundColor: '#FDD835',
                },
                borderRadius: 2,
                textTransform: 'none'
              }}
              startIcon={<Phone />}
            >
              카카오로 시작하기
            </Button>
          </Box>

          {/* 부가 정보 */}
          <Box sx={{ mt: 3, textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary" display="block">
              최초 로그인 시 개인 지갑이 자동으로 생성됩니다
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
              카카오 계정으로 간편하게 시작하세요
            </Typography>
          </Box>

          {/* 기능 소개 */}
          <Box sx={{ mt: 4, width: '100%' }}>
            <Stack spacing={2}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.light' }}>🔐</Avatar>
                <Typography variant="body2" color="text.secondary">
                  개인 전용 블록체인 지갑 자동 생성
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.light' }}>💎</Avatar>
                <Typography variant="body2" color="text.secondary">
                  NFT 티켓으로 소유권 보장
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.light' }}>⚡</Avatar>
                <Typography variant="body2" color="text.secondary">
                  빠르고 안전한 거래 시스템
                </Typography>
              </Box>
            </Stack>
          </Box>
        </Stack>
      </Paper>
    </Container>
  )
}