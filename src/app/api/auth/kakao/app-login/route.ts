import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { generateWallet } from '@/lib/wallet'

export async function POST(request: NextRequest) {
  try {
    const { accessToken, refreshToken } = await request.json()

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Access token is required' },
        { status: 400 }
      )
    }

    // 카카오 API를 사용하여 사용자 정보 가져오기
    const userResponse = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
      },
    })

    if (!userResponse.ok) {
      throw new Error('Failed to fetch user info from Kakao')
    }

    const userData = await userResponse.json()
    const kakaoId = userData.id.toString()
    const nickname = userData.properties?.nickname || userData.kakao_account?.profile?.nickname
    const email = userData.kakao_account?.email

    // 기존 사용자 확인 또는 새 사용자 생성
    let user = await prisma.user.findUnique({
      where: { kakaoId }
    })

    if (!user) {
      // 새 사용자인 경우 지갑 생성
      const { walletAddress, privateKey } = generateWallet()

      user = await prisma.user.create({
        data: {
          kakaoId,
          name: nickname || `user_${kakaoId}`,
          email: email || null,
          walletAddress,
          privateKeyHash: privateKey, // 실제 서비스에서는 암호화해서 저장
        }
      })
    }

    // 세션 쿠키 설정
    const cookieStore = await cookies()
    cookieStore.set('session', JSON.stringify({
      userId: user.id,
      kakaoId: user.kakaoId,
      name: user.name,
      walletAddress: user.walletAddress,
    }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7, // 7일
    })

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        walletAddress: user.walletAddress,
      }
    })

  } catch (error) {
    console.error('Kakao app login error:', error)
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    )
  }
}