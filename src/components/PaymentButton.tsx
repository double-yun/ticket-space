'use client';

import { useState } from 'react';
import { usePayment } from '@/lib/usePayment';

interface PaymentButtonProps {
  amount: number;
  productName: string;
  buyerInfo?: {
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
    postcode?: string;
  };
  onSuccess?: (response: any) => void;
  onError?: (error: Error) => void;
  customData?: any;
  className?: string;
  children?: React.ReactNode;
}

export default function PaymentButton({
  amount,
  productName,
  buyerInfo = {},
  onSuccess,
  onError,
  customData,
  className = '',
  children,
}: PaymentButtonProps) {
  const { requestPayment, isLoading, error } = usePayment();
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePayment = async () => {
    if (isProcessing || isLoading) return;

    setIsProcessing(true);
    try {
      const response = await requestPayment({
        name: productName,
        amount,
        buyer_name: buyerInfo.name,
        buyer_email: buyerInfo.email,
        buyer_tel: buyerInfo.phone,
        buyer_addr: buyerInfo.address,
        buyer_postcode: buyerInfo.postcode,
        custom_data: customData,
      });

      if (onSuccess) {
        onSuccess(response);
      } else {
        alert(`결제가 완료되었습니다!\n결제 ID: ${response.imp_uid}`);
      }
    } catch (err) {
      console.error('결제 실패:', err);
      if (onError) {
        onError(err as Error);
      } else {
        alert(`결제에 실패했습니다: ${(err as Error).message}`);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <button
      onClick={handlePayment}
      disabled={isProcessing || isLoading}
      className={`px-6 py-3 bg-blue-600 text-white rounded-lg font-medium transition-colors
        ${isProcessing || isLoading ? 'bg-gray-400 cursor-not-allowed' : 'hover:bg-blue-700 active:bg-blue-800'}
        ${className}`}
    >
      {isProcessing || isLoading ? (
        <span className="flex items-center justify-center">
          <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          처리 중...
        </span>
      ) : (
        children || `${amount.toLocaleString()}원 결제하기`
      )}
    </button>
  );
}