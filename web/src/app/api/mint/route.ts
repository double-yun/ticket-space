import { NextResponse } from 'next/server';
import { decodeEventLog, encodeFunctionData } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { getChainId, getContractAddress, getPublicClient, getWalletClient } from '@/lib/blockchain';
import { getAlchemySmartAccountClient, isAlchemySmartWalletEnabled } from '@/lib/alchemy-smart-wallet';
import { ticketAbi } from '@/lib/ticket-abi';

// contractAddress는 함수 내에서 동적으로 가져옴

// Sepolia는 Alchemy 스마트 월렛을 사용하고, 로컬(31337)은 Anvil 계정을 사용합니다.
const SEPOLIA_CHAIN_ID = 11155111;

export async function POST() {
  try {
    const publicClient = getPublicClient();
    const chainId = getChainId();
    const contractAddress = await getContractAddress();
    const toAddress = (process.env.MINT_TARGET_ADDRESS as `0x${string}`) ?? '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

    const encodedMintData = encodeFunctionData({
      abi: ticketAbi,
      functionName: 'mint',
      args: [toAddress],
    });

    let receipt;

    if (chainId === SEPOLIA_CHAIN_ID && isAlchemySmartWalletEnabled()) {
      const smartAccountClient = await getAlchemySmartAccountClient();
      const { hash: userOpHash } = await smartAccountClient.sendUserOperation({
        uo: {
          target: contractAddress as `0x${string}`,
          data: encodedMintData,
        },
      });

      const onChainHash = await smartAccountClient.waitForUserOperationTransaction({ hash: userOpHash });
      receipt = await publicClient.waitForTransactionReceipt({ hash: onChainHash });
    } else {
      const privateKey = (process.env.ANVIL_PRIVATE_KEY as `0x${string}`) || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
      const account = privateKeyToAccount(privateKey);
      const walletClient = getWalletClient(account);

      const { request } = await publicClient.simulateContract({
        account,
        address: contractAddress as `0x${string}`,
        abi: ticketAbi,
        functionName: 'mint',
        args: [toAddress],
      });

      const hash = await walletClient.writeContract(request);
      receipt = await publicClient.waitForTransactionReceipt({ hash });
    }

    const decodedLog = decodeEventLog({
      abi: ticketAbi,
      data: receipt.logs[0].data,
      topics: receipt.logs[0].topics,
    });

    const tokenId = (decodedLog.args as unknown as { tokenId: bigint }).tokenId;

    return NextResponse.json({
      success: true,
      transactionHash: receipt.transactionHash,
      tokenId: tokenId.toString(),
      to: toAddress,
      blockNumber: receipt.blockNumber.toString(),
    });
  } catch (error) {
    console.error(error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
