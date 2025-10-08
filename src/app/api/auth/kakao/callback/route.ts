import { NextRequest, NextResponse } from 'next/server'
import {
  KakaoOAuthError,
  exchangeCodeForTokens,
  fetchKakaoProfile,
  getKakaoOAuthConfig,
} from '@/lib/auth/kakao'
import { setPendingKakaoData } from '@/lib/auth/kakao-pending'
import { prisma } from '@/lib/prisma'
import { signToken } from '@/lib/auth/jwt'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error) {
    console.error('Kakao OAuth error:', error)
    return NextResponse.redirect(new URL(`/login?error=${error}`, request.url))
  }

  if (!code) {
    console.error('No authorization code provided in Kakao callback')
    return NextResponse.redirect(new URL('/login?error=no_code', request.url))
  }

  try {
    const config = getKakaoOAuthConfig()
    const tokens = await exchangeCodeForTokens(code, config)
    const userData = await fetchKakaoProfile(tokens.access_token)

    const kakaoId = userData.id.toString()
    const normalizedPhone = userData.kakao_account?.phone_number
      ? userData.kakao_account.phone_number.replace(/^\+82\s?/, '0').replace(/[-\s]/g, '')
      : undefined

    // 기존 사용자 확인
    const existingUser = await prisma.user.findUnique({
      where: { kakaoId }
    })

    if (existingUser) {
      // 기존 사용자: JWT 발급 후 리다이렉트
      const token = signToken({
        sub: existingUser.id,
        userId: existingUser.id,
        walletAddress: existingUser.walletAddress || undefined,
        kakaoId: existingUser.kakaoId || undefined,
        phoneNumber: existingUser.phoneNumber || undefined,
      })

      // JWT를 URL query parameter로 전달하여 프론트에서 저장
      const redirectUrl = new URL('/login', request.url)
      redirectUrl.searchParams.set('token', token)
      redirectUrl.searchParams.set('redirect', '/')

      return NextResponse.redirect(redirectUrl)
    } else {
      // 신규 사용자: 임시 데이터 저장 후 정보 입력 페이지로
      await setPendingKakaoData({
        kakaoData: userData,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? undefined,
        kakaoPhoneNumber: normalizedPhone,
      })

      return NextResponse.redirect(new URL('/login/info', request.url))
    }
  } catch (error) {
    if (error instanceof KakaoOAuthError) {
      console.error(`Kakao login error (${error.reason}):`, error)
      return NextResponse.redirect(new URL(`/login?error=${error.reason}`, request.url))
    }

    console.error('Kakao login error:', error)
    return NextResponse.redirect(new URL('/login?error=server_error', request.url))
  }
}
