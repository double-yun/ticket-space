import { NextResponse } from 'next/server';
import { createPublicClient, http, decodeEventLog } from 'viem';
import { anvil } from 'viem/chains';

const contractAbi = [{"type":"event","name":"Transfer","inputs":[{"name":"from","type":"address","indexed":true,"internalType":"address"},{"name":"to","type":"address","indexed":true,"internalType":"address"},{"name":"tokenId","type":"uint256","indexed":true,"internalType":"uint256"}],"anonymous":false}];

const contractAddress = '0x5FbDB2315678afecb367f032d93F642f64180aa3';

const publicClient = createPublicClient({
  chain: anvil,
  transport: http(),
});

export async function GET() {
  try {
    const currentBlock = await publicClient.getBlockNumber();

    const logs = await publicClient.getLogs({
      address: contractAddress,
      event: {
        type: 'event',
        name: 'Transfer',
        inputs: [
          { name: 'from', type: 'address', indexed: true },
          { name: 'to', type: 'address', indexed: true },
          { name: 'tokenId', type: 'uint256', indexed: true },
        ],
      },
      fromBlock: BigInt(0),
      toBlock: currentBlock,
    });

    const transactions = logs.map((log) => {
      const decoded = decodeEventLog({
        abi: contractAbi,
        data: log.data,
        topics: log.topics,
      });

      const args = decoded.args as unknown as { from: string; to: string; tokenId: bigint };

      return {
        transactionHash: log.transactionHash,
        blockNumber: log.blockNumber?.toString(),
        from: args.from,
        to: args.to,
        tokenId: args.tokenId.toString(),
        type: args.from === '0x0000000000000000000000000000000000000000' ? 'mint' : 'transfer',
      };
    });

    return NextResponse.json({
      success: true,
      transactions: transactions.reverse(), // 최신 거래부터
      count: transactions.length,
    });
  } catch (error) {
    console.error(error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}