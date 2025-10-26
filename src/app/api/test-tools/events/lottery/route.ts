import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { privateKeyToAccount } from 'viem/accounts'
import { getLotteryContractAddress, getPublicClient, getWalletClient } from '@/lib/blockchain'
import lotteryAbiJson from '@/lib/blockchain/lottery-abi.json'

const lotteryAbi = lotteryAbiJson

type LotteryEventPayload = {
  title?: string
  ticketCount?: number
  price?: number
  applicationDeadlineMinutes?: number
}

export async function POST(request: NextRequest) {
  let createdEventId: number | null = null
  let createdRoundId: string | null = null

  try {
    const body = (await request.json()) as LotteryEventPayload
    const title = (body.title ?? '').trim()
    const ticketCount = Number(body.ticketCount ?? 0)
    const price = Number(body.price ?? 10000)
    const applicationDeadlineMinutes = Number(body.applicationDeadlineMinutes ?? 60)

    if (!title) {
      return NextResponse.json({ success: false, error: '제목을 입력해주세요.' }, { status: 400 })
    }

    if (!Number.isFinite(ticketCount) || ticketCount < 1) {
      return NextResponse.json({ success: false, error: '티켓 수는 1 이상이어야 합니다.' }, { status: 400 })
    }

    if (!Number.isFinite(price) || price < 0) {
      return NextResponse.json({ success: false, error: '가격을 올바르게 입력해주세요.' }, { status: 400 })
    }

    if (!Number.isFinite(applicationDeadlineMinutes) || applicationDeadlineMinutes < 5) {
      return NextResponse.json({ success: false, error: '신청 마감 시간은 5분 이상이어야 합니다.' }, { status: 400 })
    }

    const applicationDeadline = new Date(Date.now() + applicationDeadlineMinutes * 60 * 1000)

    const { event, round } = await prisma.$transaction(async (tx) => {
      const createdEvent = await tx.event.create({
        data: {
          title,
          description: '테스트용 추첨 이벤트',
          ticketCount,
          price,
          saleStart: new Date(),
          deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          status: 'PUBLISHED',
        },
      })

      const createdRound = await tx.lotteryRound.create({
        data: {
          eventId: createdEvent.id,
          roundNumber: 1,
          status: 'OPEN',
          applicationDeadline,
        },
      })

      return { event: createdEvent, round: createdRound }
    })

    createdEventId = event.id
    createdRoundId = round.id

    const privateKey = process.env.PRIVATE_KEY as `0x${string}` | undefined
    if (!privateKey) {
      throw new Error('PRIVATE_KEY not configured')
    }

    const lotteryContractAddress = (await getLotteryContractAddress()) as `0x${string}`
    const publicClient = getPublicClient()
    const serverAccount = privateKeyToAccount(privateKey)
    const walletClient = getWalletClient(serverAccount)

    const deadlineTimestamp = BigInt(Math.floor(applicationDeadline.getTime() / 1000))
    const { request: simulation } = await publicClient.simulateContract({
      account: serverAccount,
      address: lotteryContractAddress,
      abi: lotteryAbi,
      functionName: 'createLottery',
      args: [BigInt(event.id), deadlineTimestamp],
    })

    const txHash = await walletClient.writeContract(simulation)
    await publicClient.waitForTransactionReceipt({ hash: txHash })

    return NextResponse.json({
      success: true,
      event,
      round,
      txHash,
    })
  } catch (error) {
    console.error('[TestTools] Lottery event creation failed:', error)

    if (createdRoundId) {
      await prisma.lotteryRound.delete({ where: { id: createdRoundId } }).catch(() => null)
    }

    if (createdEventId) {
      await prisma.event.delete({ where: { id: createdEventId } }).catch(() => null)
    }

    return NextResponse.json(
      { success: false, error: '추첨 이벤트 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
