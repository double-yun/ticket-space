import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth/server'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const applications = await prisma.lotteryApplication.findMany({
      where: { userId: user.id },
      include: {
        round: {
          include: {
            event: true,
          },
        },
        ticket: {
          select: {
            id: true,
            tokenId: true,
            txHash: true,
            issuedAt: true,
          },
        },
      },
      orderBy: [
        { status: 'asc' },
        { createdAt: 'desc' },
      ],
    })

    return NextResponse.json({
      success: true,
      applications: applications.map((application) => ({
        id: application.id,
        roundId: application.roundId,
        status: application.status,
        paymentStatus: application.paymentStatus,
        priority: application.priority,
        pointAmount: application.pointAmount,
        paymentDeadline: application.paymentDeadline,
        createdAt: application.createdAt,
        updatedAt: application.updatedAt,
        round: application.round
          ? {
              id: application.round.id,
              roundNumber: application.round.roundNumber,
              status: application.round.status,
              applicationDeadline: application.round.applicationDeadline,
              drawnAt: application.round.drawnAt,
              event: {
                id: application.round.event.id,
                title: application.round.event.title,
                description: application.round.event.description ?? '',
                price: application.round.event.price,
                deadline: application.round.event.deadline,
                saleStart: application.round.event.saleStart,
                seatCapacity: application.round.event.seatCapacity,
                eventStartAt: application.round.event.eventStartAt,
                eventEndAt: application.round.event.eventEndAt,
                doorsOpenAt: application.round.event.doorsOpenAt,
                venueName: application.round.event.venueName,
                venueAddress: application.round.event.venueAddress,
                seatLayoutSummary: application.round.event.seatLayoutSummary,
                lotteryApplicationDeadline: application.round.event.lotteryApplicationDeadline,
                lotteryResultAnnouncementAt: application.round.event.lotteryResultAnnouncementAt,
              },
            }
          : null,
        ticket: application.ticket
          ? {
              id: application.ticket.id,
              tokenId: application.ticket.tokenId?.toString() ?? null,
              txHash: application.ticket.txHash,
              issuedAt: application.ticket.issuedAt,
            }
          : null,
      })),
    })
  } catch (error) {
    console.error('Lottery applications fetch error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch lottery applications' },
      { status: 500 }
    )
  }
}
