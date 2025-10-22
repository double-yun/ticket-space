import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth/server'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 새로운 스키마: 사용자의 티켓 조회
    const tickets = await prisma.ticket.findMany({
      where: {
        userId: user.id,
      },
      include: {
        event: true,
        application: true,
      },
      orderBy: {
        issuedAt: 'desc',
      },
    })

    return NextResponse.json({
      success: true,
      purchases: tickets.map(ticket => ({
        id: ticket.id,
        transactionHash: ticket.txHash || '',
        tokenId: ticket.tokenId?.toString() || '0',
        purchaseDate: ticket.issuedAt,
        used: ticket.used,
        usedAt: ticket.used ? ticket.updatedAt : null,
        userId: ticket.userId,
        ticket: {
          id: ticket.eventId,
          name: ticket.event.title,
          description: ticket.event.description || '',
          price: ticket.event.price.toString(),
          imageUrl: null, // 새 스키마에는 이미지 URL이 없음
        },
      })),
    })
  } catch (error) {
    console.error('Get purchases error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch purchases' },
      { status: 500 }
    )
  }
}
