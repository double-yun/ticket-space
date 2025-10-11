import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const { kakaoId } = await request.json()

    if (!kakaoId) {
      return NextResponse.json(
        { error: 'Kakao ID is required' },
        { status: 400 }
      )
    }

    // kakaoId로 기존 사용자 확인
    const user = await prisma.user.findUnique({
      where: { kakaoId: kakaoId.toString() },
      select: {
        id: true,
        publicKey: true,
        deviceInfo: true
      }
    })

    return NextResponse.json({
      userExists: !!user,
      userId: user?.id || null,
      hasPublicKey: !!user?.publicKey,
      deviceInfo: user?.deviceInfo || null
    })
  } catch (error) {
    console.error('Check user error:', error)
    return NextResponse.json(
      { error: 'Failed to check user' },
      { status: 500 }
    )
  }
}