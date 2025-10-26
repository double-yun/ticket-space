import { runLotteryTest, cleanupLotteryTestResources } from './lotteryTestRunner'

async function main() {
  try {
    await runLotteryTest(2, {
      ticketCount: 2,
      scenarioName: '포인트 부족 사용자 포함',
      pointBalanceStrategy: (index) => (index === 1 ? 5000 : 50000),
    })
  } catch (error) {
    console.error('\n❌ 포인트 부족 테스트 실패:', error)
    process.exit(1)
  }
}

main().finally(async () => {
  await cleanupLotteryTestResources()
})
