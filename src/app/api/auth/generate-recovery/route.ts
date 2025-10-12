import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateRecoveryCode, hashRecoveryCode } from '@/lib/crypto/recovery'

/**
 * POST /api/auth/generate-recovery
 * 복구 코드 생성 API
 *
 * 요청 본문:
 * - userId: 사용자 ID
 *
 * 응답:
 * - recoveryCode: 12단어 복구 코드 (1회만 표시)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId } = body

    if (!userId) {
      return NextResponse.json(
        { error: '사용자 ID가 필요합니다.' },
        { status: 400 }
      )
    }

    // 사용자 확인
    const user = await prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      return NextResponse.json(
        { error: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 이미 복구 코드가 있는 경우
    if (user.recoveryCodeHash) {
      return NextResponse.json(
        { error: '이미 복구 코드가 생성되었습니다. 복구 코드는 계정당 1개만 생성할 수 있습니다.' },
        { status: 400 }
      )
    }

    // 공개키가 없으면 복구 코드 생성 불가
    if (!user.publicKey) {
      return NextResponse.json(
        { error: '공개키가 등록되지 않은 계정입니다. 먼저 기기 인증을 완료해주세요.' },
        { status: 400 }
      )
    }

    // 12단어 복구 코드 생성
    const recoveryCode = generateRecoveryCode()
    const recoveryCodeHash = hashRecoveryCode(recoveryCode)

    // DB에 해시 저장
    await prisma.user.update({
      where: { id: userId },
      data: {
        recoveryCodeHash,
        recoveryCodeCreatedAt: new Date(),
      },
    })

    // 평문 복구 코드를 1회만 반환 (절대 다시 볼 수 없음)
    return NextResponse.json({
      success: true,
      recoveryCode,
      message: '복구 코드가 생성되었습니다. 이 코드는 다시 확인할 수 없으니 안전한 곳에 보관하세요.',
    })
  } catch (error) {
    console.error('복구 코드 생성 실패:', error)
    return NextResponse.json(
      { error: '복구 코드 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}