import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { parseEther } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { getChainId, getPublicClient, getWalletClient } from '@/lib/blockchain'
import { getAlchemySmartAccountClient, isAlchemySmartWalletEnabled } from '@/lib/blockchain/alchemy-smart-wallet'

const SEPOLIA_CHAIN_ID = 11155111

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

    const publicClient = getPublicClient()
    const chainId = getChainId()

    const currentBalance = await publicClient.getBalance({
      address: user.walletAddress as `0x${string}`,
    })

    if (currentBalance > parseEther('0.5')) {
      return NextResponse.json({
        success: true,
        message: 'Already have sufficient balance',
        balance: (Number(currentBalance) / 1e18).toFixed(4),
        alreadyFunded: true,
      })
    }

    const transferValue = parseEther('1.0')
    let transactionHash: `0x${string}`
    let blockNumber: string

    if (chainId === SEPOLIA_CHAIN_ID && isAlchemySmartWalletEnabled()) {
      const smartAccountClient = await getAlchemySmartAccountClient()
      const { hash: userOpHash } = await smartAccountClient.sendUserOperation({
        uo: {
          target: user.walletAddress as `0x${string}`,
          data: '0x',
          value: transferValue,
        },
      })

      const onChainHash = await smartAccountClient.waitForUserOperationTransaction({ hash: userOpHash })
      const receipt = await publicClient.waitForTransactionReceipt({ hash: onChainHash })

      transactionHash = receipt.transactionHash
      blockNumber = receipt.blockNumber.toString()
    } else {
      const serverPrivateKey = process.env.PRIVATE_KEY as `0x${string}` | undefined

      if (!serverPrivateKey) {
        throw new Error('Set PRIVATE_KEY to fund wallets when the Alchemy smart wallet is disabled.')
      }

      const serverAccount = privateKeyToAccount(serverPrivateKey)
      const walletClient = getWalletClient(serverAccount)

      const hash = await walletClient.sendTransaction({
        to: user.walletAddress as `0x${string}`,
        value: transferValue,
      })

      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      transactionHash = receipt.transactionHash
      blockNumber = receipt.blockNumber.toString()
    }

    const newBalance = await publicClient.getBalance({
      address: user.walletAddress as `0x${string}`,
    })

    return NextResponse.json({
      success: true,
      transactionHash,
      amount: '1.0',
      newBalance: (Number(newBalance) / 1e18).toFixed(4),
      blockNumber,
    })
  } catch (error) {
    console.error('Fund wallet error:', error)
    return NextResponse.json({ error: 'Failed to fund wallet' }, { status: 500 })
  }
}
