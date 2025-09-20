import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session_token')?.value
    const appSession = cookieStore.get('session')?.value

    // NextAuth 세션 삭제
    if (sessionToken) {
      await prisma.session.deleteMany({
        where: { sessionToken },
      })
    }

    const response = NextResponse.json({ success: true })

    // 모든 세션 쿠키 삭제
    response.cookies.delete('session_token')
    response.cookies.delete('session')

    return response
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json({ error: 'Logout failed' }, { status: 500 })
  }
}