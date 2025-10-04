type FetchConfig = {
  clientId: string
  clientSecret: string
  redirectUri: string
}

export type KakaoProfile = {
  id: number | string
  properties?: {
    nickname?: string
    profile_image?: string
  }
  kakao_account?: {
    email?: string
    profile?: {
      nickname?: string
      profile_image_url?: string
    }
  }
}

export class KakaoOAuthError extends Error {
  constructor(public readonly reason: string, message?: string) {
    super(message ?? reason)
  }
}

const KAKAO_TOKEN_URL = 'https://kauth.kakao.com/oauth/token'
const KAKAO_PROFILE_URL = 'https://kapi.kakao.com/v2/user/me'

export function getKakaoOAuthConfig(): FetchConfig {
  const clientId = process.env.KAKAO_CLIENT_ID
  const clientSecret = process.env.KAKAO_CLIENT_SECRET
  const redirectUri =
    process.env.KAKAO_REDIRECT_URI ??
    process.env.NEXT_PUBLIC_KAKAO_REDIRECT_URI ??
    process.env.APP_URL ??
    process.env.NEXTAUTH_URL

  if (!clientId || !clientSecret) {
    throw new KakaoOAuthError('server_error', 'Kakao OAuth credentials are not configured.')
  }

  if (!redirectUri) {
    throw new KakaoOAuthError('server_error', 'Kakao redirect URI is not configured.')
  }

  return {
    clientId,
    clientSecret,
    redirectUri,
  }
}

export async function exchangeCodeForAccessToken(code: string, config: FetchConfig) {
  const response = await fetch(KAKAO_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      code,
    }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => 'Failed to exchange code for token.')
    throw new KakaoOAuthError('token_error', detail)
  }

  const tokenData = await response.json().catch(() => ({}))
  const accessToken = tokenData?.access_token as string | undefined

  if (!accessToken) {
    throw new KakaoOAuthError('token_error', 'Missing access token in response.')
  }

  return accessToken
}

export async function fetchKakaoProfile(accessToken: string): Promise<KakaoProfile> {
  const response = await fetch(KAKAO_PROFILE_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    throw new KakaoOAuthError('user_info_error', 'Failed to fetch Kakao user profile.')
  }

  const profile = await response.json().catch(() => undefined)

  if (!profile?.id) {
    throw new KakaoOAuthError('user_info_error', 'Invalid Kakao user profile response.')
  }

  return profile
}
