import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { parseEther } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { getPublicClient, getWalletClient } from '@/lib/blockchain'

export async function POST(request: NextRequest) {
  try {
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
      return NextResponse.json({ error: 'User wallet not found' }, { status: 400 })
    }

    // 서버 지갑 (풍부한 ETH 보유)
    const serverPrivateKey = process.env.PRIVATE_KEY as `0x${string}` || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
    const serverAccount = privateKeyToAccount(serverPrivateKey)

    const walletClient = getWalletClient(serverAccount)

    const publicClient = getPublicClient()

    // 사용자 현재 잔액 확인
    const currentBalance = await publicClient.getBalance({
      address: user.walletAddress as `0x${string}`,
    })

    // 이미 충분한 잔액이 있으면 스킫
    if (currentBalance > parseEther('0.5')) {
      return NextResponse.json({
        success: true,
        message: 'Already have sufficient balance',
        balance: (Number(currentBalance) / 1e18).toFixed(4),
        alreadyFunded: true,
      })
    }

    // 1 ETH 전송 (테스트용)
    const hash = await walletClient.sendTransaction({
      to: user.walletAddress as `0x${string}`,
      value: parseEther('1.0'),
    })

    const receipt = await publicClient.waitForTransactionReceipt({ hash })

    // 새로운 잔액 확인
    const newBalance = await publicClient.getBalance({
      address: user.walletAddress as `0x${string}`,
    })

    return NextResponse.json({
      success: true,
      transactionHash: receipt.transactionHash,
      amount: '1.0',
      newBalance: (Number(newBalance) / 1e18).toFixed(4),
      blockNumber: receipt.blockNumber.toString(),
    })

  } catch (error) {
    console.error('Fund wallet error:', error)
    return NextResponse.json(
      { error: 'Failed to fund wallet' },
      { status: 500 }
    )
  }
}
