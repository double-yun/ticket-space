import { privateKeyToAccount } from 'viem/accounts'
import { getPrivyClient } from '../privy/client'

type PrivyWalletAccount = {
  type?: string
  address?: string
  id?: string | null
  wallet_id?: string | null
  walletClientType?: string | null
  connectorType?: string | null
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

function isPrivyEmbeddedWallet(account: PrivyWalletAccount | null | undefined) {
  if (!account?.address) {
    return false
  }

  if (account.walletClientType && account.walletClientType !== 'privy') {
    return false
  }

  if (account.connectorType && account.connectorType !== 'embedded') {
    return false
  }

  return true
}

function findEmbeddedWallet(user: PrivyUser) {
  const linkedAccount = user.linkedAccounts?.find((account) => account.type === 'wallet' && isPrivyEmbeddedWallet(account))
  if (linkedAccount?.address) {
    return linkedAccount
  }

  if (isPrivyEmbeddedWallet(user.wallet)) {
    return user.wallet
  }

  return null
}

async function ensurePrivyUser(externalId: string): Promise<PrivyUser> {
  const client = getPrivyClient()
  const privyClient = client as unknown as {
    getUserByCustomAuthId?: (externalId: string) => Promise<PrivyUser | null>
    importUser?: (params: {
      linkedAccounts: Array<{ type: 'custom_auth'; customUserId: string }>
      createEthereumWallet?: boolean
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
  })
}

async function ensurePrivyWallet(user: PrivyUser): Promise<PrivyWalletResponse> {
  const embeddedWallet = findEmbeddedWallet(user)
  if (embeddedWallet && embeddedWallet.address) {
    return {
      address: embeddedWallet.address,
      id: embeddedWallet.id ?? undefined,
      wallet_id: embeddedWallet.wallet_id ?? undefined,
    }
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
  })

  const wallet = findEmbeddedWallet(updatedUser)
  if (!wallet?.address) {
    throw new Error('Privy wallet creation did not return an embedded wallet address.')
  }

  return {
    address: wallet.address,
    id: wallet.id ?? undefined,
    wallet_id: wallet.wallet_id ?? undefined,
  }
}

export async function generateWallet(externalId: string) {
  const user = await ensurePrivyUser(externalId)
  const wallet = await ensurePrivyWallet(user)

  return {
    walletAddress: wallet.address,
    privyUserId: user.id,
    privyWalletId: wallet.wallet_id ?? wallet.id ?? undefined,
  }
}

export function getAccountFromPrivateKey(privateKey: `0x${string}`) {
  return privateKeyToAccount(privateKey)
}
