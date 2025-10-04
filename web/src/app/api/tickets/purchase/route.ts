import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { decodeEventLog, encodeFunctionData, parseEther } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { getChainId, getContractAddress, getPublicClient, getWalletClient } from '@/lib/blockchain'
import { getAlchemySmartAccountClient, getSmartAccountAddress, isAlchemySmartWalletEnabled } from '@/lib/blockchain/alchemy-smart-wallet'
import { ticketAbi } from '@/lib/blockchain/ticket-abi'

const SEPOLIA_CHAIN_ID = 11155111

// contractAddress는 함수 내에서 동적으로 가져옴

export async function POST(request: NextRequest) {
  try {
    const { ticketId } = await request.json()

    // 동적으로 컨트랙트 주소 가져오기
    const contractAddress = await getContractAddress()

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
    const publicClient = getPublicClient()
    const chainId = getChainId()

    const userBalance = await publicClient.getBalance({
      address: user.walletAddress as `0x${string}`,
    })

    const ticketPrice = parseEther((parseFloat(ticket.price) / 1e18).toString())

    if (userBalance < ticketPrice) {
      return NextResponse.json({
        error: `잔액이 부족합니다. 필요: ${(parseFloat(ticket.price) / 1e18).toFixed(3)} ETH, 보유: ${(Number(userBalance) / 1e18).toFixed(4)} ETH`
      }, { status: 400 })
    }

    // Mint 호출을 위한 데이터만 준비 (실제 결제는 아래에서 사용자 지갑으로 처리)
    const encodedMintData = encodeFunctionData({
      abi: ticketAbi,
      functionName: 'mint',
      args: [user.walletAddress as `0x${string}`],
    })

    let receipt
    let paymentReceipt

    let contractOwner: `0x${string}`
    try {
      contractOwner = await publicClient.readContract({
        address: contractAddress as `0x${string}`,
        abi: ticketAbi,
        functionName: 'owner',
      }) as `0x${string}`
    } catch (error) {
      console.error('Failed to read ticket contract owner.', error)
      return NextResponse.json(
        { error: '티켓 컨트랙트의 소유자 정보를 확인할 수 없습니다. 배포 주소와 RPC 설정을 점검해주세요.' },
        { status: 500 },
      )
    }

    const shouldAttemptSmartWallet = chainId === SEPOLIA_CHAIN_ID && isAlchemySmartWalletEnabled()
    let useSmartWallet = false

    if (shouldAttemptSmartWallet) {
      try {
        const smartAccountAddress = await getSmartAccountAddress()

        if (smartAccountAddress && contractOwner.toLowerCase() === smartAccountAddress.toLowerCase()) {
          useSmartWallet = true
        } else {
          console.warn(
            `Smart wallet ${smartAccountAddress ?? 'unknown'} is not the contract owner ${contractOwner}. Falling back to server wallet for mint.`,
          )
        }
      } catch (error) {
        console.warn('Failed to verify smart wallet ownership. Falling back to server wallet.', error)
      }
    }

    const userPrivateKey = user.privateKeyHash as `0x${string}`
    const userAccount = privateKeyToAccount(userPrivateKey)

    if (userAccount.address.toLowerCase() !== (user.walletAddress as string).toLowerCase()) {
      console.error(
        `Stored wallet ${user.walletAddress} does not match derived account address ${userAccount.address}.`
      )
      return NextResponse.json({ error: '지갑 정보가 일치하지 않습니다. 관리자에게 문의해주세요.' }, { status: 500 })
    }

    const userWalletClient = getWalletClient(userAccount)

    try {
      const paymentHash = await userWalletClient.sendTransaction({
        to: contractOwner,
        value: ticketPrice,
      })

      paymentReceipt = await publicClient.waitForTransactionReceipt({ hash: paymentHash })
    } catch (error) {
      console.error('Failed to transfer ticket price from user wallet.', error)
      return NextResponse.json(
        { error: '티켓 금액 전송에 실패했습니다. 잔액과 가스 비용을 확인해주세요.' },
        { status: 500 },
      )
    }

    if (useSmartWallet) {
      const smartAccountClient = await getAlchemySmartAccountClient()
      const { hash: userOpHash } = await smartAccountClient.sendUserOperation({
        uo: {
          target: contractAddress as `0x${string}`,
          data: encodedMintData,
        },
      })

      const onChainHash = await smartAccountClient.waitForUserOperationTransaction({ hash: userOpHash })
      receipt = await publicClient.waitForTransactionReceipt({ hash: onChainHash })
    } else {
      const serverPrivateKey = process.env.PRIVATE_KEY as `0x${string}` | undefined

      if (!serverPrivateKey) {
        throw new Error('Set PRIVATE_KEY to execute mint transactions when the Alchemy smart wallet is disabled.')
      }

      const serverAccount = privateKeyToAccount(serverPrivateKey)
      const walletClient = getWalletClient(serverAccount)

      if (contractOwner.toLowerCase() !== serverAccount.address.toLowerCase()) {
        console.error(
          `Server wallet ${serverAccount.address} is not the ticket contract owner ${contractOwner}. Cannot execute mint.`,
        )
        return NextResponse.json(
          {
            error: '서버 지갑이 티켓 컨트랙트의 소유자가 아닙니다. PRIVATE_KEY 환경변수를 컨트랙트 소유자 키로 설정하거나 소유권을 이전해주세요.',
          },
          { status: 500 },
        )
      }

      const { request: contractRequest } = await publicClient.simulateContract({
        account: serverAccount,
        address: contractAddress as `0x${string}`,
        abi: ticketAbi,
        functionName: 'mint',
        args: [user.walletAddress as `0x${string}`],
      })

      const hash = await walletClient.writeContract(contractRequest)
      receipt = await publicClient.waitForTransactionReceipt({ hash })
    }

    // 이벤트 로그에서 토큰 ID 추출
    const decodedLog = decodeEventLog({
      abi: ticketAbi,
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
      payment: paymentReceipt
        ? {
            transactionHash: paymentReceipt.transactionHash,
            blockNumber: paymentReceipt.blockNumber.toString(),
          }
        : undefined,
    })

  } catch (error) {
    console.error('Purchase error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Purchase failed'
    return NextResponse.json(
      { error: `Purchase failed: ${errorMessage}` },
      { status: 500 }
    )
  }
}
