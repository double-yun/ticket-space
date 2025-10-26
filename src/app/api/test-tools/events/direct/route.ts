import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type DirectEventPayload = {
  title?: string
  ticketCount?: number
  price?: number
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as DirectEventPayload
    const title = (body.title ?? '').trim()
    const ticketCount = Number(body.ticketCount ?? 0)
    const price = Number(body.price ?? 10000)

    if (!title) {
      return NextResponse.json({ success: false, error: '제목을 입력해주세요.' }, { status: 400 })
    }

    if (!Number.isFinite(ticketCount) || ticketCount < 1) {
      return NextResponse.json({ success: false, error: '티켓 수는 1 이상이어야 합니다.' }, { status: 400 })
    }

    if (!Number.isFinite(price) || price < 0) {
      return NextResponse.json({ success: false, error: '가격을 올바르게 입력해주세요.' }, { status: 400 })
    }

    const event = await prisma.event.create({
      data: {
        title,
        description: '테스트용 일반 판매 이벤트',
        ticketCount,
        price,
        saleStart: new Date(),
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: 'PUBLISHED',
      },
    })

    return NextResponse.json({ success: true, event })
  } catch (error) {
    console.error('[TestTools] Direct event creation failed:', error)
    return NextResponse.json(
      { success: false, error: '이벤트 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
