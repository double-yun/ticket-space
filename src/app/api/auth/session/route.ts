import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session_token')?.value
    const appSession = cookieStore.get('session')?.value

    // NextAuth 세션 확인
    if (sessionToken) {
      const session = await prisma.session.findUnique({
        where: { sessionToken },
        include: { user: true },
      })

      if (session && session.expires > new Date()) {
        return NextResponse.json({
          user: {
            id: session.user.id,
            name: session.user.name,
            email: session.user.email,
            image: session.user.image,
            walletAddress: session.user.walletAddress,
            kakaoId: session.user.kakaoId,
          },
        })
      }
    }

    // 앱 세션 확인
    if (appSession) {
      const sessionData = JSON.parse(appSession)
      const user = await prisma.user.findUnique({
        where: { id: sessionData.userId },
      })

      if (user) {
        return NextResponse.json({
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image,
            walletAddress: user.walletAddress,
            kakaoId: user.kakaoId,
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