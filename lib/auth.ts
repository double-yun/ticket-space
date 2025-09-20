import { NextAuthOptions } from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "./prisma"
import { generateWallet } from "./wallet"

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  providers: [
    {
      id: "kakao",
      name: "Kakao",
      type: "oauth",
      clientId: "13ee2e0978370b66ed83f6c35e511a93",
      clientSecret: "g3PNFSPpAxwqaDLXoQmCFyHC8pHNbEAh",
      authorization: {
        url: "https://kauth.kakao.com/oauth/authorize",
        params: {
          scope: "profile_nickname account_email",
          response_type: "code",
        },
      },
      token: {
        url: "https://kauth.kakao.com/oauth/token",
        params: {
          grant_type: "authorization_code",
        },
      },
      userinfo: {
        url: "https://kapi.kakao.com/v2/user/me",
        async request(context) {
          const response = await fetch("https://kapi.kakao.com/v2/user/me", {
            headers: {
              Authorization: `Bearer ${context.tokens.access_token}`,
            },
          })
          return response.json()
        },
      },
      profile(profile: any) {
        console.log("Kakao profile:", profile)
        return {
          id: profile.id.toString(),
          name: profile.properties?.nickname || profile.kakao_account?.profile?.nickname,
          email: profile.kakao_account?.email,
          image: profile.properties?.profile_image || profile.kakao_account?.profile?.profile_image_url,
        }
      },
    },
  ],
  events: {
    async createUser(message) {
      // 새 사용자 생성시 지갑도 함께 생성
      const { walletAddress, privateKey } = generateWallet()

      await prisma.user.update({
        where: { id: message.user.id },
        data: {
          kakaoId: message.user.id,
          walletAddress,
          privateKeyHash: privateKey, // 실제로는 암호화해서 저장해야 함
        },
      })

      console.log(`🎉 새 사용자 생성: ${message.user.name} (${walletAddress})`)
    },
  },
  callbacks: {
    async session({ session, user }) {
      // 세션에 지갑 주소 추가
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { walletAddress: true, kakaoId: true },
      })

      return {
        ...session,
        user: {
          ...session.user,
          id: user.id,
          walletAddress: dbUser?.walletAddress,
          kakaoId: dbUser?.kakaoId,
        },
      }
    },
  },
  pages: {
    signIn: '/login', // 커스텀 로그인 페이지
  },
}