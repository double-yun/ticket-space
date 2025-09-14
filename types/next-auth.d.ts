import NextAuth, { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      walletAddress?: string
      kakaoId?: string
    } & DefaultSession["user"]
  }

  interface User {
    walletAddress?: string
    kakaoId?: string
  }
}