import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyRecoveryCode, isValidRecoveryCodeFormat } from '@/lib/crypto/recovery'

/**
 * POST /api/auth/recover/verify
 * 계정 복구 코드 검증 API
 *
 * 요청 본문:
 * - phoneNumber 또는 email: 사용자 식별자
 * - recoveryCode: 12단어 복구 코드
 *
 * 응답:
 * - success: true
 * - userId: 복구된 사용자 ID
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { phoneNumber, email, recoveryCode } = body

    // 입력 검증
    if (!recoveryCode) {
      return NextResponse.json(
        { error: '복구 코드가 필요합니다.' },
        { status: 400 }
      )
    }

    if (!phoneNumber && !email) {
      return NextResponse.json(
        { error: '전화번호 또는 이메일이 필요합니다.' },
        { status: 400 }
      )
    }

    // 복구 코드 형식 검증
    if (!isValidRecoveryCodeFormat(recoveryCode)) {
      return NextResponse.json(
        { error: '잘못된 복구 코드 형식입니다. 12개의 단어를 공백으로 구분하여 입력하세요.' },
        { status: 400 }
      )
    }

    // IP 주소 및 User-Agent 추출
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    // 사용자 찾기
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          phoneNumber ? { phoneNumber } : {},
          email ? { email } : {},
        ].filter(obj => Object.keys(obj).length > 0),
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: '계정을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 복구 코드가 설정되지 않은 경우
    if (!user.recoveryCodeHash) {
      await prisma.recoveryAttempt.create({
        data: {
          userId: user.id,
          success: false,
          ipAddress,
          userAgent,
        },
      })

      return NextResponse.json(
        { error: '이 계정에는 복구 코드가 설정되지 않았습니다.' },
        { status: 400 }
      )
    }

    // 복구 코드 검증
    const isValid = verifyRecoveryCode(recoveryCode, user.recoveryCodeHash)

    if (!isValid) {
      // 실패 로그
      await prisma.recoveryAttempt.create({
        data: {
          userId: user.id,
          success: false,
          ipAddress,
          userAgent,
        },
      })

      return NextResponse.json(
        { error: '복구 코드가 일치하지 않습니다.' },
        { status: 401 }
      )
    }

    // 복구 코드 검증 성공 - 이전 공개키를 히스토리에 저장
    await prisma.$transaction(async (tx) => {
      if (user.publicKey) {
        await tx.publicKeyHistory.create({
          data: {
            userId: user.id,
            publicKey: user.publicKey,
            keyAlgorithm: user.keyAlgorithm || 'ECDSA_P256',
            reason: 'RECOVERY',
            deviceInfo: user.deviceInfo,
          },
        })
      }

      // 복구 성공 로그
      await tx.recoveryAttempt.create({
        data: {
          userId: user.id,
          success: true,
          ipAddress,
          userAgent,
        },
      })
    })

    return NextResponse.json({
      success: true,
      userId: user.id,
      kakaoId: user.kakaoId,
      message: '복구 코드 검증에 성공했습니다.',
    })
  } catch (error) {
    console.error('복구 코드 검증 실패:', error)
    return NextResponse.json(
      { error: '복구 코드 검증 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}