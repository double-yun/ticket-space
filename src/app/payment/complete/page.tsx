'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function PaymentCompleteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'failed'>('loading');
  const [paymentInfo, setPaymentInfo] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const processPaymentResult = async () => {
      const impSuccess = searchParams.get('imp_success');
      const impUid = searchParams.get('imp_uid');
      const merchantUid = searchParams.get('merchant_uid');
      const errorMsg = searchParams.get('error_msg');

      if (impSuccess === 'false' || !impUid) {
        setStatus('failed');
        setErrorMessage(errorMsg || '결제가 취소되었습니다.');
        return;
      }

      try {
        const response = await fetch('/api/payments/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imp_uid: impUid,
            merchant_uid: merchantUid,
          }),
        });

        const result = await response.json();

        if (result.success) {
          setStatus('success');
          setPaymentInfo(result.data);
        } else {
          setStatus('failed');
          setErrorMessage(result.error || '결제 검증에 실패했습니다.');
        }
      } catch (error) {
        setStatus('failed');
        setErrorMessage('결제 처리 중 오류가 발생했습니다.');
        console.error('Payment verification error:', error);
      }
    };

    processPaymentResult();
  }, [searchParams]);

  if (status === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-gray-600">결제를 확인하고 있습니다...</p>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">결제 실패</h1>
            <p className="text-gray-600 mb-6">{errorMessage}</p>
            <div className="space-y-3">
              <button
                onClick={() => router.back()}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                다시 시도하기
              </button>
              <button
                onClick={() => router.push('/')}
                className="w-full px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
              >
                홈으로 돌아가기
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">결제 완료</h1>
          <p className="text-gray-600 mb-6">결제가 성공적으로 완료되었습니다.</p>

          {paymentInfo && (
            <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
              <h2 className="font-semibold text-gray-900 mb-3">결제 정보</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">주문번호</span>
                  <span className="font-medium text-gray-900">{paymentInfo.merchant_uid}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">결제금액</span>
                  <span className="font-medium text-gray-900">
                    {paymentInfo.amount?.toLocaleString()}원
                  </span>
                </div>
                {paymentInfo.pay_method && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">결제수단</span>
                    <span className="font-medium text-gray-900">
                      {paymentInfo.pay_method === 'card' ? '신용카드' : paymentInfo.pay_method}
                    </span>
                  </div>
                )}
                {paymentInfo.card_name && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">카드사</span>
                    <span className="font-medium text-gray-900">{paymentInfo.card_name}</span>
                  </div>
                )}
                {paymentInfo.receipt_url && (
                  <div className="mt-3 pt-3 border-t">
                    <a
                      href={paymentInfo.receipt_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                    >
                      영수증 보기 →
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={() => router.push('/my-tickets')}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              내 티켓 보기
            </button>
            <button
              onClick={() => router.push('/')}
              className="w-full px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
            >
              홈으로 돌아가기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PaymentCompletePage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-gray-600">로딩 중...</p>
      </div>
    }>
      <PaymentCompleteContent />
    </Suspense>
  );
}