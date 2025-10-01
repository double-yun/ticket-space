import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateWallet } from '@/lib/wallet'

type DemoRequestBody = {
  variant?: string
  name?: string
}

const DEMO_EMAIL_DOMAIN = 'demo.local'

function sanitizeVariant(rawVariant?: string) {
  if (!rawVariant) return 'demo'
  const trimmed = rawVariant.trim().toLowerCase()
  if (!trimmed) return 'demo'
  return trimmed.replace(/[^a-z0-9_-]/g, '') || 'demo'
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as DemoRequestBody
    const variant = sanitizeVariant(body.variant)
    const displayName = body.name?.trim() || `데모 사용자 (${variant})`
    const email = `${variant}@${DEMO_EMAIL_DOMAIN}`

    let user = await prisma.user.findUnique({ where: { email } })

    if (!user) {
      const { walletAddress, privateKey } = generateWallet()
      user = await prisma.user.create({
        data: {
          email,
          name: displayName,
          walletAddress,
          privateKeyHash: privateKey,
        },
      })
    } else if (!user.walletAddress) {
      const { walletAddress, privateKey } = generateWallet()
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          walletAddress,
          privateKeyHash: privateKey,
          name: user.name ?? displayName,
        },
      })
    } else if (!user.name) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { name: displayName },
      })
    }

    const sessionToken = `demo_${user.id}_${Date.now()}`

    await prisma.session.create({
      data: {
        sessionToken,
        userId: user.id,
        expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    })

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        walletAddress: user.walletAddress,
      },
    })

    response.cookies.set('session_token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60,
      path: '/',
    })

    return response
  } catch (error) {
    console.error('Demo login error:', error)
    return NextResponse.json({ success: false, error: 'Demo login failed' }, { status: 500 })
  }
}
