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

    // 사용자의 구매 내역 조회
    const purchases = await prisma.purchase.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        ticket: true,
      },
      orderBy: {
        purchaseDate: 'desc',
      },
    })

    return NextResponse.json({
      success: true,
      purchases: purchases.map(purchase => ({
        id: purchase.id,
        transactionHash: purchase.transactionHash,
        tokenId: purchase.tokenId,
        purchaseDate: purchase.purchaseDate,
        used: purchase.used,
        usedAt: purchase.usedAt,
        ticket: {
          id: purchase.ticket.id,
          name: purchase.ticket.name,
          description: purchase.ticket.description,
          price: purchase.ticket.price,
          imageUrl: purchase.ticket.imageUrl,
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