'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { useAuth } from '@/contexts/AuthContext'

// QR 스캐너를 동적으로 로드 (SSR 방지)
const QrScanner = dynamic(() => import('@/components/QrScanner'), {
  ssr: false,
  loading: () => (
    <div className="flex justify-center items-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  ),
})

interface VerificationResult {
  success: boolean
  message: string
  ticket?: {
    name: string
    tokenId: string
    transactionHash: string
  }
}

export default function ScanPage() {
  const router = useRouter()
  const { user, isLoading: authLoading } = useAuth()
  const [isScanning, setIsScanning] = useState(false)
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) {
      return
    }

    if (!user) {
      router.push('/login')
      return
    }

    setLoading(false)
  }, [authLoading, user, router])

  const handleScan = async (data: string) => {
    if (!data || !isScanning) return

    setIsScanning(false)

    try {
      const qrData = JSON.parse(data)

      // QR 코드 검증 API 호출
      const response = await fetch('/api/tickets/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(qrData),
      })

      const result = await response.json()
      setVerificationResult(result)

      // 3초 후 자동으로 다시 스캔 가능하도록
      setTimeout(() => {
        setVerificationResult(null)
        setIsScanning(true)
      }, 3000)
    } catch (error) {
      console.error('QR 코드 파싱 실패:', error)
      setVerificationResult({
        success: false,
        message: '유효하지 않은 QR 코드입니다.',
      })

      setTimeout(() => {
        setVerificationResult(null)
        setIsScanning(true)
      }, 3000)
    }
  }

  const handleError = (error: Error) => {
    console.error('QR 스캔 에러:', error)
    alert('카메라 접근에 실패했습니다. 카메라 권한을 확인해주세요.')
  }

  const startScanning = () => {
    setIsScanning(true)
    setVerificationResult(null)
  }

  if (loading) {
    return (
      <div className="bg-gray-50 min-h-screen flex justify-center items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* 상단바 */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center">
        <button
          onClick={() => router.push('/')}
          className="text-gray-600 mr-4"
        >
          ← 뒤로
        </button>
        <h1 className="text-xl font-bold text-center flex-1">티켓 검증</h1>
      </div>

      <div className="p-4">
        {/* 안내 메시지 */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
          <h3 className="font-semibold text-blue-900 mb-2">📱 QR 코드 스캔 안내</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• 티켓의 QR 코드를 카메라에 비춰주세요</li>
            <li>• 자동으로 스캔되어 검증됩니다</li>
            <li>• 유효한 티켓만 입장 처리됩니다</li>
          </ul>
        </div>

        {/* QR 스캐너 */}
        {isScanning && (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-4">
            <QrScanner onScan={handleScan} onError={handleError} />
          </div>
        )}

        {/* 스캔 시작 버튼 */}
        {!isScanning && !verificationResult && (
          <button
            onClick={startScanning}
            className="w-full bg-blue-500 text-white py-4 rounded-xl font-semibold text-lg shadow-lg"
          >
            스캔 시작
          </button>
        )}

        {/* 검증 결과 */}
        {verificationResult && (
          <div className={`rounded-xl p-6 shadow-lg ${
            verificationResult.success
              ? 'bg-green-50 border-2 border-green-500'
              : 'bg-red-50 border-2 border-red-500'
          }`}>
            <div className="text-center">
              <div className="text-6xl mb-4">
                {verificationResult.success ? '✅' : '❌'}
              </div>
              <h2 className={`text-2xl font-bold mb-2 ${
                verificationResult.success ? 'text-green-900' : 'text-red-900'
              }`}>
                {verificationResult.success ? '입장 승인' : '입장 불가'}
              </h2>
              <p className={`text-lg mb-4 ${
                verificationResult.success ? 'text-green-800' : 'text-red-800'
              }`}>
                {verificationResult.message}
              </p>

              {verificationResult.success && verificationResult.ticket && (
                <div className="bg-white rounded-lg p-4 mt-4">
                  <p className="text-sm text-gray-600 mb-1">티켓 정보</p>
                  <p className="font-semibold text-gray-900">{verificationResult.ticket.name}</p>
                  <p className="text-xs text-gray-500 mt-2">토큰 ID: #{verificationResult.ticket.tokenId}</p>
                  <p className="text-xs text-gray-500">
                    TX: {verificationResult.ticket.transactionHash.slice(0, 8)}...
                    {verificationResult.ticket.transactionHash.slice(-6)}
                  </p>
                </div>
              )}

              <p className="text-sm text-gray-600 mt-4">3초 후 자동으로 다시 스캔합니다...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
