'use client';

export const dynamic = 'force-dynamic';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Capacitor } from '@capacitor/core';

interface PaymentInfo {
  status?: string;
  amount?: number;
  [key: string]: unknown;
}

function PaymentRedirectContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'failed' | 'error'>('loading');
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isCapacitorApp, setIsCapacitorApp] = useState(false);
  const [countdown, setCountdown] = useState(3);

  const handleGoHome = async () => {
    if (isCapacitorApp) {
      // InAppBrowser를 닫기 위한 특별한 URL로 리다이렉트
      // 앱에서 이 URL을 감지하여 Browser.close()를 호출해야 함
      window.location.href = 'https://close-browser.local';

      // 백업: 2초 후에도 페이지가 남아있으면 홈으로 이동
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    } else {
      // 웹 환경에서는 일반적인 라우팅
      router.push('/');
    }
  };

  useEffect(() => {
    // Capacitor 환경인지 확인
    const isNative = Capacitor.isNativePlatform();
    console.log('Is Native Platform:', isNative);
    console.log('Platform:', Capacitor.getPlatform());

    // InAppBrowser에서 열렸는지 확인하는 추가 방법
    // URL 파라미터나 User Agent로 판단
    const urlParams = new URLSearchParams(window.location.search);
    const isFromApp = urlParams.get('from_app') === 'true';

    setIsCapacitorApp(isNative || isFromApp);
  }, []);

  useEffect(() => {
    const verifyPayment = async () => {
      try {
        // URL 파라미터에서 결제 ID 가져오기
        const paymentId = searchParams.get('paymentId');
        const code = searchParams.get('code');
        const message = searchParams.get('message');

        // 결제 실패 코드가 있는 경우
        if (code) {
          setStatus('failed');
          setErrorMessage(message || '결제가 취소되었습니다.');
          return;
        }

        if (!paymentId) {
          setStatus('error');
          setErrorMessage('결제 정보를 찾을 수 없습니다.');
          return;
        }

        // 서버에서 결제 검증
        const response = await fetch('/api/points/charge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentId }),
        });

        if (!response.ok) {
          throw new Error('결제 검증에 실패했습니다.');
        }

        const data: PaymentInfo = await response.json();
        setPaymentInfo(data);

        // 결제 상태 확인
        if (data.status === 'PAID') {
          setStatus('success');
          // Capacitor 환경에서 결제 성공 시 카운트다운 후 자동으로 브라우저 닫기
          if (isCapacitorApp) {
            let count = 3;
            const timer = setInterval(() => {
              count -= 1;
              setCountdown(count);
              if (count <= 0) {
                clearInterval(timer);
                handleGoHome();
              }
            }, 1000);
          }
        } else if (data.status === 'VIRTUAL_ACCOUNT_ISSUED') {
          setStatus('success'); // 가상계좌 발급도 성공으로 처리
          // Capacitor 환경에서 가상계좌 발급 시 카운트다운 후 자동으로 브라우저 닫기
          if (isCapacitorApp) {
            let count = 3;
            const timer = setInterval(() => {
              count -= 1;
              setCountdown(count);
              if (count <= 0) {
                clearInterval(timer);
                handleGoHome();
              }
            }, 1000);
          }
        } else {
          setStatus('failed');
          setErrorMessage('결제가 완료되지 않았습니다.');
        }
      } catch (error) {
        console.error('Payment verification error:', error);
        setStatus('error');
        setErrorMessage('결제 검증 중 오류가 발생했습니다.');
      }
    };

    verifyPayment();
  }, [searchParams, isCapacitorApp]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-lg">결제 정보를 확인하고 있습니다...</p>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-green-50">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
              <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">결제 완료!</h2>
            {paymentInfo?.status === 'VIRTUAL_ACCOUNT_ISSUED' ? (
              <p className="text-gray-600 mb-4">가상계좌가 발급되었습니다.</p>
            ) : (
              <p className="text-gray-600 mb-4">결제가 성공적으로 완료되었습니다.</p>
            )}
            {paymentInfo?.amount && (
              <p className="text-lg font-semibold text-gray-800 mb-6">
                결제 금액: {paymentInfo.amount.toLocaleString()}원
              </p>
            )}
            {isCapacitorApp && (
              <>
                <p className="text-sm text-gray-500 mb-2">
                  결제가 완료되었습니다!
                </p>
                <p className="text-sm font-semibold text-blue-600 mb-2">
                  상단의 &apos;완료&apos; 또는 &apos;X&apos; 버튼을 눌러 앱으로 돌아가세요
                </p>
                {countdown > 0 && (
                  <p className="text-xs text-gray-500 mb-4">
                    {countdown}초 후 자동으로 앱으로 돌아갑니다.
                  </p>
                )}
              </>
            )}
            <button
              onClick={handleGoHome}
              className="w-full bg-green-600 text-white py-3 px-4 rounded-md hover:bg-green-700 transition-colors"
            >
              홈으로 돌아가기
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'failed' || status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
              <svg className="h-8 w-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {status === 'failed' ? '결제 실패' : '오류 발생'}
            </h2>
            <p className="text-gray-600 mb-6">{errorMessage}</p>
            <button
              onClick={handleGoHome}
              className="w-full bg-red-600 text-white py-3 px-4 rounded-md hover:bg-red-700 transition-colors"
            >
              홈으로 돌아가기
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export default function PaymentRedirectPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
            <p className="text-lg">결제 정보를 확인하고 있습니다...</p>
          </div>
        </div>
      }
    >
      <PaymentRedirectContent />
    </Suspense>
  );
}
