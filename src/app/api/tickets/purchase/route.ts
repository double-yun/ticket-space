import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
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
import { privateKeyToAccount } from 'viem/accounts'
import { parseEther } from 'viem'

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

    const { ticketId, price } = await request.json()

    if (!ticketId || !price) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    let transactionHash: `0x${string}`
    let blockNumber: bigint

    if (isAlchemySmartWalletEnabled()) {
      const smartAccountClient = await getAlchemySmartAccountClient()
      const smartWalletAddress = await getSmartAccountAddress(smartAccountClient)

      const { hash: userOpHash } = await smartAccountClient.sendUserOperation({
        uo: {
          target: contractAddress as `0x${string}`,
          data: smartAccountClient.abiEncode({
            abi: ticketAbi,
            functionName: 'purchaseTicket',
            args: [BigInt(ticketId)],
          }),
          value: parseEther(price.toString()),
        },
      })

      const onChainHash = await smartAccountClient.waitForUserOperationTransaction({ hash: userOpHash })
      const receipt = await publicClient.waitForTransactionReceipt({ hash: onChainHash })
      transactionHash = receipt.transactionHash
      blockNumber = receipt.blockNumber

      await prisma.transaction.create({
        data: {
          userId: user.id,
          hash: transactionHash,
          type: 'PURCHASE',
          amount: price.toString(),
          status: 'COMPLETED',
          chainId,
          metadata: {
            ticketId,
            smartWalletAddress,
          },
        },
      })
    } else {
      const serverPrivateKey = process.env.PRIVATE_KEY as `0x${string}` | undefined

      if (!serverPrivateKey) {
        throw new Error('Set PRIVATE_KEY to purchase tickets when the Alchemy smart wallet is disabled.')
      }

      const serverAccount = privateKeyToAccount(serverPrivateKey)
      const walletClient = getWalletClient(serverAccount)

      const hash = await walletClient.writeContract({
        address: contractAddress as `0x${string}`,
        abi: ticketAbi,
        functionName: 'purchaseTicket',
        args: [BigInt(ticketId)],
        value: parseEther(price.toString()),
      })

      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      transactionHash = receipt.transactionHash
      blockNumber = receipt.blockNumber

      await prisma.transaction.create({
        data: {
          userId: user.id,
          hash: transactionHash,
          type: 'PURCHASE',
          amount: price.toString(),
          status: 'COMPLETED',
          chainId,
          metadata: {
            ticketId,
          },
        },
      })
    }

    return NextResponse.json({
      success: true,
      transactionHash,
      blockNumber: blockNumber.toString(),
    })
  } catch (error) {
    console.error('Ticket purchase error:', error)
    return NextResponse.json({ error: 'Failed to purchase ticket' }, { status: 500 })
  }
}
