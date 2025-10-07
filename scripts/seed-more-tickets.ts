import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 추가 테스트 데이터 생성 시작...')

  // 1. 지갑 주소로 유저 찾기
  const walletAddress = '0xcC13e922DF85c22E01e71f9a107526E5A5ee9999'
  const user = await prisma.user.findUnique({
    where: {
      walletAddress: walletAddress,
    },
  })

  if (!user) {
    console.error('❌ 해당 지갑 주소를 가진 유저를 찾을 수 없습니다:', walletAddress)
    return
  }
  console.log('✅ 유저 찾기 완료:', user.id, user.name)

  // 2. 다양한 더미 티켓 생성
  const ticketsData = [
    {
      name: 'VIP 콘서트 티켓',
      description: '프리미엄 좌석 + 사인회 참여권',
      price: '0.05',
      imageUrl: 'https://via.placeholder.com/400x300?text=VIP+Concert',
    },
    {
      name: '일반 콘서트 티켓',
      description: '일반 좌석',
      price: '0.02',
      imageUrl: 'https://via.placeholder.com/400x300?text=General+Concert',
    },
    {
      name: '스포츠 경기 티켓',
      description: '축구 경기 관람권',
      price: '0.03',
      imageUrl: 'https://via.placeholder.com/400x300?text=Sports+Match',
    },
    {
      name: '영화 시사회 티켓',
      description: '개봉 전 시사회 입장권',
      price: '0.01',
      imageUrl: 'https://via.placeholder.com/400x300?text=Movie+Premiere',
    },
    {
      name: '페스티벌 티켓',
      description: '3일 페스티벌 입장권',
      price: '0.08',
      imageUrl: 'https://via.placeholder.com/400x300?text=Festival+Pass',
    },
  ]

  let tokenIdCounter = 2 // 기존 티켓이 tokenId 1을 사용했으므로 2부터 시작

  for (const ticketData of ticketsData) {
    // 티켓 생성
    const ticket = await prisma.ticket.create({
      data: {
        ...ticketData,
        maxSupply: 100,
        currentSupply: 1,
        isActive: true,
      },
    })
    console.log(`✅ 티켓 생성 완료: ${ticket.name} (${ticket.id})`)

    // 구매 기록 생성 (일부는 사용됨으로 설정)
    const isUsed = Math.random() > 0.6 // 40% 확률로 사용됨
    const purchase = await prisma.purchase.create({
      data: {
        userId: user.id,
        ticketId: ticket.id,
        transactionHash: '0xtest' + Date.now().toString(16) + Math.random().toString(36).substring(2, 8),
        tokenId: tokenIdCounter.toString(),
        used: isUsed,
        usedAt: isUsed ? new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000) : null, // 랜덤 사용 날짜
      },
    })
    console.log(`✅ 구매 기록 생성: Token #${tokenIdCounter} (${isUsed ? '사용완료' : '미사용'})`)

    tokenIdCounter++

    // API 요청 제한을 피하기 위한 짧은 대기
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  console.log('\n🎉 추가 테스트 데이터 생성 완료!')
  console.log(`총 ${ticketsData.length}개의 티켓 및 구매 기록 생성됨`)
}

main()
  .catch((e) => {
    console.error('❌ 에러 발생:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })