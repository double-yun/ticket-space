import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateWallet } from '@/lib/wallet'
import { signToken } from '@/lib/auth/jwt'

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
      const { walletAddress, privyUserId, privyWalletId } = await generateWallet(`kakao:${kakaoId}`)

      user = await prisma.user.create({
        data: {
          kakaoId,
          name: nickname || `user_${kakaoId}`,
          email: email || null,
          walletAddress,
          privyUserId,
          ...(privyWalletId ? { privyWalletId } : {}),
        }
      })
    }

    // Generate JWT token
    const token = signToken({
      sub: user.id, // Privy uses 'sub' for user identification
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
