import { createLightAccountAlchemyClient, type AlchemySmartAccountClient } from '@alchemy/aa-alchemy'
import { LocalAccountSigner, type SmartAccountSigner } from '@alchemy/aa-core'
import { getChain, getChainId } from './index'

const SEPOLIA_CHAIN_ID = 11155111

let smartAccountClientPromise: Promise<AlchemySmartAccountClient> | null = null
let cachedSigner: SmartAccountSigner | null = null

function assertAlchemyEnvironment() {
  if (getChainId() !== SEPOLIA_CHAIN_ID) {
    throw new Error('Alchemy smart wallet is only available on Sepolia')
  }

  const apiKey = process.env.ALCHEMY_API_KEY ?? process.env.NEXT_PUBLIC_ALCHEMY_API_KEY
  const rpcUrl = process.env.ALCHEMY_RPC_URL ?? process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL
  const ownerKey = process.env.SMART_WALLET_OWNER_PRIVATE_KEY as `0x${string}` | undefined

  if (!apiKey && !rpcUrl) {
    throw new Error('Set ALCHEMY_API_KEY or ALCHEMY_RPC_URL to use the Alchemy smart wallet.')
  }

  if (!ownerKey) {
    throw new Error('Set SMART_WALLET_OWNER_PRIVATE_KEY for the Alchemy smart wallet owner.')
  }

  return {
    apiKey,
    rpcUrl,
    ownerKey,
  }
}

function getSigner(privateKey: `0x${string}`): SmartAccountSigner {
  if (!cachedSigner) {
    cachedSigner = LocalAccountSigner.privateKeyToAccountSigner(privateKey)
  }

  return cachedSigner
}

export function isAlchemySmartWalletEnabled() {
  try {
    assertAlchemyEnvironment()
    return true
  } catch {
    return false
  }
}

export async function getAlchemySmartAccountClient() {
  if (smartAccountClientPromise) {
    return smartAccountClientPromise
  }

  const { apiKey, rpcUrl, ownerKey } = assertAlchemyEnvironment()
  const signer = getSigner(ownerKey)

  const resolvedPolicyId = process.env.ALCHEMY_GAS_POLICY_ID ?? process.env.NEXT_PUBLIC_ALCHEMY_POLICY_ID

  smartAccountClientPromise = createLightAccountAlchemyClient({
    chain: getChain(),
    signer,
    ...(rpcUrl ? { rpcUrl } : { apiKey }),
    gasManagerConfig: resolvedPolicyId
      ? {
          policyId: resolvedPolicyId,
        }
      : undefined,
  })

  return smartAccountClientPromise
}

export async function getSmartAccountAddress() {
  const client = await getAlchemySmartAccountClient()
  return client.getAddress()
}
