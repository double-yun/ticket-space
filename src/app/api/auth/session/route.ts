import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session_token')?.value

    if (sessionToken) {
      const session = await prisma.session.findUnique({
        where: { sessionToken },
        include: { user: true },
      })

      if (session && session.expires > new Date()) {
        const { user } = session
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
      }
    }

    return NextResponse.json({ user: null })
  } catch (error) {
    console.error('Session error:', error)
    return NextResponse.json({ user: null })
  }
}
