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

  const { walletAddress, privyUserId, privyWalletId } = await generateWallet(`kakao:${kakaoId}`)

  user = await prisma.user.create({
    data: {
      kakaoId,
      name: profile.properties?.nickname || profile.kakao_account?.profile?.nickname,
      email: profile.kakao_account?.email,
      image: profile.properties?.profile_image || profile.kakao_account?.profile?.profile_image_url,
      walletAddress,
      privyUserId,
      ...(privyWalletId ? { privyWalletId } : {}),
    },
  })

  console.log(`🎉 새 사용자 생성: ${user.name} (${user.walletAddress})`)
  return user
}
