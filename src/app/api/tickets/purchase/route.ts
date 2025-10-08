import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { decodeEventLog } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { prisma } from '@/lib/prisma'
import { getContractAddress, getPublicClient, getWalletClient } from '@/lib/blockchain'
import ticketAbiJson from '@/lib/blockchain/ticket-abi.json'

const ticketAbi = ticketAbiJson as const

export async function POST(request: NextRequest) {
  try {
    const { eventId } = await request.json()

    if (!eventId) {
      return NextResponse.json({ error: '이벤트 ID가 필요합니다.' }, { status: 400 })
    }

    // 세션 확인
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session_token')?.value

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const session = await prisma.session.findUnique({
      where: { sessionToken },
      include: { user: true },
    })

    if (!session || session.expires < new Date()) {
      return NextResponse.json({ error: 'Session expired' }, { status: 401 })
    }

    const user = session.user

    if (!user.walletAddress) {
      return NextResponse.json({ error: '사용자 지갑 정보를 찾을 수 없습니다.' }, { status: 400 })
    }

    // Event 조회
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        _count: {
          select: { tickets: true },
        },
      },
    })

    if (!event) {
      return NextResponse.json({ error: '이벤트를 찾을 수 없습니다.' }, { status: 404 })
    }

    // 티켓 매진 확인
    if (event._count.tickets >= event.ticketCount) {
      return NextResponse.json({ error: '티켓이 매진되었습니다.' }, { status: 400 })
    }

    // 포인트 잔액 확인
    if (user.pointBalance < event.price) {
      return NextResponse.json(
        { error: `포인트가 부족합니다. 필요: ${event.price}P, 보유: ${user.pointBalance}P` },
        { status: 400 }
      )
    }

    // 트랜잭션 시작: 포인트 차감 + 히스토리 기록
    const [updatedUser, pointHistory] = await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          pointBalance: {
            decrement: event.price,
          },
        },
      }),
      prisma.pointHistory.create({
        data: {
          userId: user.id,
          amount: -event.price,
          type: 'USE',
          description: `티켓 구매: ${event.title}`,
        },
      }),
    ])

    // SBT Mint
    const contractAddress = (await getContractAddress()) as `0x${string}`
    const publicClient = getPublicClient()

    const privateKey = process.env.PRIVATE_KEY as `0x${string}` | undefined
    if (!privateKey) {
      // 포인트 롤백
      await prisma.$transaction([
        prisma.user.update({
          where: { id: user.id },
          data: { pointBalance: { increment: event.price } },
        }),
        prisma.pointHistory.delete({
          where: { id: pointHistory.id },
        }),
      ])
      return NextResponse.json(
        { error: 'PRIVATE_KEY 환경변수가 설정되지 않았습니다.' },
        { status: 500 }
      )
    }

    const serverAccount = privateKeyToAccount(privateKey)
    const walletClient = getWalletClient(serverAccount)

    let mintReceipt
    try {
      const { request: contractRequest } = await publicClient.simulateContract({
        account: serverAccount,
        address: contractAddress,
        abi: ticketAbi,
        functionName: 'mint',
        args: [user.walletAddress as `0x${string}`, BigInt(eventId)],
      })

      const hash = await walletClient.writeContract(contractRequest)
      mintReceipt = await publicClient.waitForTransactionReceipt({ hash })
    } catch (error) {
      console.error('SBT mint failed:', error)

      // 포인트 롤백
      await prisma.$transaction([
        prisma.user.update({
          where: { id: user.id },
          data: { pointBalance: { increment: event.price } },
        }),
        prisma.pointHistory.delete({
          where: { id: pointHistory.id },
        }),
      ])

      return NextResponse.json(
        { error: 'SBT 발급에 실패했습니다. 포인트가 환불되었습니다.' },
        { status: 500 }
      )
    }

    // Transfer 이벤트에서 tokenId 추출
    let tokenId: bigint | null = null
    for (const log of mintReceipt.logs) {
      try {
        const decoded = decodeEventLog({
          abi: ticketAbi,
          data: log.data,
          topics: log.topics,
        })

        if (decoded.eventName === 'Transfer' && typeof decoded.args?.tokenId === 'bigint') {
          tokenId = decoded.args.tokenId
          break
        }
      } catch {
        // Ignore logs that do not match
      }
    }

    if (!tokenId) {
      console.error('TokenId not found in mint receipt')
      return NextResponse.json(
        { error: 'SBT가 발급되었으나 TokenId를 찾을 수 없습니다.' },
        { status: 500 }
      )
    }

    // Ticket 생성 (직접 구매, lottery application 없음)
    const ticket = await prisma.ticket.create({
      data: {
        eventId: event.id,
        userId: user.id,
        tokenId: tokenId,
        txHash: mintReceipt.transactionHash,
      },
    })

    return NextResponse.json({
      success: true,
      ticket: {
        id: ticket.id,
        transactionHash: mintReceipt.transactionHash,
        tokenId: tokenId.toString(),
        blockNumber: mintReceipt.blockNumber.toString(),
        event: {
          id: event.id,
          title: event.title,
          price: event.price,
        },
      },
      user: {
        pointBalance: updatedUser.pointBalance,
      },
    })
  } catch (error) {
    console.error('Purchase error:', error)
    const message = error instanceof Error ? error.message : 'Purchase failed'
    return NextResponse.json({ error: `Purchase failed: ${message}` }, { status: 500 })
  }
}
