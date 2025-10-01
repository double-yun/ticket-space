import { createPublicClient, createWalletClient, http, type Chain } from 'viem'
import { anvil, sepolia } from 'viem/chains'
import type { Account } from 'viem'
import { discoverContractByType } from './contract-registry'
import contractsConfig from '../config/contracts.json'

type SupportedChainId = 31337 | 11155111

const DEFAULT_LOCAL_RPC_URL = 'http://127.0.0.1:8545'
const DEFAULT_LOCAL_CONTRACT_ADDRESS = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512'

const chainsById: Record<SupportedChainId, Chain> = {
  31337: anvil,
  11155111: sepolia,
}

let cachedTicketAddress: string | null = null

function resolveChainId(): SupportedChainId {
  const envChainId = process.env.CHAIN_ID ?? process.env.NEXT_PUBLIC_CHAIN_ID ?? contractsConfig.defaultNetwork

  if (envChainId) {
    const parsed = Number(envChainId)
    if (parsed === 31337 || parsed === 11155111) {
      return parsed
    }
    console.warn(`Unsupported CHAIN_ID "${envChainId}" provided. Falling back to Anvil (31337).`)
  }

  return 31337
}

const chainId = resolveChainId()
const activeChain = chainsById[chainId] ?? anvil

const networkConfig = contractsConfig.networks?.[chainId.toString()]

function resolveRpcUrl(): string {
  const explicitRpcUrl = process.env.RPC_URL ?? process.env.NEXT_PUBLIC_RPC_URL

  if (explicitRpcUrl) {
    return explicitRpcUrl
  }

  if (chainId === 11155111) {
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

  if (chainId === 31337) {
    return process.env.ANVIL_RPC_URL ?? DEFAULT_LOCAL_RPC_URL
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

  const envContractAddress = process.env.CONTRACT_ADDRESS ?? process.env.NEXT_PUBLIC_CONTRACT_ADDRESS

  if (envContractAddress) {
    cachedTicketAddress = envContractAddress
    return cachedTicketAddress
  }

  const configuredAddress = networkConfig?.contracts?.Ticket?.address
  if (configuredAddress) {
    cachedTicketAddress = configuredAddress
    return cachedTicketAddress
  }

  const shouldAutoDiscover = Boolean(networkConfig?.contracts?.Ticket?.autoDiscover) || chainId === 31337

  if (shouldAutoDiscover) {
    console.log('Auto-discovering Ticket contract...')
    const discoveredAddress = await discoverContractByType('Ticket')

    if (discoveredAddress) {
      cachedTicketAddress = discoveredAddress
      console.log(`Ticket contract discovered at: ${discoveredAddress}`)
      return cachedTicketAddress
    }
  }

  if (chainId === 31337) {
    console.warn('Using fallback contract address:', DEFAULT_LOCAL_CONTRACT_ADDRESS)
    cachedTicketAddress = DEFAULT_LOCAL_CONTRACT_ADDRESS
    return cachedTicketAddress
  }

  throw new Error('Contract address not configured. Please deploy the contract or set the CONTRACT_ADDRESS environment variable.')
}

export function getRpcUrl() {
  return rpcUrl
}

export function resetContractCache() {
  cachedTicketAddress = null
}
