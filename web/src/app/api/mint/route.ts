import { NextResponse } from 'next/server';
import { decodeEventLog, encodeFunctionData } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { getChainId, getContractAddress, getPublicClient, getWalletClient } from '@/lib/blockchain';
import { getAlchemySmartAccountClient, isAlchemySmartWalletEnabled } from '@/lib/blockchain/alchemy-smart-wallet';
import { ticketAbi } from '@/lib/blockchain/ticket-abi';

// contractAddress는 함수 내에서 동적으로 가져옴
const SEPOLIA_CHAIN_ID = 11155111;

export async function POST() {
  try {
    const publicClient = getPublicClient();
    const chainId = getChainId();
    const contractAddress = await getContractAddress();
    const toAddress = process.env.MINT_TARGET_ADDRESS as `0x${string}` | undefined;

    if (!toAddress) {
      throw new Error('Set MINT_TARGET_ADDRESS to execute mint requests.');
    }

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
      const privateKey = process.env.PRIVATE_KEY as `0x${string}` | undefined;

      if (!privateKey) {
        throw new Error('Set PRIVATE_KEY to submit mint transactions without the Alchemy smart wallet.');
      }

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
