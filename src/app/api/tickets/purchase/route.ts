import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { decodeEventLog, encodeFunctionData } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { prisma } from '@/lib/prisma'
import {
  getChainId,
  getContractAddress,
  getPublicClient,
  getWalletClient,
} from '@/lib/blockchain'
import {
  getAlchemySmartAccountClient,
  getSmartAccountAddress,
  isAlchemySmartWalletEnabled,
} from '@/lib/blockchain/alchemy-smart-wallet'
import { ticketAbi } from '@/lib/blockchain/ticket-abi'

const SEPOLIA_CHAIN_ID = 11155111

export async function POST(request: NextRequest) {
  try {
    const { ticketId } = await request.json()

    if (!ticketId) {
      return NextResponse.json({ error: '티켓 ID가 필요합니다.' }, { status: 400 })
    }

    const contractAddress = await getContractAddress()

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

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
    })

    if (!ticket) {
      return NextResponse.json({ error: '티켓을 찾을 수 없습니다.' }, { status: 404 })
    }

    if (ticket.currentSupply >= ticket.maxSupply) {
      return NextResponse.json({ error: '티켓이 매진되었습니다.' }, { status: 400 })
    }

    const user = session.user

    if (!user.walletAddress) {
      return NextResponse.json({ error: '사용자 지갑 정보를 찾을 수 없습니다.' }, { status: 400 })
    }

    const publicClient = getPublicClient()
    const chainId = getChainId()

    const ticketPrice = BigInt(ticket.price)

    const encodedMintData = encodeFunctionData({
      abi: ticketAbi,
      functionName: 'mint',
      args: [user.walletAddress as `0x${string}`],
    })

    let contractOwner: `0x${string}`
    try {
      contractOwner = (await publicClient.readContract({
        address: contractAddress as `0x${string}`,
        abi: ticketAbi,
        functionName: 'owner',
      })) as `0x${string}`
    } catch (error) {
      console.error('Failed to read ticket contract owner.', error)
      return NextResponse.json(
        { error: '티켓 컨트랙트 소유자 정보를 확인할 수 없습니다. 배포 상태를 점검해주세요.' },
        { status: 500 },
      )
    }

    const shouldAttemptSmartWallet = chainId === SEPOLIA_CHAIN_ID && isAlchemySmartWalletEnabled()
    let useSmartWallet = false

    if (shouldAttemptSmartWallet) {
      try {
        const smartAccountAddress = await getSmartAccountAddress()
        if (smartAccountAddress && smartAccountAddress.toLowerCase() === contractOwner.toLowerCase()) {
          useSmartWallet = true
        } else {
          console.warn(
            `Smart wallet ${smartAccountAddress ?? 'unknown'} is not the contract owner ${contractOwner}. Falling back to server wallet.`,
          )
        }
      } catch (error) {
        console.warn('Failed to verify smart wallet ownership. Falling back to server wallet.', error)
      }
    }

    let paymentReceipt:
      | { transactionHash: `0x${string}`; blockNumber: bigint }
      | undefined

    const defaultPrivateKey =
      (process.env.PRIVATE_KEY as `0x${string}` | undefined) ??
      ('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as `0x${string}`)

    const serverAccount = privateKeyToAccount(defaultPrivateKey)
    const serverWalletClient = getWalletClient(serverAccount)

    try {
      const paymentHash = await serverWalletClient.sendTransaction({
        to: contractOwner,
        value: ticketPrice,
      })

      paymentReceipt = await publicClient.waitForTransactionReceipt({ hash: paymentHash })
    } catch (error) {
      console.error('Server wallet failed to transfer ticket price on behalf of user.', error)
      return NextResponse.json(
        { error: '서버 지갑에서 결제에 실패했습니다. 관리자에게 문의해주세요.' },
        { status: 500 },
      )
    }

    let mintReceipt:
      | {
          transactionHash: `0x${string}`
          blockNumber: bigint
          logs: readonly {
            data: `0x${string}`
            topics: readonly `0x${string}`[]
          }[]
        }
      | undefined

    if (useSmartWallet) {
      const smartAccountClient = await getAlchemySmartAccountClient()
      const { hash: userOpHash } = await smartAccountClient.sendUserOperation({
        uo: {
          target: contractAddress as `0x${string}`,
          data: encodedMintData,
        },
      })

      const onChainHash = await smartAccountClient.waitForUserOperationTransaction({ hash: userOpHash })
      mintReceipt = await publicClient.waitForTransactionReceipt({ hash: onChainHash })
    } else {
      const defaultPrivateKey =
        (process.env.PRIVATE_KEY as `0x${string}` | undefined) ??
        ('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as `0x${string}`)

      const serverAccount = privateKeyToAccount(defaultPrivateKey)
      const walletClient = getWalletClient(serverAccount)

      if (contractOwner.toLowerCase() !== serverAccount.address.toLowerCase()) {
        console.error(
          `Server wallet ${serverAccount.address} is not the ticket contract owner ${contractOwner}. Cannot execute mint.`,
        )
        return NextResponse.json(
          {
            error:
              '서버 지갑이 티켓 컨트랙트의 소유자가 아닙니다. PRIVATE_KEY 환경변수를 소유자 키로 설정하거나 소유권을 이전해주세요.',
          },
          { status: 500 },
        )
      }

      const { request: contractRequest } = await publicClient.simulateContract({
        account: serverAccount,
        address: contractAddress as `0x${string}`,
        abi: ticketAbi,
        functionName: 'mint',
        args: [user.walletAddress as `0x${string}`],
      })

      const hash = await walletClient.writeContract(contractRequest)
      mintReceipt = await publicClient.waitForTransactionReceipt({ hash })
    }

    if (!mintReceipt) {
      throw new Error('Mint transaction receipt is missing.')
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
        // Ignore logs that do not match the Ticket ABI events
      }
    }

    if (!tokenId) {
      throw new Error('Mint event log를 찾을 수 없습니다.')
    }

    const purchase = await prisma.purchase.create({
      data: {
        userId: user.id,
        ticketId: ticket.id,
        transactionHash: mintReceipt.transactionHash,
        tokenId: tokenId.toString(),
      },
    })

    const updatedTicket = await prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        currentSupply: {
          increment: 1,
        },
      },
    })

    return NextResponse.json({
      success: true,
      purchase: {
        id: purchase.id,
        transactionHash: mintReceipt.transactionHash,
        tokenId: tokenId.toString(),
        blockNumber: mintReceipt.blockNumber.toString(),
        ticket: updatedTicket,
      },
      payment: paymentReceipt
        ? {
            transactionHash: paymentReceipt.transactionHash,
            blockNumber: paymentReceipt.blockNumber.toString(),
          }
        : undefined,
    })
  } catch (error) {
    console.error('Purchase error:', error)
    const message = error instanceof Error ? error.message : 'Purchase failed'
    return NextResponse.json({ error: `Purchase failed: ${message}` }, { status: 500 })
  }
}
