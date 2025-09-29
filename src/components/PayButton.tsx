'use client';
import * as PortOne from '@portone/browser-sdk/v2';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';

export default function PayButton() {
  async function onClick() {
    // UUID v4 생성 함수 (브라우저 호환성 향상)
    const generateUUID = () => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    };

    const paymentId = `payment-${generateUUID()}`;
    const isCapacitorApp = Capacitor.isNativePlatform();

    if (isCapacitorApp) {
      // Capacitor 앱 환경에서는 InAppBrowser로 결제 페이지 열기
      const paymentUrl = new URL('/payment', location.origin);
      paymentUrl.searchParams.set('paymentId', paymentId);
      paymentUrl.searchParams.set('storeId', 'store-c9209e03-9213-49bb-99bc-904ae521bb56');
      paymentUrl.searchParams.set('channelKey', 'channel-key-87cd1fa3-c29c-4125-be0a-b4fb02f993bc');
      paymentUrl.searchParams.set('orderName', '예시 상품');
      paymentUrl.searchParams.set('totalAmount', '1000');
      paymentUrl.searchParams.set('from_app', 'true'); // 앱에서 열렸음을 표시

      // Browser 이벤트 리스너 추가
      const finishedListener = Browser.addListener('browserFinished', () => {
        console.log('Browser closed');
        // 브라우저가 닫혔을 때 처리할 로직
        window.location.reload(); // 앱 페이지 새로고침
        finishedListener.remove(); // 리스너 제거
      });

      const pageLoadedListener = Browser.addListener('browserPageLoaded', () => {
        console.log('Page loaded in browser');
        // 특정 URL 패턴을 감지하여 브라우저 닫기
        // 이 부분은 실제로는 작동하지 않을 수 있음
      });

      // InAppBrowser로 결제 페이지 열기
      await Browser.open({
        url: paymentUrl.toString(),
        presentationStyle: 'fullscreen',
        windowName: '_blank',
        toolbarColor: '#ffffff',
        showReloadButton: false,
        showArrow: true // iOS에서 'Done' 버튼 표시
      });

      // 브라우저가 닫힌 후의 처리는 앱에서 수행
      return;
    }

    // 웹 환경에서는 기존 방식으로 결제 진행
    const resp = await PortOne.requestPayment({
      // 콘솔에서 복사한 값들(클라이언트 노출 가능한 값만 NEXT_PUBLIC_* 로 전달)
      storeId: 'store-c9209e03-9213-49bb-99bc-904ae521bb56',
      channelKey: 'channel-key-87cd1fa3-c29c-4125-be0a-b4fb02f993bc',

      paymentId,                  // 고객사 고유 결제 ID(중복 금지)
      orderName: '예시 상품',
      totalAmount: 1000,
      currency: 'CURRENCY_KRW',
      payMethod: 'CARD',

      // 모바일 환경 대비: redirect 방식 사용 권장
      redirectUrl: `${location.origin}/payment-redirect`,
    });

    // PC/팝업 방식 등 리디렉션 없이 결과를 받는 경우에만 resp 사용
    // 오류 시 resp.code/resp.message 제공
    if ((resp as any)?.code !== undefined) {
      alert((resp as any).message);
      return;
    }

    // 성공 가정: 서버 검증 호출 (아래 4) 참고)
    await fetch('/api/payment/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentId }),
    });
  }

  return <button onClick={onClick}>결제하기</button>;
}