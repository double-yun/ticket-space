import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { PointType } from '@prisma/client'

const PORTONE_API_BASE_URL = process.env.PORTONE_API_BASE_URL ?? 'https://api.portone.io'
const PORTONE_SECRET_API_KEY = process.env.PORTONE_SECRET_API_KEY

export async function POST(req: Request) {
  const { paymentId } = await req.json()

  if (!paymentId) {
    return NextResponse.json({ error: 'paymentId is required' }, { status: 400 })
  }

  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session_token')?.value

  if (!sessionToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const session = await prisma.session.findUnique({
    where: { sessionToken },
    include: { user: true },
  })

  if (!session || session.expires <= new Date()) {
    return NextResponse.json({ error: 'Session expired' }, { status: 401 })
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

  const user = session.user
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
