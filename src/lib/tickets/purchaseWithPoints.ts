import { prisma } from '@/lib/prisma'
import { decodeEventLog } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { getContractAddress, getPublicClient, getWalletClient } from '@/lib/blockchain'
import ticketAbiJson from '@/lib/blockchain/ticket-abi.json'
import type { Ticket } from '@prisma/client'
import { encrypt, getEncryptionKey } from '@/lib/crypto/encryption'

const ticketAbi = ticketAbiJson

// 백그라운드에서 SBT 발급
async function mintSBTInBackground(
  ticketId: string,
  walletAddress: string,
  eventId: number,
  eventPrice: number,
  pointHistoryId: string,
  userId: string
) {
  try {
    console.log(`[Background] Minting SBT for ticket ${ticketId}, user: ${walletAddress}, eventId: ${eventId}`)

    // 사용자의 공개키 조회
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { publicKey: true },
    })

    if (!user || !user.publicKey) {
      throw new Error('사용자의 공개키를 찾을 수 없습니다.')
    }

    // 공개키 암호화
    const encryptionKey = getEncryptionKey()
    const encryptedPublicKey = encrypt(user.publicKey, encryptionKey)
    console.log(`[Background] Public key encrypted for ticket ${ticketId}`)

    const contractAddress = (await getContractAddress()) as `0x${string}`
    const publicClient = getPublicClient()

    const privateKey = process.env.PRIVATE_KEY as `0x${string}` | undefined
    if (!privateKey) {
      throw new Error('PRIVATE_KEY 환경변수가 설정되지 않았습니다.')
    }

    const serverAccount = privateKeyToAccount(privateKey)
    const walletClient = getWalletClient(serverAccount)

    // encryptedPublicKey를 bytes로 변환 (Buffer -> hex string)
    const encryptedPubKeyHex = `0x${Buffer.from(encryptedPublicKey, 'base64').toString('hex')}` as `0x${string}`

    const { request: contractRequest } = await publicClient.simulateContract({
      account: serverAccount,
      address: contractAddress,
      abi: ticketAbi,
      functionName: 'mint',
      args: [walletAddress as `0x${string}`, BigInt(eventId), encryptedPubKeyHex],
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

    // DB에 txHash, tokenId, encryptedPublicKey 업데이트
    await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        txHash: mintReceipt.transactionHash,
        tokenId,
        encryptedPublicKey, // DB에도 암호화된 공개키 저장
      },
    })

    console.log(`[Background] SBT minted successfully for ticket ${ticketId}. TokenId: ${tokenId}, TxHash: ${mintReceipt.transactionHash}`)
  } catch (error) {
    console.error(`[Background] Failed to mint SBT for ticket ${ticketId}:`, error)

    // 티켓은 유지하고 에러만 로깅 (관리자가 수동으로 처리하거나 재시도 필요)
    // 추첨 시스템의 경우 티켓을 삭제하면 안 되므로 롤백하지 않음
    console.error(`[Background] Ticket ${ticketId} created but SBT minting failed. Manual intervention required.`)
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
  eventId: string | number
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
  const numericEventId = typeof eventId === 'string' ? parseInt(eventId, 10) : eventId

  if (isNaN(numericEventId)) {
    throw new PurchaseTicketError('INVALID_EVENT_ID', '잘못된 이벤트 ID입니다.')
  }

  const event = await prisma.event.findUnique({
    where: { id: numericEventId },
  })

  if (!event) {
    throw new PurchaseTicketError('EVENT_NOT_FOUND', '이벤트를 찾을 수 없습니다.')
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
  // 트랜잭션 내에서 티켓 수 체크 (race condition 방지)
  const [updatedUser, pointHistory, ticket, ticketCount] = await prisma.$transaction(async (tx) => {
    // 트랜잭션 내에서 티켓 수 확인
    const currentTicketCount = await tx.ticket.count({
      where: { eventId: event.id },
    })

    if (currentTicketCount >= event.ticketCount) {
      throw new PurchaseTicketError('SOLD_OUT', '티켓이 매진되었습니다.')
    }

    const updatedUser = await tx.user.update({
      where: { id: user.id },
      data: {
        pointBalance: {
          decrement: event.price,
        },
      },
    })

    const pointHistory = await tx.pointHistory.create({
      data: {
        userId: user.id,
        amount: -event.price,
        type: 'USE',
        description: pointDescription,
      },
    })

    const ticket = await tx.ticket.create({
      data: {
        eventId: event.id,
        userId: user.id,
        tokenId: null,
        txHash: null,
        ...(applicationId ? { applicationId } : {}),
      },
    })

    return [updatedUser, pointHistory, ticket, currentTicketCount + 1]
  })

  // 2. 블록체인 트랜잭션을 백그라운드에서 실행 (await 하지 않음)
  mintSBTInBackground(ticket.id, user.walletAddress, numericEventId, event.price, pointHistory.id, userId).catch((error) => {
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
