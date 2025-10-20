import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { EventStatus, RoundStatus } from '@prisma/client'

export async function GET() {
  try {
    const events = await prisma.event.findMany({
      where: {
        status: EventStatus.PUBLISHED,
      },
      orderBy: {
        deadline: 'asc',
      },
      include: {
        rounds: {
          orderBy: {
            roundNumber: 'asc',
          },
        },
        _count: {
          select: {
            tickets: true,
          },
        },
      },
    })

    const directPurchaseEvents = []
    const lotteryEvents = []

    for (const event of events) {
      const base = {
        id: event.id,
        name: event.title,
        description: event.description ?? '',
        price: event.price,
        maxSupply: event.ticketCount,
        currentSupply: event._count.tickets,
        deadline: event.deadline,
        seatCapacity: event.seatCapacity,
        eventStartAt: event.eventStartAt,
        eventEndAt: event.eventEndAt,
        doorsOpenAt: event.doorsOpenAt,
        venueName: event.venueName,
        venueAddress: event.venueAddress,
        seatLayoutSummary: event.seatLayoutSummary,
        lotteryApplicationDeadline: event.lotteryApplicationDeadline,
        lotteryResultAnnouncementAt: event.lotteryResultAnnouncementAt,
      }

      if (event.rounds.length > 0) {
        const openRound = event.rounds.find((r) => r.status === RoundStatus.OPEN)
        
		if (openRound) {
          lotteryEvents.push({
            ...base,
            roundId: openRound.id,
            applicationDeadline: openRound.applicationDeadline,
          })
		}
      } else {
        directPurchaseEvents.push(base)
      }
    }

    return NextResponse.json({
      success: true,
      directPurchaseEvents,
      lotteryEvents,
    })
  } catch (error) {
    console.error('Error fetching tickets:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch tickets' },
      { status: 500 }
    )
  }
}
