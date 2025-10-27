import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth/server'
import { privateKeyToAccount } from 'viem/accounts'
import { getLotteryContractAddress, getPublicClient, getWalletClient } from '@/lib/blockchain'
import lotteryAbiJson from '@/lib/blockchain/lottery-abi.json'
import type { Account, PublicClient, WalletClient } from 'viem'

const lotteryAbi = lotteryAbiJson

// 백그라운드에서 블록체인에 신청 제출
async function submitApplicationToBlockchain(
  applicationId: string,
  walletAddress: string,
  eventId: number,
  lotteryContractAddress: `0x${string}`,
  serverAccount: Account,
  publicClient: PublicClient,
  walletClient: WalletClient
) {
  try {
    console.log(`[Background] Submitting application ${applicationId} for user: ${walletAddress}, eventId: ${eventId}`)

    const { request: contractRequest } = await publicClient.simulateContract({
      account: serverAccount,
      address: lotteryContractAddress,
      abi: lotteryAbi,
      functionName: 'submitApplicationFor',
      args: [walletAddress as `0x${string}`, BigInt(eventId)],
    })

    const txHash = await walletClient.writeContract(contractRequest)

    // 트랜잭션 완료 대기
    await publicClient.waitForTransactionReceipt({ hash: txHash })

    // DB에 txHash 업데이트
    await prisma.lotteryApplication.update({
      where: { id: applicationId },
      data: { applicationTxHash: txHash },
    })

    console.log(`[Background] Application ${applicationId} submitted successfully. TxHash: ${txHash}`)
  } catch (error) {
    console.error(`[Background] Failed to submit application ${applicationId} to blockchain:`, error)
    // 실패 시 별도 처리 가능 (예: 재시도, 알림 등)
  }
}

export async function POST(request: NextRequest) {
  try {
    // 1. 유저 인증 확인
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!user.walletAddress) {
      return NextResponse.json(
        { error: '지갑 주소가 등록되지 않았습니다.' },
        { status: 400 }
      )
    }

    // 2. 요청 body 파싱
    const body = await request.json()
    const { roundId } = body

    if (!roundId) {
      return NextResponse.json(
        { error: 'roundId가 필요합니다.' },
        { status: 400 }
      )
    }

    // 3. LotteryRound 조회 및 유효성 검증
    const round = await prisma.lotteryRound.findUnique({
      where: { id: roundId },
      include: {
        event: true,
      },
    })

    if (!round) {
      return NextResponse.json(
        { error: '라운드를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    if (round.status !== 'OPEN') {
      return NextResponse.json(
        { error: '추첨 신청이 마감되었습니다.' },
        { status: 400 }
      )
    }

    const now = new Date()
    if (round.applicationDeadline <= now) {
      return NextResponse.json(
        { error: '신청 마감 시간이 지났습니다.' },
        { status: 400 }
      )
    }

    // 4. 중복 신청 체크
    const existingApplication = await prisma.lotteryApplication.findUnique({
      where: {
        roundId_userId: {
          roundId: round.id,
          userId: user.id,
        },
      },
    })

    if (existingApplication) {
      return NextResponse.json(
        { error: '이미 신청하셨습니다.' },
        { status: 400 }
      )
    }

    // 5. 블록체인 호출 준비
    const privateKey = process.env.PRIVATE_KEY as `0x${string}` | undefined
    if (!privateKey) {
      return NextResponse.json(
        { error: '서버 설정 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    const lotteryContractAddress = (await getLotteryContractAddress()) as `0x${string}`
    console.log('[Lottery] using contract', lotteryContractAddress)
    const publicClient = getPublicClient()
    const serverAccount = privateKeyToAccount(privateKey)
    const walletClient = getWalletClient(serverAccount)

    // 6. 블록체인 lottery 존재 여부 확인 및 생성
    try {
      console.log(`Checking if lottery exists for eventId: ${round.eventId}`)

      // 6-1. getLottery(eventId)로 lottery 존재 여부 확인
      const lottery = await publicClient.readContract({
        address: lotteryContractAddress,
        abi: lotteryAbi,
        functionName: 'getLottery',
        args: [BigInt(round.eventId)],
      }) as [bigint, bigint, string]

      // lottery[0]은 deadline, 0이면 lottery가 생성되지 않은 것
      if (lottery[0] === 0n) {
        console.log(`Lottery not found. Creating lottery for eventId: ${round.eventId}`)

        // 6-2. createLottery(eventId, deadline) 호출
        const deadlineTimestamp = BigInt(Math.floor(round.applicationDeadline.getTime() / 1000))

        const { request: createRequest } = await publicClient.simulateContract({
          account: serverAccount,
          address: lotteryContractAddress,
          abi: lotteryAbi,
          functionName: 'createLottery',
          args: [BigInt(round.eventId), deadlineTimestamp],
        })

        const createTxHash = await walletClient.writeContract(createRequest)
        await publicClient.waitForTransactionReceipt({ hash: createTxHash })

        console.log(`Lottery created successfully. TxHash: ${createTxHash}`)
      } else {
        console.log(`Lottery already exists for eventId: ${round.eventId}`)
      }
    } catch (error) {
      console.error('Lottery creation check/creation error:', error)
      return NextResponse.json(
        { error: '블록체인 lottery 생성에 실패했습니다.' },
        { status: 500 }
      )
    }

    // 7. DB에 LotteryApplication 먼저 저장 (txHash는 null)
    const application = await prisma.lotteryApplication.create({
      data: {
        roundId: round.id,
        userId: user.id,
        walletAddress: user.walletAddress,
        applicationTxHash: null,
        status: 'APPLIED',
        paymentStatus: 'PENDING',
      },
    })

    // 8. 즉시 응답 반환 (유저는 대기하지 않음)
    const response = NextResponse.json({
      success: true,
      application: {
        id: application.id,
        roundId: application.roundId,
        status: application.status,
      },
    })

    // 9. 블록체인 트랜잭션을 백그라운드에서 실행 (await 하지 않음)
    submitApplicationToBlockchain(
      application.id,
      user.walletAddress,
      round.eventId,
      lotteryContractAddress,
      serverAccount,
      publicClient,
      walletClient
    ).catch((error) => {
      console.error(`Background blockchain submission failed for application ${application.id}:`, error)
    })

    return response
  } catch (error) {
    console.error('Lottery application error:', error)
    return NextResponse.json(
      { error: '추첨 신청 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
