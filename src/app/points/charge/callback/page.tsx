'use client';

export const dynamic = 'force-dynamic';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Capacitor } from '@capacitor/core';
import { useAuth } from '@/contexts/AuthContext';
import LoadingSpinner from '@/components/LoadingSpinner';
import { CheckCircle2, XOctagon } from 'lucide-react';

interface PaymentInfo {
  status?: string;
  amount?: number;
  [key: string]: unknown;
}

function PaymentRedirectContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { token, isLoading: authLoading } = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'failed' | 'error'>('loading');
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isCapacitorApp, setIsCapacitorApp] = useState(false);
  const [countdown, setCountdown] = useState(3);

  const handleGoHome = useCallback(async () => {
    if (isCapacitorApp) {
      // Custom URL Scheme으로 앱을 열어서 InAppBrowser 닫기
      window.location.href = 'ticketspace://payment-complete';
    } else {
      // 웹 환경에서는 일반적인 라우팅
      router.push('/');
    }
  }, [isCapacitorApp, router]);

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
    if (authLoading || status !== 'loading') {
      return;
    }

    const verifyPayment = async () => {
      try {
        // URL 파라미터에서 결제 ID 가져오기
        const paymentId = searchParams.get('paymentId');
        const userId = searchParams.get('userId'); // InAppBrowser 인증용
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
          body: JSON.stringify({ 
            paymentId,
            userId // InAppBrowser 인증용
          }),
        });

        if (!response.ok) {
          throw new Error('결제 검증에 실패했습니다.');
        }

        const data: PaymentInfo = await response.json();
        setPaymentInfo(data);

        // 결제 상태 확인
        if (data.status === 'PAID') {
          setStatus('success');


        } else if (data.status === 'VIRTUAL_ACCOUNT_ISSUED') {
          setStatus('success'); // 가상계좌 발급도 성공으로 처리
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
  }, [searchParams, isCapacitorApp, token, authLoading, status]);

  // 결제 성공 시 카운트다운 & 자동 닫기
  useEffect(() => {
    if (status === 'success' && isCapacitorApp && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);

      return () => clearTimeout(timer);
    }

    if (status === 'success' && isCapacitorApp && countdown === 0) {
      handleGoHome();
    }
  }, [status, isCapacitorApp, countdown, handleGoHome]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size={48} />
          <p className="text-lg">결제 정보를 확인하고 있습니다...</p>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-100/40 via-white to-blue-100/40 flex items-center justify-center p-6">
        <div className="relative w-full max-w-xl rounded-3xl border border-white/60 bg-white/40 backdrop-blur-2xl shadow-[0_30px_60px_rgba(22,78,99,0.15)] px-8 py-10 text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-500/10 text-emerald-600">
            <CheckCircle2 size={52} strokeWidth={2.2} />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight mb-2">결제가 완료되었습니다!</h2>
          {paymentInfo?.status === 'VIRTUAL_ACCOUNT_ISSUED' ? (
            <p className="text-sm text-slate-600 mb-5">
              가상계좌가 발급되었습니다. 안내에 따라 입금해 주세요.
            </p>
          ) : (
            <p className="text-sm text-slate-600 mb-5">포인트 충전이 정상적으로 처리되었습니다.</p>
          )}
          {paymentInfo?.amount && (
            <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-2xl border border-emerald-200/60 bg-emerald-50/60 px-4 py-2 text-sm font-semibold text-emerald-700">
              <span>충전 금액</span>
              <span className="text-base font-bold text-emerald-600">
                {paymentInfo.amount.toLocaleString()}원
              </span>
            </div>
          )}
          {isCapacitorApp && (
            <div className="mb-6 space-y-1 text-center text-xs text-slate-500">
              <p>앱 상단의 닫기 버튼을 눌러 주시면 바로 돌아갈 수 있어요.</p>
              {countdown > 0 && <p>{countdown}초 후 자동으로 앱으로 돌아갑니다.</p>}
            </div>
          )}
          <button
            onClick={handleGoHome}
            className="w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-blue-500 px-4 py-3 font-semibold text-white shadow-lg transition-all hover:shadow-xl active:scale-[0.98]"
          >
            홈으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  if (status === 'failed' || status === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-100/40 via-white to-amber-100/40 flex items-center justify-center p-6">
        <div className="relative w-full max-w-xl rounded-3xl border border-white/60 bg-white/40 backdrop-blur-2xl shadow-[0_30px_60px_rgba(120,53,15,0.15)] px-8 py-10 text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-red-400/40 bg-red-500/10 text-red-600">
            <XOctagon size={52} strokeWidth={2.2} />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight mb-3">
            {status === 'failed' ? '결제를 완료하지 못했어요' : '결제 검증 중 오류가 발생했어요'}
          </h2>
          <p className="text-sm text-slate-600 mb-7">{errorMessage || '잠시 후 다시 시도해 주세요.'}</p>
          <button
            onClick={handleGoHome}
            className="w-full rounded-2xl bg-gradient-to-r from-red-500 to-orange-500 px-4 py-3 font-semibold text-white shadow-lg transition-all hover:shadow-xl active:scale-[0.98]"
          >
            홈으로 돌아가기
          </button>
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
            <LoadingSpinner size={48} />
            <p className="text-lg">결제 정보를 확인하고 있습니다...</p>
          </div>
        </div>
      }
    >
      <PaymentRedirectContent />
    </Suspense>
  );
}
