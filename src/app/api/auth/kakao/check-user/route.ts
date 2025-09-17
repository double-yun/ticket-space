import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const { kakaoId, phoneNumber } = await request.json()

    if (!kakaoId || !phoneNumber) {
      return NextResponse.json(
        { error: '카카오 ID와 전화번호가 필요합니다' },
        { status: 400 }
      )
    }

    // 전화번호로 기존 계정 확인
    const existingUser = await prisma.user.findFirst({
      where: { phoneNumber }
    })

    if (existingUser) {
      // 기존 계정 자동 로그인
      const cookieStore = await cookies()
      cookieStore.set('session', JSON.stringify({
        userId: existingUser.id,
        kakaoId: existingUser.kakaoId,
        phoneNumber: existingUser.phoneNumber,
        name: existingUser.name,
        email: existingUser.email,
        walletAddress: existingUser.walletAddress,
      }), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 24 * 7, // 7일
      })

      return NextResponse.json({
        success: true,
        userExists: true,
        user: {
          id: existingUser.id,
          name: existingUser.name,
          email: existingUser.email,
          phoneNumber: existingUser.phoneNumber,
          walletAddress: existingUser.walletAddress,
        }
      })
    } else {
      // 새 계정 생성 필요
      return NextResponse.json({
        success: true,
        userExists: false,
        message: '새 계정 생성이 필요합니다'
      })
    }

  } catch (error) {
    console.error('사용자 확인 에러:', error)
    return NextResponse.json(
      { error: '사용자 확인에 실패했습니다' },
      { status: 500 }
    )
  }
}