import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  ApplicationStatus,
  PaymentStatus,
  RoundStatus,
} from '@prisma/client'
import {
  purchaseTicketWithPoints,
  PurchaseTicketError,
} from '@/lib/tickets/purchaseWithPoints'

type Params = {
  params: {
    roundId: string
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  const { roundId } = params

  if (!roundId) {
    return NextResponse.json(
      { success: false, error: 'roundId가 필요합니다.' },
      { status: 400 }
    )
  }

  const adminSecret = process.env.LOTTERY_ADMIN_SECRET
  if (adminSecret) {
    const providedSecret = request.headers.get('x-admin-secret')
    if (providedSecret !== adminSecret) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }
  }

  const round = await prisma.lotteryRound.findUnique({
    where: { id: roundId },
    include: {
      event: {
        include: {
          _count: {
            select: { tickets: true },
          },
        },
      },
      applications: {
        where: {
          status: ApplicationStatus.WON,
          priority: {
            not: null,
          },
        },
        include: {
          user: true,
          ticket: {
            select: { id: true },
          },
        },
        orderBy: [
          { priority: 'asc' },
          { createdAt: 'asc' },
        ],
      },
    },
  })

  if (!round) {
    return NextResponse.json(
      { success: false, error: '라운드를 찾을 수 없습니다.' },
      { status: 404 }
    )
  }

  if (round.status !== RoundStatus.DRAWN) {
    return NextResponse.json(
      { success: false, error: 'DRAWN 상태의 라운드만 자동 결제가 가능합니다.' },
      { status: 400 }
    )
  }

  const totalCapacity = round.event.ticketCount
  const existingTickets = round.event._count.tickets
  let remainingSlots = Math.max(0, totalCapacity - existingTickets)

  if (remainingSlots <= 0) {
    await prisma.lotteryRound.update({
      where: { id: round.id },
      data: { status: RoundStatus.CLOSED },
    })
    return NextResponse.json({
      success: true,
      processed: [],
      remainingSlots: 0,
      message: '이미 모든 티켓이 발급되었습니다.',
    })
  }

  const processed: Array<{
    applicationId: string
    status: 'PAID' | 'FAILED'
    reason?: string
    ticketId?: string
    tokenId?: string
    transactionHash?: string
  }> = []

  for (const application of round.applications) {
    if (remainingSlots <= 0) break
    if (application.ticket) {
      processed.push({
        applicationId: application.id,
        status: 'PAID',
        ticketId: application.ticket.id,
      })
      continue
    }

    if (!application.user || !application.user.walletAddress) {
      await prisma.lotteryApplication.update({
        where: { id: application.id },
        data: {
          paymentStatus: PaymentStatus.FAILED,
          status: ApplicationStatus.EXPIRED,
        },
      })
      processed.push({
        applicationId: application.id,
        status: 'FAILED',
        reason: 'WALLET_NOT_FOUND',
      })
      continue
    }

    try {
      const purchaseResult = await purchaseTicketWithPoints({
        eventId: round.eventId,
        userId: application.userId,
        applicationId: application.id,
        description: `티켓 추첨 자동결제: ${round.event.title}`,
      })

      await prisma.lotteryApplication.update({
        where: { id: application.id },
        data: {
          status: ApplicationStatus.PAID,
          paymentStatus: PaymentStatus.PAID,
          paymentDeadline: null,
          pointAmount: round.event.price,
        },
      })

      processed.push({
        applicationId: application.id,
        status: 'PAID',
        ticketId: purchaseResult.ticket.id,
        tokenId: purchaseResult.tokenId.toString(),
        transactionHash: purchaseResult.transactionHash,
      })

      remainingSlots -= 1
    } catch (error) {
      if (error instanceof PurchaseTicketError) {
        if (
          error.code === 'INSUFFICIENT_POINTS' ||
          error.code === 'WALLET_NOT_FOUND' ||
          error.code === 'USER_NOT_FOUND'
        ) {
          await prisma.lotteryApplication.update({
            where: { id: application.id },
            data: {
              paymentStatus: PaymentStatus.FAILED,
              status: ApplicationStatus.EXPIRED,
            },
          })
          processed.push({
            applicationId: application.id,
            status: 'FAILED',
            reason: error.code,
          })
          continue
        }

        if (error.code === 'SOLD_OUT') {
          remainingSlots = 0
          break
        }

        if (error.code === 'EVENT_NOT_FOUND') {
          console.error('Lottery auto-pay fatal error:', error)
          return NextResponse.json(
            {
              success: false,
              error: error.message,
              code: error.code,
              processed,
            },
            { status: 404 }
          )
        }

        if (
          error.code === 'PRIVATE_KEY_MISSING' ||
          error.code === 'SBT_MINT_FAILED' ||
          error.code === 'TOKEN_ID_MISSING'
        ) {
          console.error('Lottery auto-pay fatal error:', error)
          return NextResponse.json(
            {
              success: false,
              error: error.message,
              code: error.code,
              processed,
            },
            { status: 500 }
          )
        }

        await prisma.lotteryApplication.update({
          where: { id: application.id },
          data: {
            paymentStatus: PaymentStatus.FAILED,
          },
        })

        processed.push({
          applicationId: application.id,
          status: 'FAILED',
          reason: error.code,
        })
        continue
      }

      console.error('Lottery auto-pay unexpected error:', error)
      return NextResponse.json(
        {
          success: false,
          error: '자동 결제 처리 중 서버 오류가 발생했습니다.',
          processed,
        },
        { status: 500 }
      )
    }
  }

  await prisma.lotteryRound.update({
    where: { id: round.id },
    data: {
      status: RoundStatus.CLOSED,
    },
  })

  return NextResponse.json({
    success: true,
    processed,
    remainingSlots,
  })
}
