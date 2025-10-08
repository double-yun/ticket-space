import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateWallet } from '@/lib/users/wallet'
import { signToken } from '@/lib/auth/jwt'

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
      const { walletAddress, privyUserId, privyWalletId } = await generateWallet(`demo:${variant}`)
      user = await prisma.user.create({
        data: {
          email,
          name: displayName,
          walletAddress,
          privyUserId,
          ...(privyWalletId ? { privyWalletId } : {}),
        },
      })
    } else if (!user.walletAddress) {
      const { walletAddress, privyUserId, privyWalletId } = await generateWallet(`demo:${variant}`)
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          walletAddress,
          privyUserId,
          ...(privyWalletId ? { privyWalletId } : {}),
          name: user.name ?? displayName,
        },
      })
    } else if (!user.name) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { name: displayName },
      })
    }

    // Generate JWT token
    const token = signToken({
      sub: user.id,
      userId: user.id,
      walletAddress: user.walletAddress || undefined,
    })

    return NextResponse.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        walletAddress: user.walletAddress,
      },
    })
  } catch (error) {
    console.error('Demo login error:', error)
    return NextResponse.json({ success: false, error: 'Demo login failed' }, { status: 500 })
  }
}
