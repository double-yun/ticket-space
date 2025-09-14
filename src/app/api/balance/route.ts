import { NextResponse } from 'next/server';
import { createPublicClient, http } from 'viem';
import { anvil } from 'viem/chains';

const contractAbi = [{"type":"function","name":"balanceOf","inputs":[{"name":"owner","type":"address","internalType":"address"}],"outputs":[{"name":"","type":"uint256","internalType":"uint256"}],"stateMutability":"view"},{"type":"function","name":"totalSupply","inputs":[],"outputs":[{"name":"","type":"uint256","internalType":"uint256"}],"stateMutability":"view"}];

const contractAddress = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
const targetAddress = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

const publicClient = createPublicClient({
  chain: anvil,
  transport: http(),
});

export async function GET() {
  try {
    const [ethBalance, nftBalance, totalSupply] = await Promise.all([
      publicClient.getBalance({ address: targetAddress }),
      publicClient.readContract({
        address: contractAddress,
        abi: contractAbi,
        functionName: 'balanceOf',
        args: [targetAddress],
      }),
      publicClient.readContract({
        address: contractAddress,
        abi: contractAbi,
        functionName: 'totalSupply',
      }),
    ]);

    return NextResponse.json({
      success: true,
      address: targetAddress,
      ethBalance: (Number(ethBalance) / 1e18).toFixed(4),
      nftBalance: (nftBalance as bigint).toString(),
      totalSupply: (totalSupply as bigint).toString(),
    });
  } catch (error) {
    console.error(error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}