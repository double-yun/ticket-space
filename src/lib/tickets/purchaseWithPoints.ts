import { prisma } from '@/lib/prisma'
import { decodeEventLog } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { getContractAddress, getPublicClient, getWalletClient } from '@/lib/blockchain'
import ticketAbiJson from '@/lib/blockchain/ticket-abi.json'
import type { Ticket } from '@prisma/client'

const ticketAbi = ticketAbiJson as const

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
        description: pointDescription,
      },
    }),
  ])

  const contractAddress = (await getContractAddress()) as `0x${string}`
  const publicClient = getPublicClient()

  const privateKey = process.env.PRIVATE_KEY as `0x${string}` | undefined
  if (!privateKey) {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { pointBalance: { increment: event.price } },
      }),
      prisma.pointHistory.delete({
        where: { id: pointHistory.id },
      }),
    ])
    throw new PurchaseTicketError(
      'PRIVATE_KEY_MISSING',
      'PRIVATE_KEY 환경변수가 설정되지 않았습니다.'
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
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { pointBalance: { increment: event.price } },
      }),
      prisma.pointHistory.delete({
        where: { id: pointHistory.id },
      }),
    ])
    throw new PurchaseTicketError('SBT_MINT_FAILED', 'SBT 발급에 실패했습니다.')
  }

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
    throw new PurchaseTicketError('TOKEN_ID_MISSING', 'SBT가 발급되었으나 TokenId를 찾을 수 없습니다.')
  }

  const ticketData: Parameters<typeof prisma.ticket.create>[0]['data'] = {
    eventId: event.id,
    userId: user.id,
    tokenId,
    txHash: mintReceipt.transactionHash,
  }

  if (applicationId) {
    ticketData.applicationId = applicationId
  }

  const ticket = await prisma.ticket.create({
    data: ticketData,
  })

  return {
    ticket,
    transactionHash: mintReceipt.transactionHash,
    tokenId,
    blockNumber: mintReceipt.blockNumber,
    pointBalance: updatedUser.pointBalance,
    event: {
      id: event.id,
      title: event.title,
      price: event.price,
    },
  }
}
