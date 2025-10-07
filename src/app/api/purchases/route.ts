import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  try {
    // 세션 확인
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

    // 새로운 스키마: 사용자의 티켓 조회
    const tickets = await prisma.ticket.findMany({
      where: {
        userId: session.user.id,
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