import { PrismaClient } from '@prisma/client'
import { privateKeyToAccount } from 'viem/accounts'
import { getLotteryContractAddress, getPublicClient, getWalletClient } from '@/lib/blockchain'
import lotteryAbiJson from '@/lib/blockchain/lottery-abi.json'

const lotteryAbi = lotteryAbiJson
const prisma = new PrismaClient()

/**
 * Lottery 통합 테스트 스크립트
 *
 * 사용법:
 * pnpm test:lottery [userCount]
 *
 * 예: pnpm test:lottery 10
 */

async function runFullTest(userCount: number) {
  console.log('🎲 Lottery 전체 테스트 시작\n')
  console.log(`👥 테스트 유저: ${userCount}명`)
  console.log(`🎟️  티켓 수량: ${userCount}개\n`)

  // 1. 이벤트 및 라운드 생성
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('1️⃣  이벤트 및 라운드 생성')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  const event = await prisma.event.create({
    data: {
      title: `테스트 콘서트 ${new Date().toLocaleString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`,
      description: '추첨 시스템 테스트용 이벤트',
      ticketCount: userCount,
      price: 10000,
      saleStart: new Date(),
      deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: 'PUBLISHED',
    },
  })
  console.log(`✅ 이벤트: ${event.title}`)

  // 마감: 1시간 후 (블록체인 시간 고려)
  const applicationDeadline = new Date(Date.now() + 60 * 60 * 1000)
  const round = await prisma.lotteryRound.create({
    data: {
      eventId: event.id,
      roundNumber: 1,
      status: 'OPEN',
      applicationDeadline,
    },
  })
  console.log(`✅ 라운드 ID: ${round.id}`)
  console.log(`✅ 신청 마감: ${applicationDeadline.toLocaleString('ko-KR')}\n`)

  // 온체인 lottery 생성
  const privateKey = process.env.PRIVATE_KEY as `0x${string}`
  if (!privateKey) {
    throw new Error('PRIVATE_KEY not set')
  }

  const lotteryContractAddress = (await getLotteryContractAddress()) as `0x${string}`
  const publicClient = getPublicClient()
  const serverAccount = privateKeyToAccount(privateKey)
  const walletClient = getWalletClient(serverAccount)

  const deadlineTimestamp = BigInt(Math.floor(applicationDeadline.getTime() / 1000))
  const { request } = await publicClient.simulateContract({
    account: serverAccount,
    address: lotteryContractAddress,
    abi: lotteryAbi,
    functionName: 'createLottery',
    args: [BigInt(event.id), deadlineTimestamp],
  })

  const txHash = await walletClient.writeContract(request)
  await publicClient.waitForTransactionReceipt({ hash: txHash })
  console.log(`✅ 온체인 Lottery 생성 완료\n`)

  // 2. 테스트 유저 생성 및 신청
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('2️⃣  테스트 유저 생성 및 신청')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  for (let i = 1; i <= userCount; i++) {
    const email = `testuser${i}_${Date.now()}@test.com`
    const walletAddress = `0x${Math.random().toString(16).substring(2, 42).padEnd(40, '0')}` as `0x${string}`

    const user = await prisma.user.create({
      data: {
        email,
        name: `테스트유저${i}`,
        walletAddress,
        pointBalance: 50000,
      },
    })

    const application = await prisma.lotteryApplication.create({
      data: {
        roundId: round.id,
        userId: user.id,
        walletAddress: user.walletAddress,
        status: 'APPLIED',
        paymentStatus: 'PENDING',
      },
    })

    const { request } = await publicClient.simulateContract({
      account: serverAccount,
      address: lotteryContractAddress,
      abi: lotteryAbi,
      functionName: 'submitApplicationFor',
      args: [walletAddress, BigInt(round.eventId)],
    })

    const txHash = await walletClient.writeContract(request)
    await publicClient.waitForTransactionReceipt({ hash: txHash })

    await prisma.lotteryApplication.update({
      where: { id: application.id },
      data: { applicationTxHash: txHash },
    })

    console.log(`✅ ${String(i).padStart(2)} / ${userCount} - ${user.name} 신청 완료`)
  }

  console.log(`\n🎉 ${userCount}명 신청 완료!\n`)

  // 3. 마감 시간 강제 변경 (테스트용)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('3️⃣  신청 마감 처리')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  await prisma.lotteryRound.update({
    where: { id: round.id },
    data: {
      applicationDeadline: new Date(Date.now() - 1000),
      status: 'CLOSED'
    },
  })
  console.log('✅ 신청 마감 완료\n')

  // 4. 추첨 실행
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('4️⃣  추첨 실행')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  const response = await fetch(`http://localhost:3000/api/lottery/rounds/${round.id}/draw`, {
    method: 'POST',
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`추첨 실패: ${JSON.stringify(error)}`)
  }

  const result = await response.json()
  console.log(`✅ 추첨 완료!`)
  console.log(`   신청자: ${result.draw.applicantCount}명`)
  console.log(`   당첨자: ${result.winners.count}명`)
  console.log(`   해시: ${result.draw.resultHash.substring(0, 20)}...`)
  console.log(`   TxHash: ${result.draw.txHash.substring(0, 20)}...\n`)

  // 5. 자동 결제 결과
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('5️⃣  자동 결제 결과')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  console.log(`✅ 결제 성공: ${result.payment.successCount}명`)
  console.log(`❌ 결제 실패: ${result.payment.failedCount}명\n`)

  if (result.payment.failedCount > 0) {
    console.log('실패 상세:')
    result.payment.processed
      .filter((p: any) => p.status === 'FAILED')
      .forEach((p: any) => {
        console.log(`   ${p.priority}순위 - ${p.reason}`)
      })
    console.log('')
  }

  // 6. 최종 결과 확인
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('6️⃣  최종 결과')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  const finalRound = await prisma.lotteryRound.findUnique({
    where: { id: round.id },
    include: {
      applications: {
        include: {
          user: true,
          ticket: true,
        },
        orderBy: { priority: 'asc' },
      },
    },
  })

  if (!finalRound) {
    throw new Error('Round not found')
  }

  const paidWinners = finalRound.applications.filter((app) => app.status === 'PAID')
  console.log(`💳 결제 완료 (${paidWinners.length}명):\n`)
  paidWinners.forEach((winner) => {
    console.log(`   ${String(winner.priority).padStart(2)}순위 - ${winner.user.name} - 티켓 ID: ${winner.ticket?.id.substring(0, 8)}...`)
  })

  console.log(`\n📋 전체 우선순위:\n`)
  finalRound.applications.slice(0, 10).forEach((app) => {
    let emoji = '❌'
    if (app.status === 'PAID') emoji = '💳'
    else if (app.status === 'WON') emoji = '🏆'
    else if (app.status === 'EXPIRED') emoji = '⚠️'

    console.log(`   ${emoji} ${String(app.priority).padStart(2)}순위 - ${app.user.name} (${app.status})`)
  })

  if (finalRound.applications.length > 10) {
    console.log(`   ... 외 ${finalRound.applications.length - 10}명`)
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('✨ 추첨 시스템 테스트 완료!')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
}

async function main() {
  const userCount = parseInt(process.argv[2] || '3')

  if (isNaN(userCount) || userCount < 1) {
    console.log('사용법: pnpm test:lottery [유저수]\n')
    console.log('예시:')
    console.log('  pnpm test:lottery      - 3명으로 테스트 (기본값)')
    console.log('  pnpm test:lottery 5    - 5명으로 테스트\n')
    process.exit(1)
  }

  try {
    await runFullTest(userCount)
  } catch (error) {
    console.error('\n❌ 에러:', error)
    process.exit(1)
  }
}

main().finally(async () => {
  await prisma.$disconnect()
})
