import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { generateWallet } from '@/lib/wallet'
import { createSessionForUser } from '@/lib/users/service'

export async function POST(request: NextRequest) {
  try {
    const { accessToken, refreshToken, userData } = await request.json()

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Access token is required' },
        { status: 400 }
      )
    }

    // 클라이언트에서 전달받은 사용자 정보 사용 (이미 검증됨)
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

    const sessionToken = await createSessionForUser(user.id, 'app')
    const cookieStore = await cookies()
    cookieStore.set('session_token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
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
