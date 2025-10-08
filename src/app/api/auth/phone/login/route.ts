import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateWallet } from '@/lib/wallet'
import { signToken } from '@/lib/auth/jwt'

export async function POST(request: NextRequest) {
  try {
    const { phoneNumber } = await request.json()

    if (!phoneNumber) {
      return NextResponse.json(
        { error: '전화번호가 필요합니다' },
        { status: 400 }
      )
    }

    // 전화번호로 기존 사용자 확인
    let user = await prisma.user.findFirst({
      where: { phoneNumber }
    })

    if (!user) {
      // 새 사용자 생성
      const { walletAddress, privyUserId, privyWalletId } = await generateWallet(`phone:${phoneNumber}`)

      user = await prisma.user.create({
        data: {
          phoneNumber,
          name: `사용자_${phoneNumber.slice(-4)}`, // 전화번호 끝 4자리로 임시 이름
          walletAddress,
          privyUserId,
          ...(privyWalletId ? { privyWalletId } : {}),
        }
      })
    }

    // Generate JWT token
    const token = signToken({
      sub: user.id,
      userId: user.id,
      walletAddress: user.walletAddress || undefined,
      phoneNumber: user.phoneNumber || undefined,
    })

    return NextResponse.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        phoneNumber: user.phoneNumber,
        walletAddress: user.walletAddress,
      }
    })

  } catch (error) {
    console.error('휴대폰 로그인 에러:', error)
    return NextResponse.json(
      { error: '로그인 처리에 실패했습니다' },
      { status: 500 }
    )
  }
}
