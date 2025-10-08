import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
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
import ticketAbiJson from '@/lib/blockchain/ticket-abi.json'

const ticketAbi = ticketAbiJson as const

export async function POST(request: NextRequest) {
  try {
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
      return NextResponse.json({ error: 'User wallet not found' }, { status: 400 })
    }

    const contractAddress = await getContractAddress()
    const chainId = getChainId()
    const publicClient = getPublicClient()

    let transactionHash: `0x${string}`
    let blockNumber: bigint
    let tokenId: bigint

    if (isAlchemySmartWalletEnabled()) {
      const smartAccountClient = await getAlchemySmartAccountClient()
      const smartWalletAddress = await getSmartAccountAddress(smartAccountClient)

      const { hash: userOpHash } = await smartAccountClient.sendUserOperation({
        uo: {
          target: contractAddress as `0x${string}`,
          data: smartAccountClient.abiEncode({
            abi: ticketAbi,
            functionName: 'mintTicket',
            args: [user.walletAddress as `0x${string}`],
          }),
        },
      })

      const onChainHash = await smartAccountClient.waitForUserOperationTransaction({ hash: userOpHash })
      const receipt = await publicClient.waitForTransactionReceipt({ hash: onChainHash })
      transactionHash = receipt.transactionHash
      blockNumber = receipt.blockNumber

      const mintEvent = receipt.logs.find((log) => log.address.toLowerCase() === contractAddress.toLowerCase())

      if (!mintEvent) {
        throw new Error('Mint event not found in transaction receipt')
      }

      const decodedEvent = smartAccountClient.decodeEventLog({
        abi: ticketAbi,
        data: mintEvent.data,
        topics: mintEvent.topics,
      })

      tokenId = decodedEvent?.args?.tokenId ?? BigInt(0)

      await prisma.transaction.create({
        data: {
          userId: user.id,
          hash: transactionHash,
          type: 'MINT',
          amount: '0',
          status: 'COMPLETED',
          chainId,
          metadata: {
            tokenId: tokenId.toString(),
            smartWalletAddress,
          },
        },
      })
    } else {
      const serverPrivateKey = process.env.PRIVATE_KEY as `0x${string}` | undefined

      if (!serverPrivateKey) {
        throw new Error('Set PRIVATE_KEY to mint tickets when the Alchemy smart wallet is disabled.')
      }

      const serverAccount = privateKeyToAccount(serverPrivateKey)
      const walletClient = getWalletClient(serverAccount)

      const hash = await walletClient.writeContract({
        address: contractAddress as `0x${string}`,
        abi: ticketAbi,
        functionName: 'mintTicket',
        args: [user.walletAddress as `0x${string}`],
      })

      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      transactionHash = receipt.transactionHash
      blockNumber = receipt.blockNumber

      const mintEvent = receipt.logs.find((log) => log.address.toLowerCase() === contractAddress.toLowerCase())

      if (!mintEvent) {
        throw new Error('Mint event not found in transaction receipt')
      }

      const decodedEvent = walletClient.decodeEventLog({
        abi: ticketAbi,
        data: mintEvent.data,
        topics: mintEvent.topics,
      })

      tokenId = decodedEvent?.args?.tokenId ?? BigInt(0)

      await prisma.transaction.create({
        data: {
          userId: user.id,
          hash: transactionHash,
          type: 'MINT',
          amount: '0',
          status: 'COMPLETED',
          chainId,
          metadata: {
            tokenId: tokenId.toString(),
          },
        },
      })
    }

    await prisma.ticket.create({
      data: {
        userId: user.id,
        tokenId: tokenId.toString(),
        contractAddress,
      },
    })

    return NextResponse.json({
      success: true,
      transactionHash,
      tokenId: tokenId.toString(),
      blockNumber: blockNumber.toString(),
    })
  } catch (error) {
    console.error('Mint error:', error)
    return NextResponse.json({ error: 'Failed to mint ticket' }, { status: 500 })
  }
}
