import { runLotteryTest, cleanupLotteryTestResources } from './lotteryTestRunner'

async function main() {
  try {
    await runLotteryTest(2, {
      ticketCount: 1,
      scenarioName: '유저2 / 티켓1',
    })
  } catch (error) {
    console.error('\n❌ 티켓 부족 테스트 실패:', error)
    process.exit(1)
  }
}

main().finally(async () => {
  await cleanupLotteryTestResources()
})
