import { runLotteryTest, cleanupLotteryTestResources } from './lotteryTestRunner'

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
    await runLotteryTest(userCount)
  } catch (error) {
    console.error('\n❌ 에러:', error)
    process.exit(1)
  }
}

main().finally(async () => {
  await cleanupLotteryTestResources()
})
