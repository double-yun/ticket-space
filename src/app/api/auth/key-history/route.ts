import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/auth/key-history?userId=xxx
 * 사용자 본인의 공개키 변경 이력 조회
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

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

    // 공개키 변경 이력 조회
    const keyHistory = await prisma.publicKeyHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        publicKey: true,
        keyAlgorithm: true,
        reason: true,
        deviceInfo: true,
        createdAt: true,
      },
    })

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        currentPublicKey: user.publicKey,
        keyCreatedAt: user.keyCreatedAt,
      },
      history: keyHistory,
    })
  } catch (error) {
    console.error('공개키 이력 조회 실패:', error)
    return NextResponse.json(
      { error: '공개키 이력 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}