import { cookies } from 'next/headers'
import type { KakaoProfile } from './kakao'

export type PendingKakaoData = {
  kakaoData: KakaoProfile
  accessToken: string
  refreshToken?: string
  kakaoPhoneNumber?: string
}

const COOKIE_NAME = 'kakao_pending_registration'
const COOKIE_MAX_AGE = 30 * 60 // 30분

export async function setPendingKakaoData(data: PendingKakaoData): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, JSON.stringify(data), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  })
}

export async function getPendingKakaoData(): Promise<PendingKakaoData | null> {
  const cookieStore = await cookies()
  const cookie = cookieStore.get(COOKIE_NAME)

  if (!cookie?.value) {
    return null
  }

  try {
    return JSON.parse(cookie.value) as PendingKakaoData
  } catch (error) {
    console.error('Failed to parse pending kakao data:', error)
    return null
  }
}

export async function clearPendingKakaoData(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}
