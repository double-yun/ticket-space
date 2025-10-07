import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 테스트 데이터 생성 시작...')

  // 1. 더미 티켓 생성
  const ticket = await prisma.ticket.create({
    data: {
      name: '테스트 콘서트 티켓',
      description: 'QR 코드 검증 테스트용 더미 티켓',
      price: '0.01', // 0.01 ETH
      maxSupply: 100,
      currentSupply: 1,
      imageUrl: 'https://via.placeholder.com/400x300?text=Test+Concert',
      isActive: true,
    },
  })
  console.log('✅ 더미 티켓 생성 완료:', ticket.id)

  // 2. 지갑 주소로 유저 찾기
  const walletAddress = '0x774a20359b7d10f1b56a48dAdEFb69C1B3609772'
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

  // 3. 구매 기록 생성
  const purchase = await prisma.purchase.create({
    data: {
      userId: user.id,
      ticketId: ticket.id,
      transactionHash: '0xtest' + Date.now().toString(16), // 테스트용 고유 트랜잭션 해시
      tokenId: '1',
      used: false,
    },
  })
  console.log('✅ 구매 기록 생성 완료:', purchase.id)

  console.log('\n🎉 테스트 데이터 생성 완료!')
  console.log('티켓 ID:', ticket.id)
  console.log('구매 ID:', purchase.id)
  console.log('Token ID:', purchase.tokenId)
  console.log('Transaction Hash:', purchase.transactionHash)
}

main()
  .catch((e) => {
    console.error('❌ 에러 발생:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })