import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session_token')?.value

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const session = await prisma.session.findUnique({
      where: { sessionToken },
      include: { user: true },
    })

    if (!session || session.expires < new Date()) {
      return NextResponse.json({ error: 'Session expired' }, { status: 401 })
    }

    const applications = await prisma.lotteryApplication.findMany({
      where: { userId: session.user.id },
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
