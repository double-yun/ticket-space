import { NextRequest, NextResponse } from 'next/server'
import {
  KakaoOAuthError,
  exchangeCodeForTokens,
  fetchKakaoProfile,
  getKakaoOAuthConfig,
} from '@/lib/auth/kakao'

export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json()

    if (!code) {
      return NextResponse.json(
        { error: 'Authorization code is required' },
        { status: 400 }
      )
    }

    const config = getKakaoOAuthConfig()
    const tokens = await exchangeCodeForTokens(code, config)
    const userData = await fetchKakaoProfile(tokens.access_token)

    return NextResponse.json({
      success: true,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      userData,
    })
  } catch (error) {
    if (error instanceof KakaoOAuthError) {
      console.error(`Kakao OAuth error (${error.reason}):`, error)
      return NextResponse.json(
        { error: error.reason },
        { status: 400 }
      )
    }

    console.error('Kakao web login error:', error)
    return NextResponse.json(
      { error: 'Failed to complete Kakao web login' },
      { status: 500 }
    )
  }
}
