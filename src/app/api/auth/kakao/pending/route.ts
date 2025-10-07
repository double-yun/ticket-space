import { NextRequest, NextResponse } from 'next/server'
import { getPendingKakaoData, clearPendingKakaoData, setPendingKakaoData } from '@/lib/auth/kakao-pending'
import type { PendingKakaoData } from '@/lib/auth/kakao-pending'

export async function GET() {
  try {
    const data = await getPendingKakaoData()

    if (!data) {
      return NextResponse.json(
        { error: 'No pending registration data found' },
        { status: 404 }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Failed to get pending kakao data:', error)
    return NextResponse.json(
      { error: 'Failed to get pending data' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const data: PendingKakaoData = await request.json()

    // 필수 필드 검증
    if (!data.kakaoData || !data.accessToken) {
      return NextResponse.json(
        { error: 'Invalid pending data' },
        { status: 400 }
      )
    }

    await setPendingKakaoData(data)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to set pending kakao data:', error)
    return NextResponse.json(
      { error: 'Failed to set pending data' },
      { status: 500 }
    )
  }
}

export async function DELETE() {
  try {
    await clearPendingKakaoData()
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to clear pending kakao data:', error)
    return NextResponse.json(
      { error: 'Failed to clear pending data' },
      { status: 500 }
    )
  }
}
