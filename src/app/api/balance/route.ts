import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const address = searchParams.get('address')

    if (!address) {
      return NextResponse.json({ success: false, error: 'Address required' }, { status: 400 })
    }

    const normalizedAddress = address.toLowerCase()

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ walletAddress: address }, { walletAddress: normalizedAddress }],
      },
      select: {
        pointBalance: true,
      },
    })

    return NextResponse.json({
      success: true,
      address,
      pointBalance: user?.pointBalance ?? 0,
    })
  } catch (error) {
    console.error(error)
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred'
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 })
  }
}
