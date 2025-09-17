import { NextResponse } from 'next/server';
import { decodeEventLog } from 'viem';
import { getContractAddress, getPublicClient } from '@/lib/blockchain';

const contractAbi = [{"type":"event","name":"Transfer","inputs":[{"name":"from","type":"address","indexed":true,"internalType":"address"},{"name":"to","type":"address","indexed":true,"internalType":"address"},{"name":"tokenId","type":"uint256","indexed":true,"internalType":"uint256"}],"anonymous":false}];

// contractAddress는 함수 내에서 동적으로 가져옴

const publicClient = getPublicClient();

export async function GET() {
  try {
    // 동적으로 컨트랙트 주소 가져오기
    const contractAddress = await getContractAddress();
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
