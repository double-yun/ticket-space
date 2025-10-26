import { NextRequest, NextResponse } from 'next/server'
import { executeDraw, markWinners, processAutoPayment } from '@/lib/lottery/draw'
import { prisma } from '@/lib/prisma'

/**
 * 추첨 실행 API
 * POST /api/lottery/rounds/[roundId]/draw
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ roundId: string }> }
) {
  try {
    // TODO: 관리자 권한 확인 추가
    // const user = await getAuthenticatedUser(request)
    // if (!user || user.role !== 'ADMIN') {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // }

    const { roundId } = await context.params
    const forceDraw = request.nextUrl.searchParams.get('force') === 'true'

    if (!roundId) {
      return NextResponse.json({ error: 'roundId가 필요합니다.' }, { status: 400 })
    }

    // 라운드 조회
    const round = await prisma.lotteryRound.findUnique({
      where: { id: roundId },
      include: {
        event: true,
      },
    })

    if (!round) {
      return NextResponse.json({ error: '라운드를 찾을 수 없습니다.' }, { status: 404 })
    }

    // 마감 시간 확인
    const now = new Date()
    if (!forceDraw && now <= round.applicationDeadline) {
      return NextResponse.json(
        { error: '아직 신청 마감 시간이 지나지 않았습니다.' },
        { status: 400 }
      )
    }

    // 라운드 상태 확인
    if (round.status === 'DRAWN') {
      return NextResponse.json(
        { error: '이미 추첨이 완료되었습니다.' },
        { status: 400 }
      )
    }

    // 라운드 상태를 CLOSED로 변경 (아직 OPEN이면)
    if (round.status === 'OPEN') {
      await prisma.lotteryRound.update({
        where: { id: roundId },
        data: { status: 'CLOSED' },
      })
    }

    // 추첨 실행
    const drawResult = await executeDraw(roundId, { force: forceDraw })

    // 당첨자 마킹 (이벤트의 티켓 수량만큼)
    const winnerResult = await markWinners(roundId, round.event.ticketCount)

    // 당첨자 자동 결제
    const paymentResult = await processAutoPayment(roundId)

    return NextResponse.json({
      success: true,
      draw: {
        roundId: drawResult.roundId,
        applicantCount: drawResult.applicantCount,
        resultHash: drawResult.resultHash,
        txHash: drawResult.txHash,
      },
      winners: {
        count: winnerResult.winnerCount,
        winners: winnerResult.winners,
      },
      payment: {
        processed: paymentResult.processed,
        successCount: paymentResult.processed.filter((p) => p.status === 'PAID').length,
        failedCount: paymentResult.processed.filter((p) => p.status === 'FAILED').length,
      },
    })
  } catch (error) {
    console.error('Draw execution error:', error)
    return NextResponse.json(
      {
        error: '추첨 실행 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
