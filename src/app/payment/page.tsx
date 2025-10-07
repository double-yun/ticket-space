'use client';

export const dynamic = 'force-dynamic';

import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import * as PortOne from '@portone/browser-sdk/v2';

const PORTONE_STORE_ID = process.env.NEXT_PUBLIC_PORTONE_STORE_ID;
const PORTONE_CHANNEL_KEY = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY;
const PORTONE_DEFAULT_ORDER_NAME = '지갑 충전';
const PORTONE_DEFAULT_TOPUP_AMOUNT = 1000;

function PaymentPageContent() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const initPayment = async () => {
      // URL 파라미터에서 결제 정보 가져오기
      const paymentId = searchParams.get('paymentId');
      const storeId = searchParams.get('storeId') ?? PORTONE_STORE_ID;
      const channelKey = searchParams.get('channelKey') ?? PORTONE_CHANNEL_KEY;
      const orderName = searchParams.get('orderName') ?? PORTONE_DEFAULT_ORDER_NAME;
      const totalAmountParam = searchParams.get('totalAmount');
      const totalAmount = totalAmountParam ? Number(totalAmountParam) : PORTONE_DEFAULT_TOPUP_AMOUNT;

      if (!paymentId || !storeId || !channelKey) {
        console.error('Required payment parameters missing');
        return;
      }

      if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
        console.error('Invalid PortOne payment amount', totalAmount);
        return;
      }

      try {
        // from_app 파라미터를 리다이렉트 URL에 전달
        const fromApp = searchParams.get('from_app');
        const redirectUrl = new URL('/payment-redirect', location.origin);
        if (fromApp === 'true') {
          redirectUrl.searchParams.set('from_app', 'true');
        }

        // PortOne 결제 요청
        const resp = await PortOne.requestPayment({
          storeId: storeId,
          channelKey: channelKey,
          paymentId: paymentId,
          orderName,
          totalAmount,
          currency: 'CURRENCY_KRW',
          payMethod: 'CARD',
          redirectUrl: redirectUrl.toString(),
        });

        // 결제 실패 시 처리
        if (resp && resp.code !== undefined) {
          // 에러 정보를 포함하여 리다이렉트
          const errorUrl = new URL('/payment-redirect', location.origin);
          errorUrl.searchParams.set('code', resp.code ?? 'UNKNOWN');
          errorUrl.searchParams.set('message', resp.message || '결제가 취소되었습니다.');
          window.location.href = errorUrl.toString();
        }
      } catch (error) {
        console.error('Payment initialization failed:', error);
        // 에러 발생 시 리다이렉트
        const errorUrl = new URL('/payment-redirect', location.origin);
        errorUrl.searchParams.set('code', 'ERROR');
        errorUrl.searchParams.set('message', '결제 초기화에 실패했습니다.');
        window.location.href = errorUrl.toString();
      }
    };

    // 페이지 로드 시 자동으로 결제 시작
    initPayment();
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
        <p className="text-lg">결제 페이지로 이동 중...</p>
      </div>
    </div>
  );
}

export default function PaymentPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
            <p className="text-lg">결제 페이지로 이동 중...</p>
          </div>
        </div>
      }
    >
      <PaymentPageContent />
    </Suspense>
  );
}
