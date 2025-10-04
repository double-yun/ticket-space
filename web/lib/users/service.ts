import type { User } from '@prisma/client'
import { prisma } from '../prisma'
import { generateWallet } from './wallet'
import type { KakaoProfile } from '../auth/kakao'

export async function findOrCreateUserWithKakaoProfile(profile: KakaoProfile): Promise<User> {
  const kakaoId = profile.id.toString()

  let user = await prisma.user.findUnique({
    where: { kakaoId },
  })

  if (user) {
    return user
  }

  const { walletAddress, privateKey } = generateWallet()

  user = await prisma.user.create({
    data: {
      kakaoId,
      name: profile.properties?.nickname || profile.kakao_account?.profile?.nickname,
      email: profile.kakao_account?.email,
      image: profile.properties?.profile_image || profile.kakao_account?.profile?.profile_image_url,
      walletAddress,
      privateKeyHash: privateKey, // 실제로는 암호화해야 함
    },
  })

  console.log(`🎉 새 사용자 생성: ${user.name} (${user.walletAddress})`)
  return user
}

export async function createSessionForUser(userId: string, prefix: string) {
  const sessionToken = `${prefix}_${userId}_${Date.now()}`

  await prisma.session.create({
    data: {
      sessionToken,
      userId,
      expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30일
    },
  })

  return sessionToken
}
