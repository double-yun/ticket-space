import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Deleting existing data...')
  // Delete in reverse order of dependency
  await prisma.ticket.deleteMany()
  await prisma.lotteryApplication.deleteMany()
  await prisma.lotteryRound.deleteMany()
  await prisma.pointHistory.deleteMany()
  await prisma.authChallenge.deleteMany()
  await prisma.event.deleteMany()
  await prisma.user.deleteMany()
  console.log('✅ Existing data deleted.')

  console.log('🌱 Seeding data...')

  // 1. Create a sample user
  const user = await prisma.user.create({
    data: {
      email: 'test@example.com',
      name: 'Test User',
      walletAddress: '0x1234567890123456789012345678901234567890',
      pointBalance: 20000,
    },
  })
  console.log(`👤 Created user: ${user.name} (${user.email})`)

  // 2. Give the user some points
  await prisma.pointHistory.create({
    data: {
      userId: user.id,
      amount: 20000,
      type: 'CHARGE',
      description: 'Initial seed points',
    },
  })
  console.log(`💰 Credited ${user.name} with 20,000 points.`)

  // 3. Create Events with extended details
  const now = new Date()
  const minutesPerDay = 24 * 60
  const relativeDate = (offsetDays: number, hour: number, minute = 0) => {
    const date = new Date(now.getTime() + offsetDays * 24 * 60 * 60 * 1000)
    date.setHours(hour, minute, 0, 0)
    return date
  }
  const shiftMinutes = (date: Date, minutes: number) =>
    new Date(date.getTime() + minutes * 60 * 1000)

  const iuEventStart = relativeDate(45, 19)
  const iuEventEnd = shiftMinutes(iuEventStart, 150) // +2.5h
  const iuDoorsOpen = shiftMinutes(iuEventStart, -90)
  const iuSaleStart = shiftMinutes(iuEventStart, -minutesPerDay * 20)
  const iuDeadline = shiftMinutes(iuEventStart, -minutesPerDay * 2)
  const iuLotteryDeadline = shiftMinutes(iuEventStart, -minutesPerDay * 5)
  const iuLotteryAnnouncement = shiftMinutes(iuEventStart, -minutesPerDay * 3)

  const btsEventStart = relativeDate(60, 18)
  const btsEventEnd = shiftMinutes(btsEventStart, 180) // +3h
  const btsDoorsOpen = shiftMinutes(btsEventStart, -120)
  const btsSaleStart = shiftMinutes(btsEventStart, -minutesPerDay * 45)
  const btsDeadline = shiftMinutes(btsEventStart, -minutesPerDay * 1)

  const choiEventStart = relativeDate(30, 20)
  const choiEventEnd = shiftMinutes(choiEventStart, 150) // +2.5h
  const choiDoorsOpen = shiftMinutes(choiEventStart, -75)
  const choiSaleStart = shiftMinutes(choiEventStart, -minutesPerDay * 18)
  const choiDeadline = shiftMinutes(choiEventStart, -minutesPerDay * 2)

  const indieEventStart = relativeDate(12, 17)
  const indieEventEnd = shiftMinutes(indieEventStart, 240) // +4h
  const indieDoorsOpen = shiftMinutes(indieEventStart, -60)
  const indieSaleStart = shiftMinutes(indieEventStart, -minutesPerDay * 7)
  const indieDeadline = shiftMinutes(indieEventStart, -minutesPerDay * 1)

  const events = await Promise.all([
    prisma.event.create({
      data: {
        title: 'IU Concert - The Golden Hour',
        description: '아이유의 대표곡과 함께하는 2025 스페셜 콘서트.',
        ticketCount: 5000,
        seatCapacity: 5200,
        price: 15000,
        saleStart: iuSaleStart,
        deadline: iuDeadline,
        eventStartAt: iuEventStart,
        eventEndAt: iuEventEnd,
        doorsOpenAt: iuDoorsOpen,
        venueName: '서울 잠실종합운동장 주경기장',
        venueAddress: '서울특별시 송파구 올림픽로 25',
        seatLayoutSummary: 'VIP 500석 · R석 1,500석 · S석 3,200석 (전석 지정석)',
        lotteryApplicationDeadline: iuLotteryDeadline,
        lotteryResultAnnouncementAt: iuLotteryAnnouncement,
        status: 'PUBLISHED',
      },
    }),
    prisma.event.create({
      data: {
        title: 'BTS World Tour - Yet To Come',
        description: 'BTS 월드투어의 하이라이트 공연. 새로운 셋리스트 공개!',
        ticketCount: 10000,
        seatCapacity: 40000,
        price: 20000,
        saleStart: btsSaleStart,
        deadline: btsDeadline,
        eventStartAt: btsEventStart,
        eventEndAt: btsEventEnd,
        doorsOpenAt: btsDoorsOpen,
        venueName: '부산 아시아드 주경기장',
        venueAddress: '부산광역시 연제구 월드컵대로 344',
        seatLayoutSummary: 'VIP 존 2,000석 · A석 12,000석 · B석 16,000석 · 스탠딩 10,000명',
        status: 'PUBLISHED',
      },
    }),
    prisma.event.create({
      data: {
        title: 'Choi Yuri Concert 2025',
        description: '최유리의 감성 가득한 단독 콘서트.',
        ticketCount: 3000,
        seatCapacity: 3200,
        price: 18000,
        saleStart: choiSaleStart,
        deadline: choiDeadline,
        eventStartAt: choiEventStart,
        eventEndAt: choiEventEnd,
        doorsOpenAt: choiDoorsOpen,
        venueName: '서울 올림픽공원 올림픽홀',
        venueAddress: '서울특별시 송파구 올림픽로 424',
        seatLayoutSummary: 'R석 1,200석 · S석 1,800석 · 스탠딩 200명',
        status: 'PUBLISHED',
      },
    }),
    prisma.event.create({
      data: {
        title: 'Local Indie Band Festival',
        description: '로컬 인디 밴드 12팀이 참여하는 미니 페스티벌.',
        ticketCount: 1000,
        seatCapacity: 1500,
        price: 5000,
        saleStart: indieSaleStart,
        deadline: indieDeadline,
        eventStartAt: indieEventStart,
        eventEndAt: indieEventEnd,
        doorsOpenAt: indieDoorsOpen,
        venueName: '홍대 롤링홀',
        venueAddress: '서울특별시 마포구 잔다리로 6길 35 지하 1층',
        seatLayoutSummary: '스탠딩 존 1,200명 · 좌석 300석 (자유석)',
        status: 'PUBLISHED',
      },
    }),
  ])
  console.log(`🎉 Created ${events.length} events.`)

  // 4. Create Lottery Rounds for the first event
  const round1 = await prisma.lotteryRound.create({
    data: {
      eventId: events[0].id,
      roundNumber: 1,
      status: 'OPEN',
      applicationDeadline: iuLotteryDeadline,
    },
  })
  console.log(`🎟️ Created lottery round for: ${events[0].title}`)

  // 5. Create a Lottery Application for the user
  const application = await prisma.lotteryApplication.create({
    data: {
      roundId: round1.id,
      userId: user.id,
      walletAddress: user.walletAddress,
      status: 'APPLIED',
    },
  })
  console.log(`📄 Created lottery application (${application.id}) for ${user.name} to ${events[0].title}.`)


  console.log('✅ Seed data created successfully!')
}

main()
  .catch((e) => {
    console.error('❌ Error seeding data:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
