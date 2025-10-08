import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 이벤트 테스트 데이터 생성 시작...')

  // 이벤트 생성
  const now = new Date()
  const events = await Promise.all([
    prisma.event.create({
      data: {
        title: '아이유 콘서트 2024',
        description: 'IU Concert - The Golden Hour',
        ticketCount: 5000,
        price: 5000,
        saleStart: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        deadline: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        status: 'PUBLISHED',
      },
    }),
    prisma.event.create({
      data: {
        title: 'BTS 월드투어',
        description: 'BTS World Tour - Yet To Come',
        ticketCount: 10000,
        price: 10000,
        saleStart: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
        deadline: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000),
        status: 'PUBLISHED',
      },
    }),
    prisma.event.create({
      data: {
        title: '최유리 콘서트 2025',
        description: '최유리 Concert',
        ticketCount: 5000,
        price: 15000,
        saleStart: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        deadline: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        status: 'PUBLISHED',
      },
    }),
  ])
  console.log(`✅ ${events.length}개 이벤트 생성 완료`)

  // 추첨 라운드 생성 (첫 번째 이벤트용)
  const round = await prisma.lotteryRound.create({
    data: {
      eventId: events[0].id,
      roundNumber: 1,
      status: 'OPEN',
      applicationDeadline: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
    },
  })
  console.log('✅ 추첨 라운드 생성 완료')

  console.log('\n🎉 완료!')
  console.log('생성된 이벤트:')
  events.forEach((event, idx) => {
    console.log(`  ${idx + 1}. ${event.title} - ${event.price.toLocaleString()}P`)
  })
}

main()
  .catch((e) => {
    console.error('❌ 에러:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
