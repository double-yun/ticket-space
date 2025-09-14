'use client';

import { useState, useEffect } from 'react';

interface MintResponse {
  success: boolean;
  transactionHash?: string;
  tokenId?: string;
  to?: string;
  blockNumber?: string;
  error?: string;
}

interface BalanceData {
  success: boolean;
  address?: string;
  ethBalance?: string;
  nftBalance?: string;
  totalSupply?: string;
  error?: string;
}

interface TransactionData {
  success: boolean;
  transactions?: Array<{
    transactionHash: string;
    blockNumber: string;
    from: string;
    to: string;
    tokenId: string;
    type: 'mint' | 'transfer';
  }>;
  count?: number;
  error?: string;
}

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<MintResponse | null>(null);
  const [balance, setBalance] = useState<BalanceData | null>(null);
  const [transactions, setTransactions] = useState<TransactionData | null>(null);

  const fetchBalance = async () => {
    try {
      const response = await fetch('/api/balance');
      const data: BalanceData = await response.json();
      setBalance(data);
    } catch (error) {
      console.error('Balance fetch error:', error);
    }
  };

  const fetchTransactions = async () => {
    try {
      const response = await fetch('/api/transactions');
      const data: TransactionData = await response.json();
      setTransactions(data);
    } catch (error) {
      console.error('Transactions fetch error:', error);
    }
  };

  useEffect(() => {
    fetchBalance();
    fetchTransactions();
  }, []);

  const handleMint = async () => {
    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/mint', {
        method: 'POST',
      });

      const data: MintResponse = await response.json();
      setResult(data);

      if (data.success) {
        fetchBalance();
        fetchTransactions();
      }

    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-center mb-8">🎫 티켓 NFT 테스트</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 좌측: 구매 버튼 및 결과 */}
          <div className="space-y-6">
            <div className="text-center">
              <button
                onClick={handleMint}
                disabled={isLoading}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600
                           text-white font-bold py-4 px-8 rounded-lg text-xl
                           transition-colors duration-200"
              >
                {isLoading ? '발행 중...' : '🎫 티켓 구매하기'}
              </button>
            </div>

            {result && (
              <div className="p-6 rounded-lg bg-gray-800">
                {result.success ? (
                  <div className="space-y-2">
                    <p className="text-green-400 font-bold">✅ 발행 성공!</p>
                    <p><span className="text-gray-400">토큰 ID:</span> {result.tokenId}</p>
                    <p><span className="text-gray-400">소유자:</span> {result.to?.slice(0, 6)}...{result.to?.slice(-4)}</p>
                    <p><span className="text-gray-400">트랜잭션:</span> {result.transactionHash?.slice(0, 10)}...</p>
                    <p><span className="text-gray-400">블록:</span> {result.blockNumber}</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-red-400 font-bold">❌ 발행 실패</p>
                    <p className="text-gray-300 mt-2">{result.error}</p>
                  </div>
                )}
              </div>
            )}

            {/* 잔액 정보 */}
            {balance && balance.success && (
              <div className="p-6 rounded-lg bg-gray-800">
                <h3 className="text-xl font-bold mb-4">💰 지갑 정보</h3>
                <div className="space-y-2 text-sm">
                  <p><span className="text-gray-400">주소:</span> {balance.address?.slice(0, 6)}...{balance.address?.slice(-4)}</p>
                  <p><span className="text-gray-400">ETH 잔액:</span> {balance.ethBalance} ETH</p>
                  <p><span className="text-gray-400">보유 NFT:</span> {balance.nftBalance}개</p>
                  <p><span className="text-gray-400">총 발행량:</span> {balance.totalSupply}개</p>
                </div>
              </div>
            )}
          </div>

          {/* 우측: 거래 내역 */}
          <div>
            <div className="p-6 rounded-lg bg-gray-800">
              <h3 className="text-xl font-bold mb-4">📋 거래 내역</h3>
              {transactions && transactions.success && transactions.transactions ? (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {transactions.transactions.map((tx, index) => (
                    <div key={index} className="p-3 rounded bg-gray-700 text-sm">
                      <div className="flex justify-between items-start mb-2">
                        <span className={`px-2 py-1 rounded text-xs ${
                          tx.type === 'mint' ? 'bg-green-600' : 'bg-blue-600'
                        }`}>
                          {tx.type === 'mint' ? 'MINT' : 'TRANSFER'}
                        </span>
                        <span className="text-gray-400">#{tx.tokenId}</span>
                      </div>
                      <p><span className="text-gray-400">From:</span> {tx.from.slice(0, 6)}...{tx.from.slice(-4)}</p>
                      <p><span className="text-gray-400">To:</span> {tx.to.slice(0, 6)}...{tx.to.slice(-4)}</p>
                      <p><span className="text-gray-400">Block:</span> {tx.blockNumber}</p>
                      <p><span className="text-gray-400">TX:</span> {tx.transactionHash.slice(0, 10)}...</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400">거래 내역이 없습니다.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}