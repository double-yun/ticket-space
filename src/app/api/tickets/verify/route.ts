import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { decrypt, getEncryptionKey } from '@/lib/crypto/encryption'

interface QRCodeData {
  tokenId: string
  ticketName: string
  transactionHash: string
  purchaseDate: string
  used: boolean
  userId: string  // 추가: 현재 사용하려는 사용자 ID
  timestamp: number
}

export async function POST(request: NextRequest) {
  try {
    const body: QRCodeData = await request.json()
    const { tokenId, transactionHash, userId, timestamp } = body

    // 1. 기본 데이터 검증
    if (!tokenId || !transactionHash || !userId || !timestamp) {
      return NextResponse.json(
        {
          success: false,
          message: '필수 정보가 누락되었습니다.',
        },
        { status: 400 }
      )
    }

    // 2. 타임스탬프 검증 (15초 윈도우)
    const currentTime = Date.now()
    const timeDiff = Math.abs(currentTime - timestamp)
    const FIFTEEN_SECONDS = 15 * 1000

    if (timeDiff > FIFTEEN_SECONDS) {
      return NextResponse.json(
        {
          success: false,
          message: 'QR 코드가 만료되었습니다. 새로 고침 후 다시 시도해주세요.',
        },
        { status: 400 }
      )
    }

    // 3. DB에서 티켓 확인
    const ticket = await prisma.ticket.findFirst({
      where: {
        tokenId: BigInt(tokenId),
        txHash: transactionHash,
      },
      include: {
        event: true,
        user: true,
      },
    })

    if (!ticket) {
      return NextResponse.json(
        {
          success: false,
          message: '유효하지 않은 티켓입니다.',
        },
        { status: 404 }
      )
    }

    // 4. 이미 사용된 티켓인지 확인
    if (ticket.used) {
      return NextResponse.json(
        {
          success: false,
          message: `이미 사용된 티켓입니다. (사용일시: ${new Date(
            ticket.updatedAt
          ).toLocaleString('ko-KR')})`,
        },
        { status: 400 }
      )
    }

    // 5. 공개키 검증 (핵심 로직)
    if (ticket.encryptedPublicKey) {
      // 현재 사용자의 공개키 조회
      const currentUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { publicKey: true },
      })

      if (!currentUser || !currentUser.publicKey) {
        return NextResponse.json(
          {
            success: false,
            message: '사용자의 공개키를 찾을 수 없습니다.',
          },
          { status: 400 }
        )
      }

      try {
        // 티켓에 저장된 암호화된 공개키 복호화
        const encryptionKey = getEncryptionKey()
        const originalPublicKey = decrypt(ticket.encryptedPublicKey, encryptionKey)

        // 현재 사용자의 공개키와 비교
        if (originalPublicKey !== currentUser.publicKey) {
          return NextResponse.json(
            {
              success: false,
              message: '계정이 변경되어 이 티켓을 사용할 수 없습니다. 티켓을 구매한 원래 기기에서만 사용 가능합니다.',
            },
            { status: 403 }
          )
        }
      } catch (error) {
        console.error('공개키 복호화 실패:', error)
        return NextResponse.json(
          {
            success: false,
            message: '티켓 검증 중 오류가 발생했습니다.',
          },
          { status: 500 }
        )
      }
    }

    // 6. 티켓 사용 처리
    await prisma.ticket.update({
      where: {
        id: ticket.id,
      },
      data: {
        used: true,
        updatedAt: new Date(),
      },
    })

    // 7. 성공 응답
    return NextResponse.json({
      success: true,
      message: '티켓 검증 완료! 입장 가능합니다.',
      ticket: {
        name: ticket.event.title,
        tokenId: ticket.tokenId?.toString() || tokenId,
        transactionHash: ticket.txHash || transactionHash,
      },
    })
  } catch (error) {
    console.error('티켓 검증 실패:', error)
    return NextResponse.json(
      {
        success: false,
        message: '티켓 검증 중 오류가 발생했습니다.',
      },
      { status: 500 }
    )
  }
}