import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth/server'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)

    if (!user) {
      return NextResponse.json({ user: null })
    }

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        walletAddress: user.walletAddress,
        kakaoId: user.kakaoId,
        phoneNumber: user.phoneNumber,
      },
    })
  } catch (error) {
    console.error('Auth user lookup error:', error)
    return NextResponse.json({ user: null })
  }
}
