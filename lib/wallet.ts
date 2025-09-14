import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'

export function generateWallet() {
  const privateKey = generatePrivateKey()
  const account = privateKeyToAccount(privateKey)

  return {
    walletAddress: account.address,
    privateKey, // 실제로는 암호화해서 저장
  }
}

export function getAccountFromPrivateKey(privateKey: `0x${string}`) {
  return privateKeyToAccount(privateKey)
}