'use client';

export const dynamic = 'force-dynamic';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import * as PortOne from '@portone/browser-sdk/v2';

function PaymentPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [message, setMessage] = useState('결제 준비 중...');

  useEffect(() => {
    const initPayment = async () => {
      const paymentId = searchParams.get('paymentId');
      const storeId = searchParams.get('storeId');
      const channelKey = searchParams.get('channelKey');
      const orderName = searchParams.get('orderName');
      const totalAmount = searchParams.get('totalAmount');
      const returnUrl = searchParams.get('returnUrl') || '/';

      if (!paymentId || !storeId || !channelKey) {
        console.error('Required payment parameters missing');
        setMessage('결제 정보가 없습니다.');
        return;
      }

      const isCapacitorApp = Capacitor.isNativePlatform();

      if (isCapacitorApp) {
        // Capacitor 앱: 커스텀 URL 스킴으로 리다이렉트
        setMessage('결제 창을 여는 중...');

        // PortOne 리다이렉트 URL을 커스텀 스킴으로 설정
        const redirectUrl = `ticketspace://payment-result?paymentId=${paymentId}&returnUrl=${encodeURIComponent(returnUrl)}`;

        try {
          // PortOne SDK로 결제 시작
          const resp = await PortOne.requestPayment({
            storeId,
            channelKey,
            paymentId,
            orderName: orderName || '상품',
            totalAmount: parseInt(totalAmount || '0'),
            currency: 'CURRENCY_KRW',
            payMethod: 'CARD',
            redirectUrl: redirectUrl,
          });

          // 결제 실패 시
          if (resp && resp.code !== undefined) {
            alert(resp.message || '결제가 취소되었습니다.');
            router.push(returnUrl);
          }
        } catch (error) {
          console.error('Payment failed:', error);
          alert('결제 연동 중 오류가 발생했습니다.');
          router.push(returnUrl);
        }
      } else {
        // 웹: 일반 PortOne 결제
        const redirectUrl = new URL('/payment-redirect', location.origin);

        try {
          const resp = await PortOne.requestPayment({
            storeId,
            channelKey,
            paymentId,
            orderName: orderName || '상품',
            totalAmount: parseInt(totalAmount || '0'),
            currency: 'CURRENCY_KRW',
            payMethod: 'CARD',
            redirectUrl: redirectUrl.toString(),
          });

          if (resp && resp.code !== undefined) {
            const errorUrl = new URL('/payment-redirect', location.origin);
            errorUrl.searchParams.set('code', resp.code ?? 'UNKNOWN');
            errorUrl.searchParams.set('message', resp.message || '결제가 취소되었습니다.');
            window.location.href = errorUrl.toString();
          }
        } catch (error) {
          console.error('Payment initialization failed:', error);
          const errorUrl = new URL('/payment-redirect', location.origin);
          errorUrl.searchParams.set('code', 'ERROR');
          errorUrl.searchParams.set('message', '결제 초기화에 실패했습니다.');
          window.location.href = errorUrl.toString();
        }
      }
    };

    initPayment();
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
        <p className="text-lg">{message}</p>
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
