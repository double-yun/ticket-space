import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { generateWallet } from '@/lib/wallet'
import { createSessionForUser } from '@/lib/users/service'

export async function POST(request: NextRequest) {
  try {
    const { kakaoId, phoneNumber, nickname, email } = await request.json()

    if (!kakaoId || !phoneNumber || !nickname || !email) {
      return NextResponse.json(
        { error: '모든 필드가 필요합니다' },
        { status: 400 }
      )
    }

    // 이미 존재하는 계정 확인
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { kakaoId },
          { phoneNumber },
          { email }
        ]
      }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: '이미 사용 중인 카카오 계정, 전화번호 또는 이메일입니다' },
        { status: 400 }
      )
    }

    // 새 계정 생성
    const { walletAddress, privyUserId, privyWalletId } = await generateWallet(`kakao:${kakaoId}`)

    const user = await prisma.user.create({
      data: {
        kakaoId,
        phoneNumber,
        name: nickname,
        email,
        walletAddress,
        privyUserId,
        ...(privyWalletId ? { privyWalletId } : {}),
      }
    })

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
        phoneNumber: user.phoneNumber,
        walletAddress: user.walletAddress,
      }
    })

  } catch (error) {
    console.error('계정 생성 에러:', error)
    return NextResponse.json(
      { error: '계정 생성에 실패했습니다' },
      { status: 500 }
    )
  }
}
