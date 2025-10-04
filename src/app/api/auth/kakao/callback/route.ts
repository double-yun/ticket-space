import { NextRequest, NextResponse } from 'next/server'
import {
  KakaoOAuthError,
  exchangeCodeForAccessToken,
  fetchKakaoProfile,
  getKakaoOAuthConfig,
} from '@/lib/auth/kakao'
import { createSessionForUser, findOrCreateUserWithKakaoProfile } from '@/lib/users/service'

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
    const accessToken = await exchangeCodeForAccessToken(code, config)
    const kakaoProfile = await fetchKakaoProfile(accessToken)
    console.log('Kakao user data:', kakaoProfile)
    const user = await findOrCreateUserWithKakaoProfile(kakaoProfile)
    const sessionToken = await createSessionForUser(user.id, 'kakao')

    const response = NextResponse.redirect(new URL('/', request.url))
    response.cookies.set('session_token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60,
      sameSite: 'strict',
      path: '/',
    })
    return response
  } catch (error) {
    if (error instanceof KakaoOAuthError) {
      console.error(`Kakao login error (${error.reason}):`, error)
      return NextResponse.redirect(new URL(`/login?error=${error.reason}`, request.url))
    }

    console.error('Kakao login error:', error)
    return NextResponse.redirect(new URL('/login?error=server_error', request.url))
  }
}
