import { NextRequest, NextResponse } from 'next/server'
import { parseEther } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { getChainId, getPublicClient, getWalletClient } from '@/lib/blockchain'
import { getAlchemySmartAccountClient, isAlchemySmartWalletEnabled } from '@/lib/blockchain/alchemy-smart-wallet'
import { getAuthenticatedUser } from '@/lib/auth/server'

const SEPOLIA_CHAIN_ID = 11155111

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)

    if (!user) {
      console.error('Wallet fund request missing valid authentication token')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!user.walletAddress) {
      return NextResponse.json({ error: 'User wallet not found' }, { status: 400 })
    }

    const publicClient = getPublicClient()
    const chainId = getChainId()

    const currentBalance = await publicClient.getBalance({
      address: user.walletAddress as `0x${string}`,
    })

    if (currentBalance > parseEther('0.05')) {
      return NextResponse.json({
        success: true,
        message: 'Already have sufficient balance',
        balance: (Number(currentBalance) / 1e18).toFixed(4),
        alreadyFunded: true,
      })
    }

    const transferValue = parseEther('0.05')
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

      // 최신 nonce 가져오기
      const nonce = await publicClient.getTransactionCount({
        address: serverAccount.address,
        blockTag: 'pending',
      })

      console.log('Current nonce:', nonce)

      const hash = await walletClient.sendTransaction({
        to: user.walletAddress as `0x${string}`,
        value: transferValue,
        nonce,
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
