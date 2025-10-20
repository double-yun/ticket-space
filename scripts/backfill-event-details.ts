import { PrismaClient, Prisma } from '@prisma/client'

const prisma = new PrismaClient()
const shiftMinutes = (date: Date, minutes: number) =>
  new Date(date.getTime() + minutes * 60 * 1000)

const PRESET_DETAILS: Record<
  string,
  {
    venueName?: string
    venueAddress?: string
    seatLayoutSummary?: string
    seatCapacity?: number
  }
> = {
  'IU Concert - The Golden Hour': {
    venueName: '서울 잠실종합운동장 주경기장',
    venueAddress: '서울특별시 송파구 올림픽로 25',
    seatLayoutSummary: 'VIP 500석 · R석 1,500석 · S석 3,200석 (전석 지정석)',
    seatCapacity: 5200,
  },
  'BTS World Tour - Yet To Come': {
    venueName: '부산 아시아드 주경기장',
    venueAddress: '부산광역시 연제구 월드컵대로 344',
    seatLayoutSummary: 'VIP 존 2,000석 · A석 12,000석 · B석 16,000석 · 스탠딩 10,000명',
    seatCapacity: 40000,
  },
  'Choi Yuri Concert 2025': {
    venueName: '서울 올림픽공원 올림픽홀',
    venueAddress: '서울특별시 송파구 올림픽로 424',
    seatLayoutSummary: 'R석 1,200석 · S석 1,800석 · 스탠딩 200명',
    seatCapacity: 3200,
  },
  'Local Indie Band Festival': {
    venueName: '홍대 롤링홀',
    venueAddress: '서울특별시 마포구 잔다리로 6길 35 지하 1층',
    seatLayoutSummary: '스탠딩 존 1,200명 · 좌석 300석 (자유석)',
    seatCapacity: 1500,
  },
}

async function main() {
  const events = await prisma.event.findMany({
    include: {
      rounds: {
        orderBy: { applicationDeadline: 'asc' },
      },
    },
  })

  if (events.length === 0) {
    console.log('No events found. Nothing to backfill.')
    return
  }

  for (const event of events) {
    const updates: Prisma.EventUpdateInput = {}

    if (event.seatCapacity == null) {
      updates.seatCapacity = event.ticketCount
    }

    const baseStartSource = event.eventStartAt ?? event.deadline ?? event.saleStart ?? new Date()
    const baseStart = new Date(baseStartSource)

    if (!event.eventStartAt) {
      updates.eventStartAt = baseStart
    }

    if (!event.eventEndAt) {
      updates.eventEndAt = shiftMinutes(baseStart, 150)
    }

    if (!event.doorsOpenAt) {
      updates.doorsOpenAt = shiftMinutes(baseStart, -60)
    }

    if (!event.venueName || event.venueName === '미정') {
      updates.venueName = '미정'
    }

    if (!event.venueAddress || event.venueAddress === '추후 공지 예정') {
      updates.venueAddress = '추후 공지 예정'
    }

    if (!event.seatLayoutSummary || event.seatLayoutSummary === '좌석 정보는 추후 공지됩니다.') {
      updates.seatLayoutSummary = '좌석 정보는 추후 공지됩니다.'
    }

    const earliestRoundDeadline = event.rounds[0]?.applicationDeadline

    if (event.rounds.length > 0) {
      if (!event.lotteryApplicationDeadline && earliestRoundDeadline) {
        updates.lotteryApplicationDeadline = earliestRoundDeadline
      }

      if (!event.lotteryResultAnnouncementAt && earliestRoundDeadline) {
        updates.lotteryResultAnnouncementAt = shiftMinutes(earliestRoundDeadline, 60 * 24)
      }
    }

    const presets = PRESET_DETAILS[event.title]
    if (presets) {
      if (presets.venueName && (!event.venueName || event.venueName === '미정')) {
        updates.venueName = presets.venueName
      }
      if (presets.venueAddress && (!event.venueAddress || event.venueAddress === '추후 공지 예정')) {
        updates.venueAddress = presets.venueAddress
      }
      if (presets.seatLayoutSummary && (!event.seatLayoutSummary || event.seatLayoutSummary === '좌석 정보는 추후 공지됩니다.')) {
        updates.seatLayoutSummary = presets.seatLayoutSummary
      }
      if (
        typeof presets.seatCapacity === 'number' &&
        (event.seatCapacity == null || event.seatCapacity === event.ticketCount)
      ) {
        updates.seatCapacity = presets.seatCapacity
      }
    }

    if (Object.keys(updates).length === 0) {
      continue
    }

    await prisma.event.update({
      where: { id: event.id },
      data: updates,
    })

    console.log(`✅ Backfilled event details for "${event.title}".`)
  }
}

main()
  .catch((error) => {
    console.error('❌ Failed to backfill event details:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
