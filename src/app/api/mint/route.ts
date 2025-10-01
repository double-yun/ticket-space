
import { NextResponse } from 'next/server';
import {
  createWalletClient,
  http,
  createPublicClient,
  decodeEventLog,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { anvil } from 'viem/chains';

// The ABI from the compiled contract
const contractAbi = [{"type":"function","name":"balanceOf","inputs":[{"name":"owner","type":"address","internalType":"address"}],"outputs":[{"name":"","type":"uint256","internalType":"uint256"}],"stateMutability":"view"},{"type":"function","name":"balances","inputs":[{"name":"owner","type":"address","internalType":"address"}],"outputs":[{"name":"","type":"uint256","internalType":"uint256"}],"stateMutability":"view"},{"type":"function","name":"mint","inputs":[{"name":"to","type":"address","internalType":"address"}],"outputs":[{"name":"","type":"uint256","internalType":"uint256"}],"stateMutability":"nonpayable"},{"type":"function","name":"ownerOf","inputs":[{"name":"tokenId","type":"uint256","internalType":"uint256"}],"outputs":[{"name":"","type":"address","internalType":"address"}],"stateMutability":"view"},{"type":"function","name":"owners","inputs":[{"name":"","type":"uint256","internalType":"uint256"}],"outputs":[{"name":"","type":"address","internalType":"address"}],"stateMutability":"view"},{"type":"function","name":"totalSupply","inputs":[],"outputs":[{"name":"","type":"uint256","internalType":"uint256"}],"stateMutability":"view"},{"type":"event","name":"Transfer","inputs":[{"name":"from","type":"address","indexed":true,"internalType":"address"},{"name":"to","type":"address","indexed":true,"internalType":"address"},{"name":"tokenId","type":"uint256","indexed":true,"internalType":"uint256"}],"anonymous":false}];

const contractAddress = '0x5FbDB2315678afecb367f032d93F642f64180aa3';

// The private key of the deployer account from Anvil
// Make sure to use environment variables in a real application
const privateKey = process.env.ANVIL_PRIVATE_KEY as `0x${string}` || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const account = privateKeyToAccount(privateKey);

// The address to mint the NFT to (Anvil's second account)
const toAddress = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

// Create a wallet client to send transactions
const walletClient = createWalletClient({
  account,
  chain: anvil,
  transport: http(), // Defaults to http://127.0.0.1:8545
});

// Create a public client to read from the blockchain
const publicClient = createPublicClient({
  chain: anvil,
  transport: http(), // Defaults to http://127.0.0.1:8545
});

export async function POST() {
  try {
    const { request } = await publicClient.simulateContract({
      account,
      address: contractAddress,
      abi: contractAbi,
      functionName: 'mint',
      args: [toAddress],
    });

    const hash = await walletClient.writeContract(request);

    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    const transferLog = receipt.logs.find(
        (log: any) => log.eventName === 'Transfer'
    );
    
    const decodedLog = decodeEventLog({
        abi: contractAbi,
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
