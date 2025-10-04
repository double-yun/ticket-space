import { getPublicClient } from './index'

// 컨트랙트별 고유 식별자 (함수 시그니처 조합)
const CONTRACT_SIGNATURES = {
  Ticket: [
    'balanceOf(address)',
    'totalSupply()',
    'mint(address)',
    'ownerOf(uint256)'
  ],
  // 다른 컨트랙트들도 추가 가능
  // PaymentContract: ['processPayment(uint256)', 'getPaymentStatus(uint256)'],
  // EventContract: ['createEvent(string)', 'getEvent(uint256)']
} as const

type ContractName = keyof typeof CONTRACT_SIGNATURES

export async function identifyContract(address: string): Promise<ContractName | null> {
  const client = getPublicClient()

  try {
    const code = await client.getBytecode({ address: address as `0x${string}` })
    if (!code || code === '0x') return null

    // 각 컨트랙트 타입별로 시그니처 확인
    for (const [contractName, signatures] of Object.entries(CONTRACT_SIGNATURES)) {
      const hasAllSignatures = await Promise.all(
        signatures.map(async (sig) => {
          try {
            // 함수 시그니처로 호출 테스트 (view 함수만)
            if (sig.includes('balanceOf') || sig.includes('totalSupply')) {
              await client.readContract({
                address: address as `0x${string}`,
                abi: [{
                  type: 'function',
                  name: sig.split('(')[0],
                  inputs: sig.includes('address') ? [{ type: 'address', name: 'owner' }] : [],
                  outputs: [{ type: 'uint256' }],
                  stateMutability: 'view'
                }],
                functionName: sig.split('(')[0],
                // Use a non-zero address to avoid ERC-721 balanceOf zero-address reverts.
                args: sig.includes('address') ? ['0x0000000000000000000000000000000000000001'] : []
              })
              return true
            }
            return true // 기본적으로 true (non-view 함수는 테스트하지 않음)
          } catch {
            return false
          }
        })
      )

      if (hasAllSignatures.every(Boolean)) {
        return contractName as ContractName
      }
    }

    return null
  } catch (error) {
    console.error('Contract identification failed:', error)
    return null
  }
}

export async function discoverContractByType(contractType: ContractName): Promise<string | null> {
  const client = getPublicClient()

  try {
    const latestBlock = await client.getBlockNumber()

    const maxLookbackEnv = process.env.CONTRACT_DISCOVERY_BLOCKS
    let maxLookback: bigint | null = null

    if (maxLookbackEnv) {
      try {
        const parsed = BigInt(maxLookbackEnv)
        if (parsed >= 0n) {
          maxLookback = parsed
        }
      } catch (error) {
        console.warn('Invalid CONTRACT_DISCOVERY_BLOCKS value, ignoring:', maxLookbackEnv, error)
      }
    }

    let blockNumber = latestBlock
    let blocksScanned = 0n

    while (blockNumber >= 0n) {
      try {
        const block = await client.getBlock({
          blockNumber,
          includeTransactions: true,
        })

        for (const tx of block.transactions) {
          if (typeof tx === 'object' && tx.to === null) {
            const receipt = await client.getTransactionReceipt({ hash: tx.hash })

            if (receipt.contractAddress) {
              const identifiedType = await identifyContract(receipt.contractAddress)

              if (identifiedType === contractType) {
                return receipt.contractAddress
              }
            }
          }
        }
      } catch (error) {
        console.warn(`Failed to check block ${blockNumber}:`, error)
      }

      if (blockNumber === 0n) {
        break
      }

      blockNumber -= 1n
      blocksScanned += 1n

      if (maxLookback !== null && blocksScanned >= maxLookback) {
        break
      }
    }

    return null
  } catch (error) {
    console.error('Contract discovery failed:', error)
    return null
  }
}
