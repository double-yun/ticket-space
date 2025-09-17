import { getPublicClient } from './blockchain'

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
                args: sig.includes('address') ? ['0x0000000000000000000000000000000000000000'] : []
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
    const blocksToCheck = 20 // 더 많은 블록 확인

    for (let i = 0; i < blocksToCheck; i++) {
      const blockNumber = latestBlock - BigInt(i)

      try {
        const block = await client.getBlock({
          blockNumber,
          includeTransactions: true
        })

        for (const tx of block.transactions) {
          if (typeof tx === 'object' && tx.to === null) { // 컨트랙트 생성 트랜잭션
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
    }

    return null
  } catch (error) {
    console.error('Contract discovery failed:', error)
    return null
  }
}