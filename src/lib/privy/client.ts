import { PrivyClient } from '@privy-io/server-auth'

let cachedClient: PrivyClient | null = null

function createClient() {
  if (cachedClient) {
    return cachedClient
  }

  const appId = process.env.PRIVY_APP_ID
  const appSecret = process.env.PRIVY_APP_SECRET

  if (!appId || !appSecret) {
    throw new Error('Privy client is not configured. Set PRIVY_APP_ID and PRIVY_APP_SECRET environment variables.')
  }

  cachedClient = new PrivyClient(appId, appSecret)

  return cachedClient
}

export function getPrivyClient() {
  return createClient()
}
