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
          where: {
            status: RoundStatus.OPEN,
          },
          orderBy: {
            roundNumber: 'asc',
          },
          take: 1,
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
      }

      if (event.rounds.length > 0) {
        const round = event.rounds[0]
        lotteryEvents.push({
          ...base,
          roundId: round.id,
          applicationDeadline: round.applicationDeadline,
        })
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
