import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateChallenge } from '@/lib/crypto/signature'

export async function POST(request: NextRequest) {
  try {
    const { kakaoId } = await request.json()

    if (!kakaoId) {
      return NextResponse.json(
        { error: 'kakaoId is required' },
        { status: 400 }
      )
    }

    // 사용자 확인
    const user = await prisma.user.findUnique({
      where: { kakaoId: kakaoId.toString() }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // 공개키가 없는 경우 (키 인증 미설정)
    if (!user.publicKey) {
      return NextResponse.json(
        { error: 'Biometric authentication not set up' },
        { status: 400 }
      )
    }

    // 챌린지 생성
    const challenge = generateChallenge()
    const expiresAt = new Date(Date.now() + 60 * 1000) // 60초 후 만료

    // DB에 챌린지 저장
    await prisma.authChallenge.create({
      data: {
        userId: user.id,
        challenge,
        expiresAt,
        used: false
      }
    })

    // 만료된 챌린지 정리 (5분 이상 된 것)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
    await prisma.authChallenge.deleteMany({
      where: {
        createdAt: { lt: fiveMinutesAgo }
      }
    })

    return NextResponse.json({
      success: true,
      challenge,
      expiresAt: expiresAt.getTime()
    })

  } catch (error) {
    console.error('Challenge generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate challenge' },
      { status: 500 }
    )
  }
}