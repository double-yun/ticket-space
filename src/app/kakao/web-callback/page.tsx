
'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Box, CircularProgress, Typography, Container } from '@mui/material'

function KakaoWebCallbackContent() {
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const code = searchParams.get('code')

    if (!code) {
      setError('카카오 로그인 코드가 제공되지 않았습니다.')
      return
    }

    const exchangeCode = async () => {
      try {
        const response = await fetch('/api/auth/kakao/web-login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ code }),
        })

        if (!response.ok) {
          const data = await response.json().catch(() => ({}))
          throw new Error(data.error || '카카오 로그인 처리에 실패했습니다.')
        }

        const data = await response.json()

        sessionStorage.setItem(
          'kakaoAuthData',
          JSON.stringify({
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
            userData: data.userData,
          })
        )

        const redirectTarget = sessionStorage.getItem('kakaoLoginRedirect') || '/login'
        sessionStorage.removeItem('kakaoLoginRedirect')

        window.location.replace(redirectTarget)
      } catch (err) {
        console.error('카카오 웹 로그인 처리 실패:', err)
        setError(err instanceof Error ? err.message : '카카오 로그인 처리에 실패했습니다.')
      }
    }

    exchangeCode().catch((err) => {
      console.error('카카오 코드 교환 실패:', err)
      setError(err instanceof Error ? err.message : '카카오 로그인 처리에 실패했습니다.')
    })
  }, [searchParams])

  return (
    <Container maxWidth="sm" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <Box textAlign="center">
        {error ? (
          <Typography variant="h6" color="error">
            {error}
          </Typography>
        ) : (
          <>
            <CircularProgress sx={{ mb: 2 }} />
            <Typography variant="h6">카카오 로그인 처리 중입니다...</Typography>
          </>
        )}
      </Box>
    </Container>
  )
}

export default function KakaoWebCallbackPage() {
  return (
    <Suspense
      fallback={
        <Container maxWidth="sm" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
          <Box textAlign="center">
            <CircularProgress sx={{ mb: 2 }} />
            <Typography variant="h6">카카오 로그인 처리 중입니다...</Typography>
          </Box>
        </Container>
      }
    >
      <KakaoWebCallbackContent />
    </Suspense>
  )
}
