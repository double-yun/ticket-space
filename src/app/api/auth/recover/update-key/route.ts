import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/auth/recover/update-key
 * 복구 후 공개키 업데이트 API
 *
 * 요청 본문:
 * - userId: 사용자 ID
 * - newPublicKey: 새로 생성한 공개키
 * - deviceInfo: 새 기기 정보
 *
 * 응답:
 * - success: true
 * - message: 성공 메시지
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, newPublicKey, deviceInfo } = body

    // 입력 검증
    if (!userId) {
      return NextResponse.json(
        { error: 'userId가 필요합니다.' },
        { status: 400 }
      )
    }

    if (!newPublicKey) {
      return NextResponse.json(
        { error: '새 공개키가 필요합니다.' },
        { status: 400 }
      )
    }

    // 사용자 조회
    const user = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!user) {
      return NextResponse.json(
        { error: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 공개키 업데이트
    await prisma.user.update({
      where: { id: userId },
      data: {
        publicKey: newPublicKey,
        keyAlgorithm: 'ECDSA_P256',
        keyCreatedAt: new Date(),
        deviceInfo: deviceInfo || 'Unknown device',
      }
    })

    return NextResponse.json({
      success: true,
      message: '공개키가 성공적으로 업데이트되었습니다.',
    })

  } catch (error) {
    console.error('공개키 업데이트 실패:', error)
    return NextResponse.json(
      { error: '공개키 업데이트 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}