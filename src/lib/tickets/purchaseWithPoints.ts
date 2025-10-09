import { prisma } from '@/lib/prisma'
import { decodeEventLog } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { getContractAddress, getPublicClient, getWalletClient } from '@/lib/blockchain'
import ticketAbiJson from '@/lib/blockchain/ticket-abi.json'
import type { Ticket } from '@prisma/client'

const ticketAbi = ticketAbiJson as const

// 백그라운드에서 SBT 발급
async function mintSBTInBackground(
  ticketId: string,
  walletAddress: string,
  eventId: number,
  eventPrice: number,
  pointHistoryId: string
) {
  try {
    console.log(`[Background] Minting SBT for ticket ${ticketId}, user: ${walletAddress}, eventId: ${eventId}`)

    const contractAddress = (await getContractAddress()) as `0x${string}`
    const publicClient = getPublicClient()

    const privateKey = process.env.PRIVATE_KEY as `0x${string}` | undefined
    if (!privateKey) {
      throw new Error('PRIVATE_KEY 환경변수가 설정되지 않았습니다.')
    }

    const serverAccount = privateKeyToAccount(privateKey)
    const walletClient = getWalletClient(serverAccount)

    const { request: contractRequest } = await publicClient.simulateContract({
      account: serverAccount,
      address: contractAddress,
      abi: ticketAbi,
      functionName: 'mint',
      args: [walletAddress as `0x${string}`, BigInt(eventId)],
    })

    const hash = await walletClient.writeContract(contractRequest)
    const mintReceipt = await publicClient.waitForTransactionReceipt({ hash })

    // tokenId 추출
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
      throw new Error('SBT가 발급되었으나 TokenId를 찾을 수 없습니다.')
    }

    // DB에 txHash와 tokenId 업데이트
    await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        txHash: mintReceipt.transactionHash,
        tokenId,
      },
    })

    console.log(`[Background] SBT minted successfully for ticket ${ticketId}. TokenId: ${tokenId}, TxHash: ${mintReceipt.transactionHash}`)
  } catch (error) {
    console.error(`[Background] Failed to mint SBT for ticket ${ticketId}:`, error)

    // 실패 시 포인트 환불 및 티켓 삭제
    try {
      const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } })
      if (ticket) {
        await prisma.$transaction([
          prisma.ticket.delete({
            where: { id: ticketId },
          }),
          prisma.user.update({
            where: { id: ticket.userId },
            data: { pointBalance: { increment: eventPrice } },
          }),
          prisma.pointHistory.delete({
            where: { id: pointHistoryId },
          }),
        ])
        console.log(`[Background] Refunded points and deleted ticket ${ticketId} due to SBT minting failure`)
      }
    } catch (rollbackError) {
      console.error(`[Background] Failed to rollback ticket ${ticketId}:`, rollbackError)
    }
  }
}

export type PurchaseTicketResult = {
  ticket: Ticket
  transactionHash: `0x${string}`
  tokenId: bigint
  blockNumber: bigint
  pointBalance: number
  event: {
    id: number
    title: string
    price: number
  }
}

export class PurchaseTicketError extends Error {
  code: string

  constructor(code: string, message?: string) {
    super(message ?? code)
    this.code = code
  }
}

type PurchaseOptions = {
  eventId: number
  userId: string
  applicationId?: string
  description?: string
}

export async function purchaseTicketWithPoints({
  eventId,
  userId,
  applicationId,
  description,
}: PurchaseOptions): Promise<PurchaseTicketResult> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      _count: {
        select: { tickets: true },
      },
    },
  })

  if (!event) {
    throw new PurchaseTicketError('EVENT_NOT_FOUND', '이벤트를 찾을 수 없습니다.')
  }

  if (event._count.tickets >= event.ticketCount) {
    throw new PurchaseTicketError('SOLD_OUT', '티켓이 매진되었습니다.')
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
  })

  if (!user) {
    throw new PurchaseTicketError('USER_NOT_FOUND', '사용자를 찾을 수 없습니다.')
  }

  if (!user.walletAddress) {
    throw new PurchaseTicketError('WALLET_NOT_FOUND', '사용자 지갑 정보를 찾을 수 없습니다.')
  }

  if (user.pointBalance < event.price) {
    throw new PurchaseTicketError(
      'INSUFFICIENT_POINTS',
      `포인트가 부족합니다. 필요: ${event.price}P, 보유: ${user.pointBalance}P`
    )
  }

  const pointDescription =
    description ?? (applicationId ? `티켓 추첨 자동결제: ${event.title}` : `티켓 구매: ${event.title}`)

  // 1. 포인트 차감 및 DB에 티켓 먼저 생성 (txHash, tokenId는 null)
  const [updatedUser, pointHistory, ticket] = await prisma.$transaction([
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
        description: pointDescription,
      },
    }),
    prisma.ticket.create({
      data: {
        eventId: event.id,
        userId: user.id,
        tokenId: null,
        txHash: null,
        ...(applicationId ? { applicationId } : {}),
      },
    }),
  ])

  // 2. 블록체인 트랜잭션을 백그라운드에서 실행 (await 하지 않음)
  mintSBTInBackground(ticket.id, user.walletAddress, eventId, event.price, pointHistory.id).catch((error) => {
    console.error(`Background SBT minting failed for ticket ${ticket.id}:`, error)
  })

  // 3. 즉시 응답 반환 (tokenId와 txHash는 임시로 0n과 '0x' 반환, 실제로는 나중에 업데이트됨)
  return {
    ticket,
    transactionHash: '0x' as `0x${string}`,
    tokenId: 0n,
    blockNumber: 0n,
    pointBalance: updatedUser.pointBalance,
    event: {
      id: event.id,
      title: event.title,
      price: event.price,
    },
  }
}
