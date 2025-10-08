'use server'

import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from './jwt'

export async function getAuthenticatedUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : authHeader ?? ''

  if (!token) {
    return null
  }

  const payload = verifyToken(token)
  if (!payload) {
    return null
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
  })

  return user
}
