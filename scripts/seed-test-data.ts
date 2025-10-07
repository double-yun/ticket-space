import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 테스트 데이터 생성 시작...')

  // 0. 특정 유저 ID 설정
  const userId = process.argv[2] || 'cmggfpgko0000pp9gy6a0czv3'
  
  // 1. 유저 확인
  const user = await prisma.user.findUnique({
    where: { id: userId },
  })

  if (!user) {
    console.error('❌ 해당 유저 ID를 찾을 수 없습니다:', userId)
    return
  }
  console.log('✅ 유저 찾기 완료:', user.id, user.name || user.email)

  // 2. 이벤트 생성
  const now = new Date()
  const events = await Promise.all([
    prisma.event.create({
      data: {
        title: '아이유 콘서트 2024',
        description: 'IU Concert - The Golden Hour',
        ticketCount: 5000,
        price: 50000,
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
        price: 100000,
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
        price: 50000,
        saleStart: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        deadline: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        status: 'PUBLISHED',
      },
    }),
  ])
  console.log(`✅ ${events.length}개 이벤트 생성 완료`)

  // 3. 추첨 라운드 생성
  const round = await prisma.lotteryRound.create({
    data: {
      eventId: events[0].id,
      roundNumber: 1,
      status: 'DRAWN',
      resultHash: '0xtest' + Date.now().toString(16),
      drawnAt: new Date(),
      applicationDeadline: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
    },
  })
  console.log('✅ 추첨 라운드 생성 완료')

  // 4. 추첨 신청 생성 (당첨 상태)
  const application = await prisma.lotteryApplication.create({
    data: {
      roundId: round.id,
      userId: user.id,
      walletAddress: user.walletAddress,
      priority: 1,
      applicationTxHash: '0xapp' + Date.now().toString(16),
      status: 'PAID',
      paymentStatus: 'PAID',
      paymentDeadline: new Date(now.getTime() + 1 * 60 * 60 * 1000),
      pointAmount: events[0].price,
    },
  })
  console.log('✅ 추첨 신청 생성 완료 (당첨)')

  // 5. 티켓 발행
  const ticket = await prisma.ticket.create({
    data: {
      applicationId: application.id,
      eventId: events[0].id,
      userId: user.id,
      tokenId: BigInt(1),
      txHash: '0xticket' + Date.now().toString(16),
      used: false,
      refunded: false,
    },
  })
  console.log('✅ 티켓 발행 완료:', ticket.id)

  // 6. 포인트 충전
  await prisma.pointHistory.create({
    data: {
      userId: user.id,
      amount: 200000,
      type: 'CHARGE',
      description: 'Test seed - initial charge',
    },
  })

  // 7. 포인트 사용
  await prisma.pointHistory.create({
    data: {
      userId: user.id,
      amount: -events[0].price,
      type: 'USE',
      description: `Ticket: ${events[0].title}`,
    },
  })

  // 8. 잔액 업데이트
  await prisma.user.update({
    where: { id: user.id },
    data: {
      pointBalance: 200000 - events[0].price,
    },
  })

  console.log('\n🎉 완료!')
  console.log('티켓:', events[0].title)
  console.log('잔액:', 200000 - events[0].price)
}

main()
  .catch((e) => {
    console.error('❌ 에러:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })