import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { PointType } from '@prisma/client'

const PORTONE_API_BASE_URL = process.env.PORTONE_API_BASE_URL ?? 'https://api.portone.io'
const PORTONE_SECRET_API_KEY = process.env.PORTONE_SECRET_API_KEY

export async function POST(req: Request) {
  const { paymentId, userId } = await req.json()

  if (!paymentId) {
    return NextResponse.json({ error: 'paymentId is required' }, { status: 400 })
  }

  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 })
  }

  // userId로 사용자 조회 (웹/앱 통일)
  const user = await prisma.user.findUnique({
    where: { id: userId }
  })

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 401 })
  }

  if (!PORTONE_SECRET_API_KEY) {
    console.error('PORTONE_SECRET_API_KEY is not configured')
    return NextResponse.json({ error: 'Payment integration is not configured' }, { status: 500 })
  }

  const res = await fetch(`${PORTONE_API_BASE_URL}/payments/${encodeURIComponent(paymentId)}`, {
    headers: {
      Authorization: `PortOne ${PORTONE_SECRET_API_KEY}`,
    },
  })

  if (!res.ok) {
    return NextResponse.json({ error: 'PortOne lookup failed' }, { status: 400 })
  }

  const payment = await res.json()
  const paymentStatus: string | undefined = payment?.status
  const totalAmountRaw = payment?.amount?.total
  const totalAmount = Number(totalAmountRaw)

  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    return NextResponse.json({ error: 'Invalid payment amount' }, { status: 400 })
  }

  if (paymentStatus !== 'PAID') {
    return NextResponse.json({ status: paymentStatus, amount: totalAmountRaw })
  }

  // user는 이미 위에서 선언됨
  const description = `PORTONE:${paymentId}`

  const existingHistory = await prisma.pointHistory.findFirst({
    where: {
      userId: user.id,
      description,
    },
  })

  if (existingHistory) {
    const latestUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { pointBalance: true },
    })

    return NextResponse.json({
      status: paymentStatus,
      amount: totalAmountRaw,
      pointBalance: latestUser?.pointBalance ?? user.pointBalance,
    })
  }

  const [_, updatedUser] = await prisma.$transaction([
    prisma.pointHistory.create({
      data: {
        userId: user.id,
        amount: totalAmount,
        type: PointType.CHARGE,
        description,
      },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: {
        pointBalance: {
          increment: totalAmount,
        },
      },
    }),
  ])

  return NextResponse.json({ status: paymentStatus, amount: totalAmountRaw, pointBalance: updatedUser.pointBalance })
}
