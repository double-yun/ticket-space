import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifySignature, isChallengeExpired } from '@/lib/crypto/signature'
import { signToken } from '@/lib/auth/jwt'

export async function POST(request: NextRequest) {
  try {
    const { kakaoId, challenge, signature } = await request.json()

    if (!kakaoId || !challenge || !signature) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // 사용자 조회
    const user = await prisma.user.findUnique({
      where: { kakaoId: kakaoId.toString() }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    if (!user.publicKey) {
      return NextResponse.json(
        { error: 'Biometric authentication not set up' },
        { status: 400 }
      )
    }

    // 챌린지 조회
    const challengeRecord = await prisma.authChallenge.findUnique({
      where: { challenge }
    })

    if (!challengeRecord) {
      return NextResponse.json(
        { error: 'Invalid challenge' },
        { status: 400 }
      )
    }

    // 챌린지 소유자 확인
    if (challengeRecord.userId !== user.id) {
      return NextResponse.json(
        { error: 'Challenge mismatch' },
        { status: 403 }
      )
    }

    // 챌린지 사용 여부 확인
    if (challengeRecord.used) {
      return NextResponse.json(
        { error: 'Challenge already used' },
        { status: 400 }
      )
    }

    // 챌린지 만료 확인
    if (isChallengeExpired(challengeRecord.expiresAt)) {
      return NextResponse.json(
        { error: 'Challenge expired' },
        { status: 400 }
      )
    }

    // 서명 검증
    const isValid = await verifySignature(challenge, signature, user.publicKey)

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      )
    }

    // 챌린지를 사용됨으로 표시
    await prisma.authChallenge.update({
      where: { id: challengeRecord.id },
      data: { used: true }
    })

    // JWT 발급
    const token = signToken({
      sub: user.id,
      userId: user.id,
      walletAddress: user.walletAddress || undefined,
      kakaoId: user.kakaoId || undefined,
      phoneNumber: user.phoneNumber || undefined,
    })

    return NextResponse.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        walletAddress: user.walletAddress,
      }
    })

  } catch (error) {
    console.error('Signature verification error:', error)
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    )
  }
}