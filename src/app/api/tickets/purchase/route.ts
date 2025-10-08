import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { purchaseTicketWithPoints, PurchaseTicketError } from '@/lib/tickets/purchaseWithPoints'
import { getAuthenticatedUser } from '@/lib/auth/server'

export async function POST(request: NextRequest) {
  try {
    const { eventId } = await request.json()

    if (!eventId) {
      return NextResponse.json({ error: '이벤트 ID가 필요합니다.' }, { status: 400 })
    }

    const user = await getAuthenticatedUser(request)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
      const result = await purchaseTicketWithPoints({
        eventId,
        userId: user.id,
      })

      return NextResponse.json({
        success: true,
        ticket: {
          id: result.ticket.id,
          transactionHash: result.transactionHash,
          tokenId: result.tokenId.toString(),
          blockNumber: result.blockNumber.toString(),
          event: {
            id: result.event.id,
            title: result.event.title,
            price: result.event.price,
          },
        },
        user: {
          pointBalance: result.pointBalance,
        },
      })
    } catch (error) {
      console.error('Purchase error:', error)

      if (error instanceof PurchaseTicketError) {
        switch (error.code) {
          case 'EVENT_NOT_FOUND':
            return NextResponse.json({ error: '이벤트를 찾을 수 없습니다.' }, { status: 404 })
          case 'SOLD_OUT':
            return NextResponse.json({ error: '티켓이 매진되었습니다.' }, { status: 400 })
          case 'INSUFFICIENT_POINTS':
            return NextResponse.json({ error: error.message }, { status: 400 })
          case 'WALLET_NOT_FOUND':
            return NextResponse.json({ error: '사용자 지갑 정보를 찾을 수 없습니다.' }, { status: 400 })
          case 'USER_NOT_FOUND':
            return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 })
          case 'PRIVATE_KEY_MISSING':
            return NextResponse.json({ error: error.message }, { status: 500 })
          case 'SBT_MINT_FAILED':
            return NextResponse.json(
              { error: 'SBT 발급에 실패했습니다. 포인트가 환불되었습니다.' },
              { status: 500 }
            )
          case 'TOKEN_ID_MISSING':
            return NextResponse.json(
              { error: 'SBT가 발급되었으나 TokenId를 찾을 수 없습니다.' },
              { status: 500 }
            )
          default:
            return NextResponse.json(
              { error: error.message ?? '티켓 구매에 실패했습니다.' },
              { status: 500 }
            )
        }
      }

      const message = error instanceof Error ? error.message : 'Purchase failed'
      return NextResponse.json({ error: `Purchase failed: ${message}` }, { status: 500 })
    }
  } catch (error) {
    console.error('Purchase error:', error)
    const message = error instanceof Error ? error.message : 'Purchase failed'
    return NextResponse.json({ error: `Purchase failed: ${message}` }, { status: 500 })
  }
}
