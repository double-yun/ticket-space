import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { generateWallet } from '@/lib/wallet'
import { createSessionForUser } from '@/lib/users/service'
import { clearPendingKakaoData } from '@/lib/auth/kakao-pending'

export async function POST(request: NextRequest) {
  try {
    const {
      kakaoId,
      name,
      email,
      phoneNumber,
      birthDate,
      gender,
      accessToken,
      refreshToken,
      phoneVerified
    } = await request.json()

    console.log('Registration request data:', {
      kakaoId,
      name,
      phoneNumber,
      phoneVerified,
      email,
      birthDate,
      gender
    })

    // 필수 필드 검증
    if (!kakaoId || !name || !phoneNumber || !phoneVerified) {
      console.log('Missing required fields:', {
        hasKakaoId: !!kakaoId,
        hasName: !!name,
        hasPhoneNumber: !!phoneNumber,
        hasPhoneVerified: !!phoneVerified
      })
      return NextResponse.json(
        { error: 'Required fields are missing' },
        { status: 400 }
      )
    }

    // 이미 존재하는 사용자인지 확인
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { kakaoId: kakaoId.toString() },
          { phoneNumber }
        ]
      }
    })

    if (existingUser) {
      console.log('User already exists, logging in:', {
        existingUserId: existingUser.id,
        existingKakaoId: existingUser.kakaoId,
        existingPhoneNumber: existingUser.phoneNumber
      })

      // 기존 사용자로 로그인 처리
      const sessionToken = await createSessionForUser(existingUser.id, 'app')
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
          id: existingUser.id,
          name: existingUser.name,
          email: existingUser.email,
          phoneNumber: existingUser.phoneNumber,
          walletAddress: existingUser.walletAddress,
        }
      })
    }

    // 새 사용자 생성 - 지갑과 함께
    const { walletAddress, privyUserId, privyWalletId } = await generateWallet(`kakao:${kakaoId}`)

    const user = await prisma.user.create({
      data: {
        kakaoId: kakaoId.toString(),
        name,
        email: email || null,
        phoneNumber,
        birthDate: birthDate || null,
        gender: gender || null,
        walletAddress,
        privyUserId,
        ...(privyWalletId ? { privyWalletId } : {}),
        phoneVerified: true,
      }
    })

    // 세션 쿠키 설정
    const sessionToken = await createSessionForUser(user.id, 'app')
    const cookieStore = await cookies()
    cookieStore.set('session_token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    })

    // Pending 데이터 정리
    await clearPendingKakaoData()

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
    console.error('User registration error:', error)
    return NextResponse.json(
      { error: 'Registration failed' },
      { status: 500 }
    )
  }
}
