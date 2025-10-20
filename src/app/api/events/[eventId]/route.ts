import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params
    const numericId = Number(eventId)

    if (!Number.isInteger(numericId) || numericId <= 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid event id' },
        { status: 400 }
      )
    }

    const searchParams = new URL(request.url).searchParams
    const requestedRoundId = searchParams.get('roundId')

    const event = await prisma.event.findUnique({
      where: { id: numericId },
      include: {
        rounds: {
          orderBy: { roundNumber: 'asc' },
          include: {
            _count: {
              select: { applications: true },
            },
          },
        },
        _count: {
          select: { tickets: true },
        },
      },
    })

    if (!event) {
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      )
    }

    const eventPayload = {
      id: event.id,
      title: event.title,
      description: event.description ?? '',
      price: event.price,
      ticketCount: event.ticketCount,
      seatCapacity: event.seatCapacity,
      currentSupply: event._count.tickets,
      deadline: event.deadline,
      saleStart: event.saleStart,
      eventStartAt: event.eventStartAt,
      eventEndAt: event.eventEndAt,
      doorsOpenAt: event.doorsOpenAt,
      venueName: event.venueName,
      venueAddress: event.venueAddress,
      seatLayoutSummary: event.seatLayoutSummary,
      lotteryApplicationDeadline: event.lotteryApplicationDeadline,
      lotteryResultAnnouncementAt: event.lotteryResultAnnouncementAt,
      status: event.status,
      type: event.rounds.length > 0 ? 'lottery' : 'direct',
      rounds: event.rounds.map((round) => ({
        id: round.id,
        roundNumber: round.roundNumber,
        status: round.status,
        applicationDeadline: round.applicationDeadline,
        drawnAt: round.drawnAt,
        applicantCount: round._count.applications,
      })),
    }

    const selectedRound =
      requestedRoundId && event.rounds.length > 0
        ? eventPayload.rounds.find((round) => round.id === requestedRoundId) ?? null
        : null

    return NextResponse.json({
      success: true,
      event: eventPayload,
      round: selectedRound,
    })
  } catch (error) {
    console.error('Failed to fetch event detail:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch event detail' },
      { status: 500 }
    )
  }
}
