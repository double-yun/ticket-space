import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('💰 포인트 충전 시작...')

  // 환경변수 또는 인자로 이메일 받기
  const userEmail = process.argv[2] || process.env.USER_EMAIL

  if (!userEmail) {
    console.error('❌ 사용법: npx tsx scripts/seed-user-points.ts <email>')
    console.error('   또는: USER_EMAIL=your@email.com npx tsx scripts/seed-user-points.ts')
    process.exit(1)
  }

  // 유저 찾기
  const user = await prisma.user.findUnique({
    where: { email: userEmail },
  })

  if (!user) {
    console.error('❌ 해당 이메일의 유저를 찾을 수 없습니다:', userEmail)
    process.exit(1)
  }

  console.log('✅ 유저 찾기 완료:', user.name || user.email)

  // 충전할 포인트 (기본값: 200,000)
  const chargeAmount = process.argv[3] ? parseInt(process.argv[3]) : 200000

  // 포인트 충전 히스토리 생성
  await prisma.pointHistory.create({
    data: {
      userId: user.id,
      amount: chargeAmount,
      type: 'CHARGE',
      description: 'Test seed - manual charge',
    },
  })

  // 잔액 업데이트
  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      pointBalance: {
        increment: chargeAmount,
      },
    },
  })

  console.log('\n🎉 완료!')
  console.log('충전 금액:', chargeAmount.toLocaleString() + 'P')
  console.log('현재 잔액:', updatedUser.pointBalance.toLocaleString() + 'P')
}

main()
  .catch((e) => {
    console.error('❌ 에러:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
