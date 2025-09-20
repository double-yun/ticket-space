import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json()

    if (!code) {
      return NextResponse.json(
        { error: 'Authorization code가 필요합니다' },
        { status: 400 }
      )
    }

    // 1. 카카오 액세스 토큰 요청
    const tokenResponse = await fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: '13ee2e0978370b66ed83f6c35e511a93',
        redirect_uri: 'com.ticketing.app://oauth',
        code: code,
      }),
    })

    if (!tokenResponse.ok) {
      throw new Error('토큰 요청 실패')
    }

    const tokenData = await tokenResponse.json()
    const accessToken = tokenData.access_token

    // 2. 카카오 사용자 정보 요청
    const userResponse = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
      },
    })

    if (!userResponse.ok) {
      throw new Error('사용자 정보 요청 실패')
    }

    const userData = await userResponse.json()

    // 3. 사용자 정보 추출
    const kakaoId = userData.id.toString()
    const nickname = userData.properties?.nickname || userData.kakao_account?.profile?.nickname
    const email = userData.kakao_account?.email

    // 전화번호는 카카오 API에서 직접 제공하지 않으므로 별도 처리 필요
    // 실제 구현에서는 카카오 비즈니스 계정이나 다른 방법으로 전화번호를 얻어야 함
    // 여기서는 임시로 처리
    const phoneNumber = userData.kakao_account?.phone_number || null

    return NextResponse.json({
      success: true,
      kakaoId,
      nickname,
      email,
      phoneNumber, // 실제로는 null일 가능성이 높음
    })

  } catch (error) {
    console.error('카카오 앱 콜백 처리 실패:', error)
    return NextResponse.json(
      { error: '카카오 로그인 처리에 실패했습니다' },
      { status: 500 }
    )
  }
}