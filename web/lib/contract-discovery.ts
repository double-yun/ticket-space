import { getPublicClient } from './blockchain'

const KNOWN_DEPLOYER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'

// Contract bytecode signature to identify our Ticket contract
const TICKET_BYTECODE_SIGNATURE = '0x608060405260016002553480156013575f5ffd5b50'

export async function discoverContractAddress(): Promise<string | null> {
  const client = getPublicClient()

  try {
    // Get recent blocks
    const latestBlock = await client.getBlockNumber()
    const blocksToCheck = 10 // Check last 10 blocks

    for (let i = 0; i < blocksToCheck; i++) {
      const blockNumber = latestBlock - BigInt(i)

      try {
        const block = await client.getBlock({
          blockNumber,
          includeTransactions: true
        })

        for (const tx of block.transactions) {
          // Check if it's a contract creation from our deployer
          if (typeof tx === 'object' &&
              tx.from?.toLowerCase() === KNOWN_DEPLOYER.toLowerCase() &&
              tx.to === null) {

            // Get transaction receipt to find contract address
            const receipt = await client.getTransactionReceipt({ hash: tx.hash })

            if (receipt.contractAddress) {
              // Verify it's our contract by checking bytecode
              const code = await client.getBytecode({
                address: receipt.contractAddress
              })

              if (code && code.startsWith(TICKET_BYTECODE_SIGNATURE)) {
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