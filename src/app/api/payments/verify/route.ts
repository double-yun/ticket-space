import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const PORTONE_API_URL = 'https://api.iamport.kr';
const PORTONE_API_KEY = process.env.PORTONE_API_KEY;
const PORTONE_API_SECRET = process.env.PORTONE_API_SECRET;

async function getPortoneAccessToken() {
  try {
    const response = await axios.post(`${PORTONE_API_URL}/users/getToken`, {
      imp_key: PORTONE_API_KEY,
      imp_secret: PORTONE_API_SECRET,
    });

    if (response.data.code === 0) {
      return response.data.response.access_token;
    } else {
      throw new Error(response.data.message || '포트원 토큰 발급 실패');
    }
  } catch (error) {
    console.error('포트원 토큰 발급 오류:', error);
    throw error;
  }
}

async function getPaymentInfo(impUid: string, accessToken: string) {
  try {
    const response = await axios.get(
      `${PORTONE_API_URL}/payments/${impUid}`,
      {
        headers: {
          Authorization: accessToken,
        },
      }
    );

    if (response.data.code === 0) {
      return response.data.response;
    } else {
      throw new Error(response.data.message || '결제 정보 조회 실패');
    }
  } catch (error) {
    console.error('결제 정보 조회 오류:', error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imp_uid, merchant_uid, amount } = body;

    if (!imp_uid || !merchant_uid) {
      return NextResponse.json(
        { success: false, error: '필수 파라미터가 누락되었습니다.' },
        { status: 400 }
      );
    }

    if (!PORTONE_API_KEY || !PORTONE_API_SECRET) {
      console.error('포트원 API 키가 설정되지 않았습니다.');
      return NextResponse.json(
        { success: false, error: '서버 설정 오류' },
        { status: 500 }
      );
    }

    const accessToken = await getPortoneAccessToken();
    const paymentData = await getPaymentInfo(imp_uid, accessToken);

    if (paymentData.status !== 'paid') {
      return NextResponse.json(
        {
          success: false,
          error: '결제가 완료되지 않았습니다.',
          status: paymentData.status
        },
        { status: 400 }
      );
    }

    if (amount && paymentData.amount !== amount) {
      return NextResponse.json(
        {
          success: false,
          error: '결제 금액이 일치하지 않습니다.',
          expected: amount,
          actual: paymentData.amount
        },
        { status: 400 }
      );
    }

    if (paymentData.merchant_uid !== merchant_uid) {
      return NextResponse.json(
        {
          success: false,
          error: '주문번호가 일치하지 않습니다.'
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        imp_uid: paymentData.imp_uid,
        merchant_uid: paymentData.merchant_uid,
        amount: paymentData.amount,
        status: paymentData.status,
        pay_method: paymentData.pay_method,
        pg_provider: paymentData.pg_provider,
        pg_tid: paymentData.pg_tid,
        buyer_name: paymentData.buyer_name,
        buyer_email: paymentData.buyer_email,
        buyer_tel: paymentData.buyer_tel,
        paid_at: paymentData.paid_at,
        receipt_url: paymentData.receipt_url,
        card_name: paymentData.card_name,
        bank_name: paymentData.bank_name,
        card_number: paymentData.card_number,
      },
    });
  } catch (error) {
    console.error('결제 검증 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '결제 검증 중 오류가 발생했습니다.'
      },
      { status: 500 }
    );
  }
}