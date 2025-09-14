'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Purchase {
  id: string
  transactionHash: string
  tokenId: string
  purchaseDate: string
  used: boolean
  usedAt?: string
  ticket: {
    id: string
    name: string
    description: string
    price: string
    imageUrl?: string
  }
}

export default function MyTicketsPage() {
  const router = useRouter()
  const [session, setSession] = useState<any>(null)
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [loading, setLoading] = useState(true)
  const [qrPopupOpen, setQrPopupOpen] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState<Purchase | null>(null)
  const [qrCodeDataURL, setQrCodeDataURL] = useState<string>('')

  useEffect(() => {
    fetch('/api/auth/session')
      .then(res => res.json())
      .then(data => {
        if (data.user) {
          setSession({ user: data.user })
          fetchPurchases()
        } else {
          router.push('/login')
        }
      })
  }, [router])

  const fetchPurchases = async () => {
    try {
      const response = await fetch('/api/purchases')
      const data = await response.json()

      if (data.success) {
        setPurchases(data.purchases)
      }
    } catch (error) {
      console.error('Error fetching purchases:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleShowQR = async (purchase: Purchase) => {
    setSelectedTicket(purchase)

    try {
      const QRCode = (await import('qrcode')).default

      const ticketData = {
        tokenId: purchase.tokenId,
        ticketName: purchase.ticket.name,
        transactionHash: purchase.transactionHash,
        purchaseDate: purchase.purchaseDate,
        used: purchase.used
      }

      const qrDataURL = await QRCode.toDataURL(JSON.stringify(ticketData), {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      })

      setQrCodeDataURL(qrDataURL)
      setQrPopupOpen(true)
    } catch (error) {
      console.error('QR 코드 생성 실패:', error)
      alert('QR 코드 생성에 실패했습니다.')
    }
  }

  const handleCloseQR = () => {
    setQrPopupOpen(false)
    setSelectedTicket(null)
    setQrCodeDataURL('')
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
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <h1 className="text-xl font-bold text-center">내 티켓</h1>
      </div>

      <div className="pb-20 px-4 pt-6">
        {purchases.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 shadow-sm text-center">
            <span className="text-6xl opacity-30 block mb-4">🎫</span>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">구매한 티켓이 없습니다</h2>
            <p className="text-gray-600 mb-6">홈에서 티켓을 구매해보세요!</p>
            <button
              onClick={() => router.push('/')}
              className="w-full bg-blue-500 text-white py-3 rounded-xl font-semibold"
            >
              홈으로 가기
            </button>
          </div>
        ) : (
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-6">보유 티켓 ({purchases.length}개)</h2>
            <div className="space-y-3">
              {purchases.map((purchase) => (
                <div key={purchase.id} className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      purchase.used ? 'bg-gray-200' : 'bg-gradient-to-r from-blue-400 to-purple-500'
                    }`}>
                      <span className={`text-xl ${purchase.used ? 'text-gray-600' : 'text-white'}`}>
                        {purchase.ticket.name.includes('일반') ? '🎪' :
                         purchase.ticket.name.includes('VIP') ? '⭐' : '🎯'}
                      </span>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-800 mb-1">{purchase.ticket.name}</h3>
                      <p className="text-sm text-gray-600 mb-2">{purchase.ticket.description}</p>

                      <div className="flex flex-wrap gap-2 mb-2">
                        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-lg text-xs font-medium">
                          토큰 #{purchase.tokenId}
                        </span>
                        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                          purchase.used
                            ? 'bg-red-100 text-red-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {purchase.used ? '사용완료' : '미사용'}
                        </span>
                      </div>

                      <p className="text-xs text-gray-500">
                        구매일: {new Date(purchase.purchaseDate).toLocaleString('ko-KR')}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 items-end">
                      <p className="text-lg font-bold text-blue-600">
                        {(parseFloat(purchase.ticket.price) / 1e18).toFixed(3)} ETH
                      </p>
                      <p className="text-xs text-gray-500">
                        {purchase.transactionHash.slice(0, 6)}...{purchase.transactionHash.slice(-4)}
                      </p>
                      {!purchase.used && (
                        <div className="flex flex-col gap-1">
                          <button
                            className="flex items-center justify-center gap-1 bg-blue-500 text-white px-2 py-1 rounded-lg text-xs font-semibold"
                            onClick={() => handleShowQR(purchase)}
                          >
                            <span className="text-xs">📱</span>
                            <span>QR</span>
                          </button>
                          <button
                            className="flex items-center justify-center gap-1 border border-gray-300 text-gray-600 px-2 py-1 rounded-lg text-xs"
                            onClick={() => {
                              navigator.clipboard.writeText(purchase.transactionHash)
                              alert('복사됨!')
                            }}
                          >
                            <span className="text-xs">📋</span>
                            <span>TX</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* QR 코드 팝업 */}
      {qrPopupOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-3xl mx-4 w-full max-w-sm shadow-2xl">
            {selectedTicket && (
              <div className="p-8 text-center">
                {/* 헤더 */}
                <div className="mb-6">
                  <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <span className="text-3xl text-white">🎫</span>
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 mb-2">티켓 QR 코드</h2>
                  <h3 className="text-lg font-semibold text-gray-800 mb-1">{selectedTicket.ticket.name}</h3>
                  <p className="text-sm text-gray-500">토큰 ID: #{selectedTicket.tokenId}</p>
                </div>

                {/* QR 코드 */}
                <div className="bg-gray-50 p-6 rounded-2xl mb-6">
                  {qrCodeDataURL ? (
                    <img
                      src={qrCodeDataURL}
                      alt="티켓 QR 코드"
                      className="w-48 h-48 mx-auto rounded-xl shadow-sm"
                    />
                  ) : (
                    <div className="w-48 h-48 flex items-center justify-center mx-auto">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                  )}
                </div>

                <p className="text-sm text-gray-600 mb-6">입장 시 이 QR 코드를 스캔해주세요</p>

                {/* 닫기 버튼 */}
                <button
                  onClick={handleCloseQR}
                  className="w-full bg-blue-500 text-white rounded-2xl py-3 font-semibold"
                >
                  닫기
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 하단 네비게이션 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200">
        <div className="flex">
          <button onClick={() => router.push('/')} className="flex-1 flex flex-col items-center py-3 text-gray-500">
            <span className="text-lg">🏠</span>
            <span className="text-xs mt-1">홈</span>
          </button>
          <button onClick={() => router.push('/search')} className="flex-1 flex flex-col items-center py-3 text-gray-500">
            <span className="text-lg">🔍</span>
            <span className="text-xs mt-1">검색</span>
          </button>
          <button onClick={() => router.push('/my-tickets')} className="flex-1 flex flex-col items-center py-3 text-blue-600">
            <span className="text-lg">🎫</span>
            <span className="text-xs mt-1">내 티켓</span>
          </button>
          <button onClick={() => router.push('/profile')} className="flex-1 flex flex-col items-center py-3 text-gray-500">
            <span className="text-lg">👤</span>
            <span className="text-xs mt-1">프로필</span>
          </button>
        </div>
      </div>
    </div>
  )
}