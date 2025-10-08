import { createPublicClient, createWalletClient, http, type Chain } from 'viem'
import { mainnet, sepolia } from 'viem/chains'
import type { Account } from 'viem'
import { discoverContractByType } from './contract-registry'
import contractsConfig from '../../config/contracts.json'

const SEPOLIA_CHAIN_ID = 11155111 as const
const MAINNET_CHAIN_ID = 1 as const

type SupportedChainId = typeof SEPOLIA_CHAIN_ID | typeof MAINNET_CHAIN_ID

const chainsById: Record<SupportedChainId, Chain> = {
  [SEPOLIA_CHAIN_ID]: sepolia,
  [MAINNET_CHAIN_ID]: mainnet,
}

let cachedTicketAddress: string | null = null

function isSupportedChainId(chainId: number): chainId is SupportedChainId {
  return chainId === SEPOLIA_CHAIN_ID || chainId === MAINNET_CHAIN_ID
}

function resolveDefaultChainId(): SupportedChainId {
  const configuredDefault = contractsConfig.defaultNetwork
  if (configuredDefault) {
    const parsed = Number(configuredDefault)
    if (isSupportedChainId(parsed)) {
      return parsed
    }
    console.warn(`Unsupported defaultNetwork "${configuredDefault}" in contracts.json. Falling back to ${SEPOLIA_CHAIN_ID}.`)
  }

  return SEPOLIA_CHAIN_ID
}

function resolveChainId(): SupportedChainId {
  const envChainId = process.env.CHAIN_ID ?? process.env.NEXT_PUBLIC_CHAIN_ID

  if (envChainId) {
    const parsed = Number(envChainId)
    if (isSupportedChainId(parsed)) {
      return parsed
    }
    console.warn(`Unsupported CHAIN_ID "${envChainId}" provided. Falling back to default network configuration.`)
  }

  return resolveDefaultChainId()
}

const chainId = resolveChainId()
const activeChain = chainsById[chainId]

if (!activeChain) {
  throw new Error(`Unsupported chainId ${chainId} resolved at runtime.`)
}

const networkConfig = contractsConfig.networks?.[chainId.toString()]

function resolveRpcUrl(): string {
  const explicitRpcUrl = process.env.RPC_URL ?? process.env.NEXT_PUBLIC_RPC_URL

  if (explicitRpcUrl) {
    return explicitRpcUrl
  }

  if (chainId === SEPOLIA_CHAIN_ID) {
    const alchemyRpcUrl = process.env.ALCHEMY_RPC_URL ?? process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL
    if (alchemyRpcUrl) {
      return alchemyRpcUrl
    }

    const alchemyApiKey = process.env.ALCHEMY_API_KEY ?? process.env.NEXT_PUBLIC_ALCHEMY_API_KEY
    if (alchemyApiKey) {
      return `https://eth-sepolia.g.alchemy.com/v2/${alchemyApiKey}`
    }
  }

  if (networkConfig?.rpcUrl) {
    return networkConfig.rpcUrl
  }

  const defaultEndpoint = activeChain.rpcUrls.default.http[0]

  if (!defaultEndpoint) {
    throw new Error('RPC URL could not be resolved for the selected chain.')
  }

  return defaultEndpoint
}

const rpcUrl = resolveRpcUrl()

export function getChain() {
  return activeChain
}

export function getChainId() {
  return chainId
}

export function getPublicClient() {
  return createPublicClient({
    chain: activeChain,
    transport: http(rpcUrl),
  })
}

export function getWalletClient(account: Account) {
  return createWalletClient({
    account,
    chain: activeChain,
    transport: http(rpcUrl),
  })
}

export async function getContractAddress(): Promise<string> {
  if (cachedTicketAddress) {
    return cachedTicketAddress
  }

  const envContractAddress =
    process.env.TICKET_CONTRACT_ADDRESS ??
    process.env.NEXT_PUBLIC_TICKET_CONTRACT_ADDRESS ??
    process.env.CONTRACT_ADDRESS ??
    process.env.NEXT_PUBLIC_CONTRACT_ADDRESS

  if (envContractAddress) {
    cachedTicketAddress = envContractAddress
    return cachedTicketAddress
  }

  const configuredAddress = networkConfig?.contracts?.Ticket?.address
  if (configuredAddress) {
    cachedTicketAddress = configuredAddress
    return cachedTicketAddress
  }

  const shouldAutoDiscover = Boolean(networkConfig?.contracts?.Ticket?.autoDiscover)

  if (shouldAutoDiscover) {
    console.log('Auto-discovering Ticket contract...')
    const discoveredAddress = await discoverContractByType('Ticket')

    if (discoveredAddress) {
      cachedTicketAddress = discoveredAddress
      console.log(`Ticket contract discovered at: ${discoveredAddress}`)
      return cachedTicketAddress
    }
  }

  throw new Error('Contract address not configured. Please deploy the contract or set the TICKET_CONTRACT_ADDRESS environment variable.')
}

export function getRpcUrl() {
  return rpcUrl
}

export function resetContractCache() {
  cachedTicketAddress = null
}
