import { NextRequest, NextResponse } from 'next/server'
import { getContractAddress, getPublicClient } from '@/lib/blockchain'
import { prisma } from '@/lib/prisma'
import ticketAbiJson from '@/lib/blockchain/ticket-abi.json'

const ticketAbi = ticketAbiJson as const

const publicClient = getPublicClient()

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const address = searchParams.get('address')

    if (!address) {
      return NextResponse.json({ success: false, error: 'Address required' }, { status: 400 })
    }

    const contractAddress = await getContractAddress()
    const normalizedAddress = address.toLowerCase()

    const [ethBalance, nftBalance, totalSupply, user] = await Promise.all([
      publicClient.getBalance({ address: address as `0x${string}` }),
      publicClient.readContract({
        address: contractAddress as `0x${string}`,
        abi: ticketAbi,
        functionName: 'balanceOf',
        args: [address as `0x${string}`],
      }),
      publicClient.readContract({
        address: contractAddress as `0x${string}`,
        abi: ticketAbi,
        functionName: 'totalSupply',
      }),
      prisma.user.findFirst({
        where: {
          OR: [
            { walletAddress: address },
            { walletAddress: normalizedAddress },
          ],
        },
        select: {
          pointBalance: true,
        },
      }),
    ])

    return NextResponse.json({
      success: true,
      address,
      ethBalance: (Number(ethBalance) / 1e18).toFixed(4),
      nftBalance: (nftBalance as bigint).toString(),
      totalSupply: (totalSupply as bigint).toString(),
      pointBalance: user?.pointBalance ?? 0,
    })
  } catch (error) {
    console.error(error)
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred'
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 })
  }
}
