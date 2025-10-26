import { runLotteryTest, cleanupLotteryTestResources } from './lotteryTestRunner'

async function main() {
  try {
    await runLotteryTest(2, {
      ticketCount: 3,
      scenarioName: '유저2 / 티켓3',
    })
  } catch (error) {
    console.error('\n❌ 티켓 여유 테스트 실패:', error)
    process.exit(1)
  }
}

main().finally(async () => {
  await cleanupLotteryTestResources()
})
