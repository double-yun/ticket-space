import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import {
  createWalletClient,
  http,
  createPublicClient,
  decodeEventLog,
  parseEther,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { anvil } from 'viem/chains'

const contractAbi = [{"type":"function","name":"balanceOf","inputs":[{"name":"owner","type":"address","internalType":"address"}],"outputs":[{"name":"","type":"uint256","internalType":"uint256"}],"stateMutability":"view"},{"type":"function","name":"balances","inputs":[{"name":"owner","type":"address","internalType":"address"}],"outputs":[{"name":"","type":"uint256","internalType":"uint256"}],"stateMutability":"view"},{"type":"function","name":"mint","inputs":[{"name":"to","type":"address","internalType":"address"}],"outputs":[{"name":"","type":"uint256","internalType":"uint256"}],"stateMutability":"nonpayable"},{"type":"function","name":"ownerOf","inputs":[{"name":"tokenId","type":"uint256","internalType":"uint256"}],"outputs":[{"name":"","type":"address","internalType":"address"}],"stateMutability":"view"},{"type":"function","name":"owners","inputs":[{"name":"","type":"uint256","internalType":"uint256"}],"outputs":[{"name":"","type":"address","internalType":"address"}],"stateMutability":"view"},{"type":"function","name":"totalSupply","inputs":[],"outputs":[{"name":"","type":"uint256","internalType":"uint256"}],"stateMutability":"view"},{"type":"event","name":"Transfer","inputs":[{"name":"from","type":"address","indexed":true,"internalType":"address"},{"name":"to","type":"address","indexed":true,"internalType":"address"},{"name":"tokenId","type":"uint256","indexed":true,"internalType":"uint256"}],"anonymous":false}]

const contractAddress = '0x5FbDB2315678afecb367f032d93F642f64180aa3'

export async function POST(request: NextRequest) {
  try {
    const { ticketId } = await request.json()

    // 세션 확인
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session_token')?.value

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const session = await prisma.session.findUnique({
      where: { sessionToken },
      include: { user: true },
    })

    if (!session || session.expires < new Date()) {
      return NextResponse.json({ error: 'Session expired' }, { status: 401 })
    }

    // 티켓 정보 조회
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
    })

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    if (ticket.currentSupply >= ticket.maxSupply) {
      return NextResponse.json({ error: 'Ticket sold out' }, { status: 400 })
    }

    const user = session.user

    // 사용자 지갑이 없으면 에러
    if (!user.walletAddress || !user.privateKeyHash) {
      return NextResponse.json({ error: 'User wallet not found' }, { status: 400 })
    }

    // 사용자 지갑 잔액 확인
    const publicClient = createPublicClient({
      chain: anvil,
      transport: http(),
    })

    const userBalance = await publicClient.getBalance({
      address: user.walletAddress as `0x${string}`,
    })

    const ticketPrice = parseEther((parseFloat(ticket.price) / 1e18).toString())

    if (userBalance < ticketPrice) {
      return NextResponse.json({
        error: `잔액이 부족합니다. 필요: ${(parseFloat(ticket.price) / 1e18).toFixed(3)} ETH, 보유: ${(Number(userBalance) / 1e18).toFixed(4)} ETH`
      }, { status: 400 })
    }

    // 사용자 지갑에서 서버로 결제 (실제로는 사용자가 직접 트랜잭션 서명해야 함)
    // MVP에서는 서버가 사용자 대신 결제
    const userPrivateKey = user.privateKeyHash as `0x${string}` // 실제로는 복호화 필요
    const userAccount = privateKeyToAccount(userPrivateKey)

    const userWalletClient = createWalletClient({
      account: userAccount,
      chain: anvil,
      transport: http(),
    })

    // 서버 지갑으로 NFT 발행
    const serverPrivateKey = process.env.PRIVATE_KEY as `0x${string}` || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
    const serverAccount = privateKeyToAccount(serverPrivateKey)

    const walletClient = createWalletClient({
      account: serverAccount,
      chain: anvil,
      transport: http(),
    })

    // NFT 발행 (사용자 지갑 주소로)
    const { request: contractRequest } = await publicClient.simulateContract({
      account: serverAccount,
      address: contractAddress,
      abi: contractAbi,
      functionName: 'mint',
      args: [user.walletAddress as `0x${string}`],
    })

    const hash = await walletClient.writeContract(contractRequest)
    const receipt = await publicClient.waitForTransactionReceipt({ hash })

    // 이벤트 로그에서 토큰 ID 추출
    const decodedLog = decodeEventLog({
      abi: contractAbi,
      data: receipt.logs[0].data,
      topics: receipt.logs[0].topics,
    })

    const tokenId = (decodedLog.args as unknown as { tokenId: bigint }).tokenId

    // 구매 기록 저장
    const purchase = await prisma.purchase.create({
      data: {
        userId: user.id,
        ticketId: ticket.id,
        transactionHash: receipt.transactionHash,
        tokenId: tokenId.toString(),
      },
    })

    // 티켓 판매량 증가
    await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        currentSupply: {
          increment: 1,
        },
      },
    })

    return NextResponse.json({
      success: true,
      purchase: {
        id: purchase.id,
        transactionHash: receipt.transactionHash,
        tokenId: tokenId.toString(),
        blockNumber: receipt.blockNumber.toString(),
        ticket: ticket,
      },
    })

  } catch (error) {
    console.error('Purchase error:', error)
    return NextResponse.json(
      { error: 'Purchase failed' },
      { status: 500 }
    )
  }
}