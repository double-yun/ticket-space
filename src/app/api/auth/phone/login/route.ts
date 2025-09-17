import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { generateWallet } from '@/lib/wallet'

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
      const { walletAddress, privateKey } = generateWallet()

      user = await prisma.user.create({
        data: {
          phoneNumber,
          name: `사용자_${phoneNumber.slice(-4)}`, // 전화번호 끝 4자리로 임시 이름
          walletAddress,
          privateKeyHash: privateKey, // 실제 서비스에서는 암호화 필요
        }
      })
    }

    // 세션 쿠키 설정
    const cookieStore = await cookies()
    cookieStore.set('session', JSON.stringify({
      userId: user.id,
      phoneNumber: user.phoneNumber,
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