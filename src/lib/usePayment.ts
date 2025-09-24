'use client';

import { useCallback, useState } from 'react';

interface PaymentParams {
  pg?: string;
  pay_method?: string;
  merchant_uid?: string;
  name: string;
  amount: number;
  buyer_email?: string;
  buyer_name?: string;
  buyer_tel?: string;
  buyer_addr?: string;
  buyer_postcode?: string;
  m_redirect_url?: string;
  notice_url?: string | string[];
  custom_data?: any;
  display?: {
    card_quota?: number[];
  };
}

interface PaymentResponse {
  success: boolean;
  imp_uid?: string;
  merchant_uid: string;
  error_msg?: string;
  paid_amount?: number;
  status?: string;
  pg_provider?: string;
  pg_tid?: string;
  receipt_url?: string;
  card_name?: string;
  bank_name?: string;
  card_number?: string;
  card_quota?: number;
}

interface UsePaymentReturn {
  requestPayment: (params: PaymentParams) => Promise<PaymentResponse>;
  isLoading: boolean;
  error: string | null;
  requestPhoneCertification: (params: PhoneCertParams) => Promise<CertificationResponse>;
}

interface PhoneCertParams {
  merchant_uid?: string;
  company?: string;
  carrier?: string;
  name?: string;
  phone?: string;
  min_age?: number;
  m_redirect_url?: string;
  popup?: boolean;
}

interface CertificationResponse {
  success: boolean;
  imp_uid?: string;
  merchant_uid: string;
  error_msg?: string;
  pg_provider?: string;
  pg_tid?: string;
}

export function usePayment(): UsePaymentReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestPayment = useCallback(async (params: PaymentParams): Promise<PaymentResponse> => {
    return new Promise((resolve, reject) => {
      if (!window.IMP) {
        const errorMsg = '포트원 SDK가 로드되지 않았습니다.';
        setError(errorMsg);
        reject(new Error(errorMsg));
        return;
      }

      setIsLoading(true);
      setError(null);

      const paymentParams = {
        pg: params.pg || 'html5_inicis',
        pay_method: params.pay_method || 'card',
        merchant_uid: params.merchant_uid || `payment_${Date.now()}`,
        name: params.name,
        amount: params.amount,
        buyer_email: params.buyer_email,
        buyer_name: params.buyer_name,
        buyer_tel: params.buyer_tel,
        buyer_addr: params.buyer_addr,
        buyer_postcode: params.buyer_postcode,
        m_redirect_url: params.m_redirect_url || window.location.origin + '/payment/complete',
        notice_url: params.notice_url,
        custom_data: params.custom_data,
        display: params.display,
      };

      window.IMP.request_pay(paymentParams, async (response: PaymentResponse) => {
        setIsLoading(false);

        if (response.success) {
          try {
            const verificationResult = await fetch('/api/payments/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                imp_uid: response.imp_uid,
                merchant_uid: response.merchant_uid,
                amount: params.amount,
              }),
            });

            const verification = await verificationResult.json();

            if (verification.success) {
              resolve(response);
            } else {
              setError(verification.error || '결제 검증에 실패했습니다.');
              reject(new Error(verification.error || '결제 검증 실패'));
            }
          } catch (err) {
            setError('결제 검증 중 오류가 발생했습니다.');
            reject(err);
          }
        } else {
          const errorMsg = response.error_msg || '결제에 실패했습니다.';
          setError(errorMsg);
          reject(new Error(errorMsg));
        }
      });
    });
  }, []);

  const requestPhoneCertification = useCallback(async (params: PhoneCertParams): Promise<CertificationResponse> => {
    return new Promise((resolve, reject) => {
      if (!window.IMP) {
        const errorMsg = '포트원 SDK가 로드되지 않았습니다.';
        setError(errorMsg);
        reject(new Error(errorMsg));
        return;
      }

      setIsLoading(true);
      setError(null);

      const certParams = {
        merchant_uid: params.merchant_uid || `cert_${Date.now()}`,
        company: params.company,
        carrier: params.carrier,
        name: params.name,
        phone: params.phone,
        min_age: params.min_age,
        m_redirect_url: params.m_redirect_url || window.location.origin + '/auth/phone/complete',
        popup: params.popup !== undefined ? params.popup : false,
      };

      window.IMP.certification(certParams, async (response: CertificationResponse) => {
        setIsLoading(false);

        if (response.success) {
          try {
            const verificationResult = await fetch('/api/auth/phone/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                imp_uid: response.imp_uid,
                merchant_uid: response.merchant_uid,
              }),
            });

            const verification = await verificationResult.json();

            if (verification.success) {
              resolve({
                ...response,
                ...verification.data
              });
            } else {
              setError(verification.error || '본인인증 검증에 실패했습니다.');
              reject(new Error(verification.error || '본인인증 검증 실패'));
            }
          } catch (err) {
            setError('본인인증 검증 중 오류가 발생했습니다.');
            reject(err);
          }
        } else {
          const errorMsg = response.error_msg || '본인인증에 실패했습니다.';
          setError(errorMsg);
          reject(new Error(errorMsg));
        }
      });
    });
  }, []);

  return {
    requestPayment,
    requestPhoneCertification,
    isLoading,
    error,
  };
}