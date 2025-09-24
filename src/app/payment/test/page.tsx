'use client';

import { useState } from 'react';
import PaymentButton from '@/components/PaymentButton';
import { usePayment } from '@/lib/usePayment';

export default function PaymentTestPage() {
  const [amount, setAmount] = useState(1000);
  const [productName, setProductName] = useState('테스트 상품');
  const [buyerName, setBuyerName] = useState('홍길동');
  const [buyerEmail, setBuyerEmail] = useState('test@example.com');
  const [buyerTel, setBuyerTel] = useState('010-1234-5678');
  const { requestPhoneCertification, isLoading } = usePayment();

  const handlePhoneCertification = async () => {
    try {
      const result = await requestPhoneCertification({
        name: buyerName,
        phone: buyerTel,
      });

      alert(`본인인증 완료!\n이름: ${result.name}\n생년월일: ${result.birth}\n전화번호: ${result.phone}`);
    } catch (error) {
      console.error('본인인증 실패:', error);
    }
  };

  const handlePaymentSuccess = (response: any) => {
    console.log('결제 성공:', response);
    alert(`결제가 성공적으로 완료되었습니다!\n결제 ID: ${response.imp_uid}\n주문번호: ${response.merchant_uid}`);
  };

  const handlePaymentError = (error: Error) => {
    console.error('결제 실패:', error);
    alert(`결제에 실패했습니다: ${error.message}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">포트원 결제 테스트</h1>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">결제 정보 설정</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                상품명
              </label>
              <input
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                결제 금액 (원)
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="100"
                step="100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                구매자 이름
              </label>
              <input
                type="text"
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                구매자 이메일
              </label>
              <input
                type="email"
                value={buyerEmail}
                onChange={(e) => setBuyerEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                구매자 전화번호
              </label>
              <input
                type="tel"
                value={buyerTel}
                onChange={(e) => setBuyerTel(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">휴대폰 본인인증</h2>
          <p className="text-gray-600 mb-4">
            결제 전 본인인증을 테스트할 수 있습니다.
          </p>
          <button
            onClick={handlePhoneCertification}
            disabled={isLoading}
            className="px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors disabled:bg-gray-400"
          >
            본인인증 시작
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">결제하기</h2>
          <p className="text-gray-600 mb-4">
            아래 버튼을 클릭하면 포트원 결제창이 열립니다.
          </p>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-yellow-800">
              <strong>테스트 모드 안내:</strong> 실제 결제가 이루어지지 않는 테스트 환경입니다.
              테스트 카드번호를 사용하여 결제를 진행할 수 있습니다.
            </p>
          </div>

          <PaymentButton
            amount={amount}
            productName={productName}
            buyerInfo={{
              name: buyerName,
              email: buyerEmail,
              phone: buyerTel,
            }}
            onSuccess={handlePaymentSuccess}
            onError={handlePaymentError}
            className="w-full"
          />
        </div>
      </div>
    </div>
  );
}