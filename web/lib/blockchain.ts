import { createPublicClient, createWalletClient, http } from 'viem'
import { anvil } from 'viem/chains'
import type { Account } from 'viem'
import { discoverContractByType } from './contract-registry'

const DEFAULT_RPC_URL = 'http://127.0.0.1:8545'
const DEFAULT_CONTRACT_ADDRESS = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512'

let cachedTicketAddress: string | null = null

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
  // 1. 캐시된 주소 확인
  if (cachedTicketAddress) {
    return cachedTicketAddress
  }

  // 2. 환경변수 확인
  if (process.env.CONTRACT_ADDRESS) {
    cachedTicketAddress = process.env.CONTRACT_ADDRESS
    return cachedTicketAddress
  }

  // 3. Ticket 컨트랙트 자동 탐지
  console.log('Auto-discovering Ticket contract...')
  const discoveredAddress = await discoverContractByType('Ticket')

  if (discoveredAddress) {
    cachedTicketAddress = discoveredAddress
    console.log(`Ticket contract discovered at: ${discoveredAddress}`)
    return cachedTicketAddress
  }

  // 4. 폴백: 기본 주소 사용
  console.warn('Using fallback contract address:', DEFAULT_CONTRACT_ADDRESS)
  cachedTicketAddress = DEFAULT_CONTRACT_ADDRESS
  return cachedTicketAddress
}

export function getRpcUrl() {
  return rpcUrl
}

// 캐시 초기화 (테스트용)
export function resetContractCache() {
  cachedTicketAddress = null
}
