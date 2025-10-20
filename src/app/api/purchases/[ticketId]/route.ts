import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  try {
    const user = await getAuthenticatedUser(request)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { ticketId } = await params

    if (!ticketId) {
      return NextResponse.json({ error: 'Invalid ticket id' }, { status: 400 })
    }

    const ticket = await prisma.ticket.findFirst({
      where: {
        id: ticketId,
        userId: user.id,
      },
      include: {
        event: true,
        application: true,
      },
    })

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      ticket: {
        id: ticket.id,
        transactionHash: ticket.txHash || '',
        tokenId: ticket.tokenId?.toString() || '0',
        purchaseDate: ticket.issuedAt,
        used: ticket.used,
        usedAt: ticket.used ? ticket.updatedAt : null,
        refunded: ticket.refunded,
        event: {
          id: ticket.event.id,
          title: ticket.event.title,
          description: ticket.event.description ?? '',
          price: ticket.event.price,
          deadline: ticket.event.deadline,
          saleStart: ticket.event.saleStart,
          seatCapacity: ticket.event.seatCapacity,
          eventStartAt: ticket.event.eventStartAt,
          eventEndAt: ticket.event.eventEndAt,
          doorsOpenAt: ticket.event.doorsOpenAt,
          venueName: ticket.event.venueName,
          venueAddress: ticket.event.venueAddress,
          seatLayoutSummary: ticket.event.seatLayoutSummary,
          lotteryApplicationDeadline: ticket.event.lotteryApplicationDeadline,
          lotteryResultAnnouncementAt: ticket.event.lotteryResultAnnouncementAt,
          status: ticket.event.status,
        },
        application: ticket.application
          ? {
              id: ticket.application.id,
              roundId: ticket.application.roundId,
              status: ticket.application.status,
              paymentStatus: ticket.application.paymentStatus,
              paymentDeadline: ticket.application.paymentDeadline,
              pointAmount: ticket.application.pointAmount,
            }
          : null,
      },
    })
  } catch (error) {
    console.error('Failed to fetch ticket detail:', error)
    return NextResponse.json({ error: 'Failed to fetch ticket detail' }, { status: 500 })
  }
}
