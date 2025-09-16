import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateWallet } from '@/lib/wallet'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error) {
    console.error('Kakao OAuth error:', error)
    return NextResponse.redirect(new URL('/login?error=oauth_error', request.url))
  }

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=no_code', request.url))
  }

  try {
    // 1. 액세스 토큰 획득
    const tokenResponse = await fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: '654df22880e0fd9f308a63c1d8eeb8f3',
        client_secret: 'g3PNFSPpAxwqaDLXoQmCFyHC8pHNbEAh',
        redirect_uri: `http://localhost:3000/api/auth/kakao/callback`,
        code,
      }),
    })

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text()
      console.error('Token error:', error)
      return NextResponse.redirect(new URL('/login?error=token_error', request.url))
    }

    const tokenData = await tokenResponse.json()
    const accessToken = tokenData.access_token

    // 2. 사용자 정보 획득
    const userResponse = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!userResponse.ok) {
      return NextResponse.redirect(new URL('/login?error=user_info_error', request.url))
    }

    const userData = await userResponse.json()
    console.log('Kakao user data:', userData)

    // 3. DB에서 사용자 찾기 또는 생성
    let user = await prisma.user.findUnique({
      where: { kakaoId: userData.id.toString() },
    })

    if (!user) {
      // 새 사용자 생성 + 지갑 생성
      const { walletAddress, privateKey } = generateWallet()

      user = await prisma.user.create({
        data: {
          kakaoId: userData.id.toString(),
          name: userData.properties?.nickname || userData.kakao_account?.profile?.nickname,
          email: userData.kakao_account?.email,
          image: userData.properties?.profile_image || userData.kakao_account?.profile?.profile_image_url,
          walletAddress,
          privateKeyHash: privateKey, // 실제로는 암호화해야 함
        },
      })

      console.log(`🎉 새 사용자 생성: ${user.name} (${user.walletAddress})`)
    }

    // 4. 세션 쿠키 설정 (간단한 방식)
    const sessionToken = `kakao_${user.id}_${Date.now()}`

    // 세션 저장
    await prisma.session.create({
      data: {
        sessionToken,
        userId: user.id,
        expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30일
      },
    })

    const response = NextResponse.redirect(new URL('/', request.url))
    response.cookies.set('session_token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60, // 30일
    })

    return response

  } catch (error) {
    console.error('Kakao login error:', error)
    return NextResponse.redirect(new URL('/login?error=server_error', request.url))
  }
}