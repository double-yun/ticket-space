import { NextResponse } from 'next/server';
import { decodeEventLog } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { getContractAddress, getPublicClient, getWalletClient } from '@/lib/blockchain';
import { ticketAbi } from '@/lib/ticket-abi';

// contractAddress는 함수 내에서 동적으로 가져옴

// The private key of the deployer account from Anvil
// Make sure to use environment variables in a real application
const privateKey = process.env.ANVIL_PRIVATE_KEY as `0x${string}` || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const account = privateKeyToAccount(privateKey);

// The address to mint the NFT to (Anvil's second account)
const toAddress = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

// Create a wallet client to send transactions
const walletClient = getWalletClient(account);

// Create a public client to read from the blockchain
const publicClient = getPublicClient();

export async function POST() {
  try {
    // 동적으로 컨트랙트 주소 가져오기
    const contractAddress = await getContractAddress();
    const { request } = await publicClient.simulateContract({
      account,
      address: contractAddress,
      abi: ticketAbi,
      functionName: 'mint',
      args: [toAddress],
    });

    const hash = await walletClient.writeContract(request);

    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    const transferLog = receipt.logs.find(
        (log: any) => log.eventName === 'Transfer'
    );

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
