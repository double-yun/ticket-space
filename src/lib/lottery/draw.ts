import { prisma } from '@/lib/prisma'
import { privateKeyToAccount } from 'viem/accounts'
import { getLotteryContractAddress, getPublicClient, getWalletClient } from '@/lib/blockchain'
import lotteryAbiJson from '@/lib/blockchain/lottery-abi.json'
import { keccak256, encodeAbiParameters } from 'viem'
import { purchaseTicketWithPoints, PurchaseTicketError } from '@/lib/tickets/purchaseWithPoints'

const lotteryAbi = lotteryAbiJson

/**
 * Fisher-Yates shuffle algorithm for fair random shuffling
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

/**
 * 추첨 실행 함수
 * @param roundId - 추첨할 라운드 ID
 * @returns 추첨 성공 여부 및 결과
 */
type ExecuteDrawOptions = {
  force?: boolean
}

export async function executeDraw(roundId: string, options?: ExecuteDrawOptions) {
  try {
    console.log(`[Draw] Starting draw for roundId: ${roundId}`)

    // 1. 라운드 조회 및 검증
    const round = await prisma.lotteryRound.findUnique({
      where: { id: roundId },
      include: {
        event: true,
        applications: {
          include: {
            user: true,
          },
        },
      },
    })

    if (!round) {
      throw new Error(`Round not found: ${roundId}`)
    }

    if (round.status === 'DRAWN') {
      throw new Error('Draw has already been completed for this round')
    }

    if (round.status !== 'CLOSED') {
      throw new Error(`Round is not closed. Current status: ${round.status}`)
    }

    // 마감 시간 확인
    const now = new Date()
    if (!options?.force && now <= round.applicationDeadline) {
      throw new Error('Application deadline has not passed yet')
    }

    // 2. 블록체인 설정
    const privateKey = process.env.PRIVATE_KEY as `0x${string}` | undefined
    if (!privateKey) {
      throw new Error('PRIVATE_KEY not configured')
    }

    const lotteryContractAddress = (await getLotteryContractAddress()) as `0x${string}`
    const publicClient = getPublicClient()
    const serverAccount = privateKeyToAccount(privateKey)
    const walletClient = getWalletClient(serverAccount)

    // 3. 온체인에서 신청자 목록 가져오기
    console.log(`[Draw] Fetching applicants from blockchain for eventId: ${round.eventId}`)
    const applicants = (await publicClient.readContract({
      address: lotteryContractAddress,
      abi: lotteryAbi,
      functionName: 'getApplicants',
      args: [BigInt(round.eventId)],
    })) as `0x${string}`[]

    console.log(`[Draw] Found ${applicants.length} applicants on blockchain`)

    if (applicants.length === 0) {
      throw new Error('No applicants found on blockchain')
    }

    // 4. DB 신청자와 매칭 확인
    const dbApplicationsByAddress = new Map(
      round.applications.map((app) => [app.walletAddress?.toLowerCase(), app])
    )

    const matchedApplicants = applicants.filter((addr) =>
      dbApplicationsByAddress.has(addr.toLowerCase())
    )

    if (matchedApplicants.length === 0) {
      throw new Error('No matching applicants found between blockchain and DB')
    }

    console.log(`[Draw] Matched ${matchedApplicants.length} applicants with DB`)

    // 5. 공정한 셔플로 우선순위 부여
    const shuffledApplicants = shuffleArray(matchedApplicants)

    // 6. DB에 우선순위 저장
    console.log(`[Draw] Updating priorities in DB`)
    await prisma.$transaction(
      shuffledApplicants.map((address, index) => {
        const application = dbApplicationsByAddress.get(address.toLowerCase())!
        return prisma.lotteryApplication.update({
          where: { id: application.id },
          data: {
            priority: index + 1, // 1부터 시작
          },
        })
      })
    )

    // 7. 추첨 결과 해시 계산
    // 결과 리스트: [address1, address2, ...] 순서대로
    console.log(`[Draw] Computing result hash`)
    const resultHash = keccak256(
      encodeAbiParameters(
        [{ type: 'address[]' }],
        [shuffledApplicants]
      )
    )

    console.log(`[Draw] Result hash: ${resultHash}`)

    // 8. 온체인에 해시값 기록
    console.log(`[Draw] Recording result hash on blockchain`)
    const { request: setResultRequest } = await publicClient.simulateContract({
      account: serverAccount,
      address: lotteryContractAddress,
      abi: lotteryAbi,
      functionName: 'setDrawResult',
      args: [BigInt(round.eventId), resultHash],
    })

    const txHash = await walletClient.writeContract(setResultRequest)
    await publicClient.waitForTransactionReceipt({ hash: txHash })

    console.log(`[Draw] Result hash recorded on blockchain. TxHash: ${txHash}`)

    // 9. 라운드 상태 업데이트
    const updatedRound = await prisma.lotteryRound.update({
      where: { id: roundId },
      data: {
        status: 'DRAWN',
        resultHash: resultHash,
        drawnAt: new Date(),
      },
    })

    console.log(`[Draw] Draw completed successfully for roundId: ${roundId}`)

    return {
      success: true,
      roundId: updatedRound.id,
      applicantCount: shuffledApplicants.length,
      resultHash: resultHash,
      txHash: txHash,
    }
  } catch (error) {
    console.error(`[Draw] Error executing draw for roundId ${roundId}:`, error)
    throw error
  }
}

/**
 * 당첨자 상태를 WON으로 업데이트
 * @param roundId - 라운드 ID
 * @param winnerCount - 당첨자 수 (티켓 수량)
 */
export async function markWinners(roundId: string, winnerCount: number) {
  try {
    console.log(`[Draw] Marking winners for roundId: ${roundId}, count: ${winnerCount}`)

    const round = await prisma.lotteryRound.findUnique({
      where: { id: roundId },
      include: {
        event: true,
      },
    })

    if (!round) {
      throw new Error(`Round not found: ${roundId}`)
    }

    if (round.status !== 'DRAWN') {
      throw new Error(`Round has not been drawn yet. Current status: ${round.status}`)
    }

    // 우선순위 순으로 당첨자 선정 (1~winnerCount)
    const winners = await prisma.lotteryApplication.findMany({
      where: {
        roundId: roundId,
        priority: {
          lte: winnerCount,
          not: null,
        },
      },
      orderBy: {
        priority: 'asc',
      },
    })

    if (winners.length === 0) {
      throw new Error('No winners found with assigned priorities')
    }

    console.log(`[Draw] Found ${winners.length} winners`)

    // 당첨자 상태를 WON으로 업데이트
    await prisma.$transaction(
      winners.map((winner) =>
        prisma.lotteryApplication.update({
          where: { id: winner.id },
          data: {
            status: 'WON',
            pointAmount: round.event.price,
            // paymentDeadline은 자동 결제 시스템에서 처리
          },
        })
      )
    )

    console.log(`[Draw] Successfully marked ${winners.length} winners as WON`)

    return {
      success: true,
      winnerCount: winners.length,
      winners: winners.map((w) => ({
        id: w.id,
        priority: w.priority,
        userId: w.userId,
      })),
    }
  } catch (error) {
    console.error(`[Draw] Error marking winners for roundId ${roundId}:`, error)
    throw error
  }
}

/**
 * 당첨자 자동 결제 실행
 * @param roundId - 라운드 ID
 */
export async function processAutoPayment(roundId: string) {
  try {
    console.log(`[Draw] Processing auto payment for roundId: ${roundId}`)

    const round = await prisma.lotteryRound.findUnique({
      where: { id: roundId },
      include: {
        event: true,
        applications: {
          where: {
            status: 'WON',
            priority: { not: null },
          },
          include: { user: true },
          orderBy: { priority: 'asc' },
        },
      },
    })

    if (!round) {
      throw new Error(`Round not found: ${roundId}`)
    }

    if (round.status !== 'DRAWN') {
      throw new Error(`Round is not in DRAWN status: ${round.status}`)
    }

    const processed: Array<{
      applicationId: string
      userId: string
      priority: number
      status: 'PAID' | 'FAILED'
      reason?: string
      ticketId?: string
    }> = []

    // 당첨자 순서대로 자동 결제
    for (const application of round.applications) {
      if (!application.user?.walletAddress) {
        await prisma.lotteryApplication.update({
          where: { id: application.id },
          data: {
            paymentStatus: 'FAILED',
            status: 'EXPIRED',
          },
        })
        processed.push({
          applicationId: application.id,
          userId: application.userId,
          priority: application.priority!,
          status: 'FAILED',
          reason: 'WALLET_NOT_FOUND',
        })
        continue
      }

      try {
        const purchaseResult = await purchaseTicketWithPoints({
          eventId: round.eventId,
          userId: application.userId,
          applicationId: application.id,
          description: `티켓 추첨 자동결제: ${round.event.title}`,
        })

        await prisma.lotteryApplication.update({
          where: { id: application.id },
          data: {
            status: 'PAID',
            paymentStatus: 'PAID',
            pointAmount: round.event.price,
          },
        })

        processed.push({
          applicationId: application.id,
          userId: application.userId,
          priority: application.priority!,
          status: 'PAID',
          ticketId: purchaseResult.ticket.id,
        })

        console.log(
          `[Draw] Auto payment success - Priority ${application.priority}, User: ${application.userId}`
        )

        // 각 결제 후 1초 대기 (nonce 충돌 방지)
        await new Promise((resolve) => setTimeout(resolve, 1000))
      } catch (error) {
        if (error instanceof PurchaseTicketError) {
          await prisma.lotteryApplication.update({
            where: { id: application.id },
            data: {
              paymentStatus: 'FAILED',
              status: 'EXPIRED',
            },
          })

          processed.push({
            applicationId: application.id,
            userId: application.userId,
            priority: application.priority!,
            status: 'FAILED',
            reason: error.code,
          })

          console.error(
            `[Draw] Auto payment failed - Priority ${application.priority}: ${error.code}`
          )
        } else {
          throw error
        }
      }
    }

    console.log(`[Draw] Auto payment completed - Success: ${processed.filter((p) => p.status === 'PAID').length}, Failed: ${processed.filter((p) => p.status === 'FAILED').length}`)

    return {
      success: true,
      processed,
    }
  } catch (error) {
    console.error(`[Draw] Error processing auto payment for roundId ${roundId}:`, error)
    throw error
  }
}

/**
 * 자동 추첨 실행 (마감 후 일정 시간 경과 시)
 * @param roundId - 라운드 ID
 * @param delayMinutes - 마감 후 지연 시간 (분)
 */
export async function autoDrawAfterDeadline(roundId: string, delayMinutes: number = 5) {
  try {
    const round = await prisma.lotteryRound.findUnique({
      where: { id: roundId },
      include: {
        event: true,
      },
    })

    if (!round) {
      throw new Error(`Round not found: ${roundId}`)
    }

    const now = new Date()
    const drawTime = new Date(round.applicationDeadline.getTime() + delayMinutes * 60 * 1000)

    if (now < drawTime) {
      throw new Error(
        `Not yet time to draw. Draw time: ${drawTime.toISOString()}, Current time: ${now.toISOString()}`
      )
    }

    // 라운드 상태를 CLOSED로 변경 (아직 OPEN이면)
    if (round.status === 'OPEN') {
      await prisma.lotteryRound.update({
        where: { id: roundId },
        data: { status: 'CLOSED' },
      })
    }

    // 추첨 실행
    const drawResult = await executeDraw(roundId)

    // 당첨자 마킹 (이벤트의 티켓 수량만큼)
    const winnerResult = await markWinners(roundId, round.event.ticketCount)

    return {
      success: true,
      draw: drawResult,
      winners: winnerResult,
    }
  } catch (error) {
    console.error(`[Draw] Error in autoDrawAfterDeadline for roundId ${roundId}:`, error)
    throw error
  }
}
