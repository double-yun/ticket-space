'use client';

import { useEffect } from 'react';

declare global {
  interface Window {
    IMP?: {
      init: (merchantId: string) => void;
      request_pay: (params: PaymentParams, callback: (response: PaymentResponse) => void) => void;
      certification: (params: CertificationParams, callback: (response: CertificationResponse) => void) => void;
    };
  }
}

interface PaymentParams {
  pg?: string;
  pay_method?: string;
  merchant_uid: string;
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

interface CertificationParams {
  merchant_uid: string;
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

const MERCHANT_CODE = 'imp40220462';

export default function PortoneProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const loadPortoneScript = () => {
      if (document.getElementById('portone-sdk')) {
        if (window.IMP) {
          window.IMP.init(MERCHANT_CODE);
        }
        return;
      }

      const script = document.createElement('script');
      script.id = 'portone-sdk';
      script.src = 'https://cdn.iamport.kr/v1/iamport.js';
      script.async = true;
      script.onload = () => {
        if (window.IMP) {
          window.IMP.init(MERCHANT_CODE);
          console.log('포트원 SDK 초기화 완료');
        }
      };
      document.body.appendChild(script);
    };

    loadPortoneScript();
  }, []);

  return <>{children}</>;
}