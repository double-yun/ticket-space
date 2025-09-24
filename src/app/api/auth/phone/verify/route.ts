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

async function getCertificationInfo(impUid: string, accessToken: string) {
  try {
    const response = await axios.get(
      `${PORTONE_API_URL}/certifications/${impUid}`,
      {
        headers: {
          Authorization: accessToken,
        },
      }
    );

    if (response.data.code === 0) {
      return response.data.response;
    } else {
      throw new Error(response.data.message || '본인인증 정보 조회 실패');
    }
  } catch (error) {
    console.error('본인인증 정보 조회 오류:', error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imp_uid, merchant_uid } = body;

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
    const certificationData = await getCertificationInfo(imp_uid, accessToken);

    if (!certificationData.certified) {
      return NextResponse.json(
        {
          success: false,
          error: '본인인증이 완료되지 않았습니다.'
        },
        { status: 400 }
      );
    }

    if (certificationData.merchant_uid !== merchant_uid) {
      return NextResponse.json(
        {
          success: false,
          error: '인증번호가 일치하지 않습니다.'
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        imp_uid: certificationData.imp_uid,
        merchant_uid: certificationData.merchant_uid,
        pg_provider: certificationData.pg_provider,
        pg_tid: certificationData.pg_tid,
        name: certificationData.name,
        gender: certificationData.gender,
        birth: certificationData.birth,
        phone: certificationData.phone,
        carrier: certificationData.carrier,
        certified: certificationData.certified,
        certified_at: certificationData.certified_at,
        unique_key: certificationData.unique_key,
        unique_in_site: certificationData.unique_in_site,
        foreigner: certificationData.foreigner,
        foreigner_v2: certificationData.foreigner_v2,
      },
    });
  } catch (error) {
    console.error('본인인증 검증 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '본인인증 검증 중 오류가 발생했습니다.'
      },
      { status: 500 }
    );
  }
}