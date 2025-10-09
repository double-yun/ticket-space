import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roundId: string }> }
) {
  try {
    const { roundId } = await params

    const round = await prisma.lotteryRound.findUnique({
      where: { id: roundId },
      include: {
        event: true,
        applications: {
          select: {
            id: true,
          },
        },
      },
    })

    if (!round) {
      return NextResponse.json(
        { success: false, error: 'Round not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      round: {
        id: round.id,
        eventId: round.eventId,
        roundNumber: round.roundNumber,
        status: round.status,
        applicationDeadline: round.applicationDeadline,
        drawnAt: round.drawnAt,
        applicantCount: round.applications.length,
        event: {
          id: round.event.id,
          title: round.event.title,
          description: round.event.description,
          ticketCount: round.event.ticketCount,
          price: round.event.price,
          deadline: round.event.deadline,
          saleStart: round.event.saleStart,
          status: round.event.status,
        },
      },
    })
  } catch (error) {
    console.error('Lottery round fetch error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch lottery round' },
      { status: 500 }
    )
  }
}
