'use client';

export const dynamic = 'force-dynamic';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

function PaymentResultContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { token, isLoading: authLoading } = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'failed'>('loading');
  const [message, setMessage] = useState('결제 정보를 확인하는 중...');

  useEffect(() => {
    if (authLoading || status !== 'loading') {
      return;
    }

    const processPayment = async () => {
      const paymentId = searchParams.get('paymentId');
      const returnUrl = searchParams.get('returnUrl') || '/';
      const code = searchParams.get('code');
      const errorMessage = searchParams.get('message');

      // 결제 실패/취소
      if (code) {
        setStatus('failed');
        setMessage(errorMessage || '결제가 취소되었습니다.');
        setTimeout(() => router.push(returnUrl), 2000);
        return;
      }

      if (!paymentId) {
        setStatus('failed');
        setMessage('결제 정보를 찾을 수 없습니다.');
        setTimeout(() => router.push(returnUrl), 2000);
        return;
      }

      if (!token) {
        setStatus('failed');
        setMessage('로그인이 필요합니다.');
        setTimeout(() => router.push('/'), 2000);
        return;
      }

      try {
        // 1. 사용자 정보 가져오기
        const meResponse = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!meResponse.ok) {
          setStatus('failed');
          setMessage('사용자 정보를 가져올 수 없습니다.');
          setTimeout(() => router.push(returnUrl), 2000);
          return;
        }

        const meData = await meResponse.json();
        const userId = meData.user?.id;

        if (!userId) {
          setStatus('failed');
          setMessage('사용자 정보를 찾을 수 없습니다.');
          setTimeout(() => router.push(returnUrl), 2000);
          return;
        }

        // 2. 결제 검증 및 포인트 충전
        setMessage('결제를 확인하는 중...');
        const verifyResponse = await fetch('/api/points/charge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentId, userId }),
        });

        const verifyData = await verifyResponse.json();

        if (verifyData.status !== 'PAID') {
          setStatus('failed');
          setMessage('결제가 완료되지 않았습니다.');
          setTimeout(() => router.push(returnUrl), 2000);
          return;
        }

        setStatus('success');
        setMessage('결제가 완료되었습니다.');
        setTimeout(() => router.push(returnUrl), 2000);
      } catch (error) {
        console.error('Payment processing failed:', error);
        setStatus('failed');
        setMessage('처리 중 오류가 발생했습니다.');
        setTimeout(() => router.push(returnUrl), 2000);
      }
    };

    processPayment();
  }, [searchParams, router, token, authLoading, status]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
        <div className="text-center">
          {status === 'loading' && (
            <>
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">{message}</h2>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
                <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">충전 완료!</h2>
              <p className="text-gray-600 mb-4">{message}</p>
              <p className="text-sm text-gray-500">잠시 후 자동으로 돌아갑니다...</p>
            </>
          )}

          {status === 'failed' && (
            <>
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
                <svg className="h-8 w-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">충전 실패</h2>
              <p className="text-gray-600 mb-4">{message}</p>
              <p className="text-sm text-gray-500">잠시 후 자동으로 돌아갑니다...</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PaymentResultPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
            <p className="text-lg">로딩 중...</p>
          </div>
        </div>
      }
    >
      <PaymentResultContent />
    </Suspense>
  );
}
