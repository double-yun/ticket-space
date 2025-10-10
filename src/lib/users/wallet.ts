import { privateKeyToAccount } from 'viem/accounts'
import { getPrivyClient } from '../privy/client'

type PrivyWalletAccount = {
  type?: string
  address?: string
  id?: string | null
  wallet_id?: string | null
  walletClientType?: string | null
}

type PrivyLinkedAccount = PrivyWalletAccount & {
  chain_type?: string
  chain_id?: string
}

type PrivyWalletResponse = {
  address: string
  id?: string | null
  wallet_id?: string | null
}

type PrivyUser = {
  id: string
  linkedAccounts?: PrivyLinkedAccount[]
  wallet?: PrivyWalletAccount
}

function findPrivySmartWallet(user: PrivyUser) {
  const linkedAccounts = user.linkedAccounts ?? []

  const smartWallet = linkedAccounts.find(
    (account) => account.type === 'smart_wallet' && account.address
  )
  if (smartWallet) {
    return smartWallet
  }

  const legacySmartWallet = linkedAccounts.find(
    (account) =>
      account.type === 'wallet' && account.address && account.walletClientType === 'privy'
  )
  if (legacySmartWallet) {
    return legacySmartWallet
  }

  if (user.wallet?.type === 'smart_wallet' && user.wallet.address) {
    return user.wallet
  }

  return null
}

function findEmbeddedWallet(user: PrivyUser) {
  return (
    user.linkedAccounts?.find((account) => account.type === 'wallet' && account.address) ?? null
  )
}

function toWalletResponse(account: PrivyWalletAccount): PrivyWalletResponse {
  if (!account.address) {
    throw new Error('Privy wallet account is missing an address.')
  }

  return {
    address: account.address,
    id: account.id ?? undefined,
    wallet_id: account.wallet_id ?? undefined,
  }
}

async function ensurePrivyUser(externalId: string): Promise<PrivyUser> {
  const client = getPrivyClient()
  const privyClient = client as unknown as {
    getUserByCustomAuthId?: (externalId: string) => Promise<PrivyUser | null>
    importUser?: (params: {
      linkedAccounts: Array<{ type: 'custom_auth'; customUserId: string }>
      createEthereumWallet?: boolean
      createEthereumSmartWallet?: boolean
    }) => Promise<PrivyUser>
  }

  if (typeof privyClient.getUserByCustomAuthId !== 'function' || typeof privyClient.importUser !== 'function') {
    throw new Error(
      'Privy server client is missing required helpers (getUserByCustomAuthId/importUser). Check @privy-io/server-auth version.',
    )
  }

  const existing = await privyClient.getUserByCustomAuthId(externalId)
  if (existing) {
    return existing
  }

  return privyClient.importUser({
    linkedAccounts: [
      {
        type: 'custom_auth',
        customUserId: externalId,
      },
    ],
    createEthereumWallet: true,
    createEthereumSmartWallet: true,
  })
}

async function ensurePrivySmartWallet(user: PrivyUser): Promise<PrivyWalletResponse> {
  const existingSmartWallet = findPrivySmartWallet(user)
  if (existingSmartWallet) {
    return toWalletResponse(existingSmartWallet)
  }

  const client = getPrivyClient()
  const privyClient = client as unknown as {
    createWallets?: (params: {
      userId: string
      createEthereumWallet?: boolean
      createSolanaWallet?: boolean
      createEthereumSmartWallet?: boolean
    }) => Promise<PrivyUser>
  }

  if (typeof privyClient.createWallets !== 'function') {
    throw new Error('Privy server client does not expose createWallets helper. Verify SDK version and configuration.')
  }

  const updatedUser = await privyClient.createWallets({
    userId: user.id,
    createEthereumWallet: true,
    createEthereumSmartWallet: true,
  })

  const smartWallet = findPrivySmartWallet(updatedUser)
  if (smartWallet) {
    return toWalletResponse(smartWallet)
  }

  const embeddedWallet = findEmbeddedWallet(updatedUser)
  if (embeddedWallet) {
    console.warn('⚠️ Using Embedded Wallet instead of Smart Wallet. Please enable Smart Wallets in Privy Dashboard.')
    return toWalletResponse(embeddedWallet)
  }

  throw new Error('Privy wallet creation did not return any wallet address. Please check Privy Dashboard configuration.')
}

export async function generateWallet(externalId: string) {
  const user = await ensurePrivyUser(externalId)
  const wallet = await ensurePrivySmartWallet(user)

  return {
    walletAddress: wallet.address,
    privyUserId: user.id,
    privyWalletId: wallet.wallet_id ?? wallet.id ?? undefined,
  }
}

export function getAccountFromPrivateKey(privateKey: `0x${string}`) {
  return privateKeyToAccount(privateKey)
}
