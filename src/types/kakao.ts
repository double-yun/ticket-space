export interface KakaoProfile {
  id: number | string
  properties?: {
    nickname?: string
    profile_image?: string
  }
  kakao_account?: {
    email?: string
    phone_number?: string
    profile?: {
      nickname?: string
      profile_image_url?: string
    }
  }
}

export interface KakaoUserInfo {
  kakaoId: string
  nickname?: string
  email?: string
  phoneNumber: string | null
}

export interface KakaoRegistrationPayload {
  kakaoId: string
  name: string
  email?: string
  phoneNumber: string
  birthDate: string
  gender: string
  accessToken: string
  refreshToken?: string
  phoneVerified: true
}
