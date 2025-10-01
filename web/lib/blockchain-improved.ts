import { createPublicClient, createWalletClient, http } from 'viem'
import { anvil } from 'viem/chains'
import type { Account } from 'viem'
import { discoverContractAddress } from './contract-discovery'
import contractsConfig from '../config/contracts.json'

const DEFAULT_RPC_URL = 'http://127.0.0.1:8545'
const CHAIN_ID = 31337

let cachedContractAddress: string | null = null

const rpcUrl = process.env.ANVIL_RPC_URL ?? DEFAULT_RPC_URL

export function getPublicClient() {
  return createPublicClient({
    chain: anvil,
    transport: http(rpcUrl),
  })
}

export function getWalletClient(account: Account) {
  return createWalletClient({
    account,
    chain: anvil,
    transport: http(rpcUrl),
  })
}

export async function getContractAddress(): Promise<string> {
  // 1. Check if cached
  if (cachedContractAddress) {
    return cachedContractAddress
  }

  // 2. Check environment variable
  if (process.env.CONTRACT_ADDRESS) {
    cachedContractAddress = process.env.CONTRACT_ADDRESS
    return cachedContractAddress
  }

  // 3. Check config file
  const networkConfig = contractsConfig.networks[CHAIN_ID.toString()]
  if (networkConfig?.contracts?.Ticket?.address) {
    cachedContractAddress = networkConfig.contracts.Ticket.address
    return cachedContractAddress
  }

  // 4. Auto-discover if enabled
  if (networkConfig?.contracts?.Ticket?.autoDiscover) {
    console.log('Auto-discovering contract address...')
    const discoveredAddress = await discoverContractAddress()

    if (discoveredAddress) {
      cachedContractAddress = discoveredAddress
      console.log(`Contract discovered at: ${discoveredAddress}`)
      return cachedContractAddress
    }
  }

  throw new Error('Contract address not found. Please deploy the contract or set CONTRACT_ADDRESS environment variable.')
}

export function getRpcUrl() {
  return rpcUrl
}

// Reset cache (useful for testing)
export function resetContractCache() {
  cachedContractAddress = null
}