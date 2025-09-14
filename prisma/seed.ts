import { PrismaClient } from '@prisma/client'
import { parseEther } from 'viem'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 시드 데이터 생성 중...')

  // 샘플 티켓들 생성
  const tickets = await Promise.all([
    prisma.ticket.create({
      data: {
        name: '🎪 일반 입장권',
        description: '기본 이벤트 입장 티켓',
        price: parseEther('0.01').toString(), // 0.01 ETH
        maxSupply: 1000,
        imageUrl: 'https://via.placeholder.com/300x200?text=General+Ticket',
      },
    }),
    prisma.ticket.create({
      data: {
        name: '⭐ VIP 입장권',
        description: 'VIP 라운지 이용 가능',
        price: parseEther('0.05').toString(), // 0.05 ETH
        maxSupply: 100,
        imageUrl: 'https://via.placeholder.com/300x200?text=VIP+Ticket',
      },
    }),
    prisma.ticket.create({
      data: {
        name: '🎯 프리미엄 패키지',
        description: '굿즈 + 사진촬영 + VIP 라운지',
        price: parseEther('0.1').toString(), // 0.1 ETH
        maxSupply: 50,
        imageUrl: 'https://via.placeholder.com/300x200?text=Premium+Package',
      },
    }),
  ])

  console.log('✅ 티켓 데이터 생성 완료:')
  tickets.forEach((ticket) => {
    console.log(`  - ${ticket.name}: ${ticket.price} ETH`)
  })
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })