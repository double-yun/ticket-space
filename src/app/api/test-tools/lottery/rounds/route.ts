import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const rounds = await prisma.lotteryRound.findMany({
      where: {
        status: {
          in: ['OPEN', 'CLOSED'],
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        event: true,
        _count: {
          select: {
            applications: true,
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      rounds: rounds.map((round) => ({
        id: round.id,
        status: round.status,
        applicationDeadline: round.applicationDeadline,
        event: {
          id: round.event.id,
          title: round.event.title,
          ticketCount: round.event.ticketCount,
        },
        applicantCount: round._count.applications,
      })),
    })
  } catch (error) {
    console.error('[TestTools] Failed to fetch lottery rounds:', error)
    return NextResponse.json(
      { success: false, error: '라운드 목록을 불러오지 못했습니다.' },
      { status: 500 }
    )
  }
}
