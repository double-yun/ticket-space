import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { EventStatus } from '@prisma/client'

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
        _count: {
          select: {
            tickets: true,
          },
        },
      },
    })

    const tickets = events.map((event) => ({
      id: event.id,
      name: event.title,
      description: event.description ?? '',
      price: event.price,
      maxSupply: event.ticketCount,
      currentSupply: event._count.tickets,
      deadline: event.deadline,
    }))

    return NextResponse.json({
      success: true,
      tickets,
    })
  } catch (error) {
    console.error('Error fetching tickets:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch tickets' },
      { status: 500 }
    )
  }
}
