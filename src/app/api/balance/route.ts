import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http } from 'viem';
import { anvil } from 'viem/chains';

const contractAbi = [{"type":"function","name":"balanceOf","inputs":[{"name":"owner","type":"address","internalType":"address"}],"outputs":[{"name":"","type":"uint256","internalType":"uint256"}],"stateMutability":"view"},{"type":"function","name":"totalSupply","inputs":[],"outputs":[{"name":"","type":"uint256","internalType":"uint256"}],"stateMutability":"view"}];

const contractAddress = '0x5FbDB2315678afecb367f032d93F642f64180aa3';

const publicClient = createPublicClient({
  chain: anvil,
  transport: http(),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');

    if (!address) {
      return NextResponse.json({ success: false, error: 'Address required' }, { status: 400 });
    }

    const [ethBalance, nftBalance, totalSupply] = await Promise.all([
      publicClient.getBalance({ address: address as `0x${string}` }),
      publicClient.readContract({
        address: contractAddress,
        abi: contractAbi,
        functionName: 'balanceOf',
        args: [address as `0x${string}`],
      }),
      publicClient.readContract({
        address: contractAddress,
        abi: contractAbi,
        functionName: 'totalSupply',
      }),
    ]);

    return NextResponse.json({
      success: true,
      address,
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