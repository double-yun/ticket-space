import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateWallet } from '@/lib/wallet'
import { signToken } from '@/lib/auth/jwt'
import { clearPendingKakaoData } from '@/lib/auth/kakao-pending'
import { generateRecoveryCode, hashRecoveryCode } from '@/lib/crypto/recovery'

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
      phoneVerified,
      // 새로 추가: 비대칭 키 인증 필드
      publicKey,
      keyAlgorithm,
      deviceInfo
    } = await request.json()

    console.log('Registration request data:', {
      kakaoId,
      name,
      phoneNumber,
      phoneVerified,
      email,
      birthDate,
      gender,
      hasPublicKey: !!publicKey
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

    // 공개키는 선택 사항 (모바일에서만 필요)

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
      console.log('User already exists:', {
        existingUserId: existingUser.id,
        existingKakaoId: existingUser.kakaoId,
        existingPhoneNumber: existingUser.phoneNumber
      })

      // 기존 사용자는 패스키 검증을 통해 로그인해야 함
      return NextResponse.json({
        error: 'User already exists. Please use passkey login.',
        userExists: true
      }, { status: 409 })
    }

    // 새 사용자 생성 - 지갑과 함께
    const { walletAddress, privyUserId, privyWalletId } = await generateWallet(`kakao:${kakaoId}`)

    // 복구 코드 자동 생성
    const recoveryCode = generateRecoveryCode()
    const recoveryCodeHash = hashRecoveryCode(recoveryCode)

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
        // 복구 코드 저장
        recoveryCodeHash,
        // 비대칭 키 인증 필드 (모바일에서만)
        ...(publicKey ? {
          publicKey,
          keyAlgorithm: keyAlgorithm || 'ECDSA_P256',
          keyCreatedAt: new Date(),
          deviceInfo: deviceInfo || null,
        } : {}),
      }
    })

    // JWT 토큰 발급
    const token = signToken({
      sub: user.id,
      userId: user.id,
      walletAddress: user.walletAddress || undefined,
      kakaoId: user.kakaoId || undefined,
      phoneNumber: user.phoneNumber || undefined,
    })

    // Pending 데이터 정리
    await clearPendingKakaoData()

    return NextResponse.json({
      success: true,
      token,
      recoveryCode, // 복구 코드를 프론트로 전달
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
