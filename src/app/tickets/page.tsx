'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import TabNavigation from '@/components/TabNavigation'
import TopBar from '@/components/TopBar'
import usePullToRefresh from '@/hooks/usePullToRefresh'
import LoadingSpinner from '@/components/LoadingSpinner'
import { Ticket, Star, X } from 'lucide-react'
import toast from 'react-hot-toast'

interface Purchase {
  id: string
  transactionHash: string
  tokenId: string
  purchaseDate: string
  used: boolean
  usedAt?: string
  pointAmount: number
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
  const { user, token, isLoading: authLoading } = useAuth()
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [loading, setLoading] = useState(true)
  const [qrPopupOpen, setQrPopupOpen] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState<Purchase | null>(null)
  const [qrCodeDataURL, setQrCodeDataURL] = useState<string>('')
  const [timeLeft, setTimeLeft] = useState(15)

  const { containerRef, isRefreshing } = usePullToRefresh(async () => {
    await fetchPurchases()
  })

  const fetchPurchases = useCallback(async () => {
    if (!token) {
      return
    }

    try {
      const response = await fetch('/api/purchases', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      const data = await response.json()

      if (data.success) {
        setPurchases(data.purchases)
      } else if (data.error === 'Unauthorized') {
        router.push('/login')
      }
    } catch (error) {
      console.error('Error fetching purchases:', error)
    } finally {
      setLoading(false)
    }
  }, [token, router])

  useEffect(() => {
    if (authLoading) {
      return
    }

    if (!user || !token) {
      router.push('/login')
      return
    }

    setLoading(true)
    fetchPurchases()
  }, [authLoading, user, token, router, fetchPurchases])

  const generateQRCode = async (purchase: Purchase) => {
    try {
      const QRCode = (await import('qrcode')).default

      const ticketData = {
        tokenId: purchase.tokenId,
        ticketName: purchase.ticket.name,
        transactionHash: purchase.transactionHash,
        purchaseDate: purchase.purchaseDate,
        used: purchase.used,
        timestamp: Date.now(), // 매번 새로운 타임스탬프로 QR 코드 변경
      }

      const qrDataURL = await QRCode.toDataURL(JSON.stringify(ticketData), {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      })

      setQrCodeDataURL(qrDataURL)
    } catch (error) {
      console.error('QR 코드 생성 실패:', error)
      toast.error('QR 코드 생성에 실패했습니다.')
    }
  }

  const handleShowQR = async (purchase: Purchase) => {
    setSelectedTicket(purchase)
    setTimeLeft(15)
    await generateQRCode(purchase)
    setQrPopupOpen(true)
    startPollingTicketStatus(purchase.id)
  }

  // 티켓 상태 폴링 (스캔 완료 감지)
  const startPollingTicketStatus = (purchaseId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        if (!token) {
          return
        }

        const response = await fetch('/api/purchases', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
        const data = await response.json()

        if (data.success) {
          const updatedPurchase = data.purchases.find((p: Purchase) => p.id === purchaseId)

          if (updatedPurchase && updatedPurchase.used) {
            // 티켓이 사용됨으로 변경되면 팝업 닫고 목록 새로고침
            handleCloseQR()
            fetchPurchases()
            clearInterval(pollInterval)
          }
        }
      } catch (error) {
        console.error('티켓 상태 확인 실패:', error)
      }
    }, 2000) // 2초마다 확인

    // QR 팝업이 닫힐 때를 위한 타이머 ID 저장
    ;(window as any).ticketStatusPollInterval = pollInterval
  }

  // QR 코드 자동 재생성 (15초마다)
  useEffect(() => {
    if (!qrPopupOpen || !selectedTicket) return

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          generateQRCode(selectedTicket)
          return 15
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [qrPopupOpen, selectedTicket])

  const handleCloseQR = () => {
    setQrPopupOpen(false)
    setSelectedTicket(null)
    setQrCodeDataURL('')
    setTimeLeft(15)

    // 폴링 중단
    if ((window as any).ticketStatusPollInterval) {
      clearInterval((window as any).ticketStatusPollInterval)
      ;(window as any).ticketStatusPollInterval = null
    }
  }

  if (loading) {
    return (
      <div className="bg-gray-50 min-h-[var(--app-height)] flex justify-center items-center">
        <LoadingSpinner size={48} />
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-b from-purple-50/30 via-white to-pink-50/30 h-[var(--app-height)] flex flex-col">
      <TopBar title="내 티켓" />

      <main ref={containerRef} className="flex-1 overflow-y-auto">
        {isRefreshing && (
          <div className="text-center py-2">
            <LoadingSpinner size={24} />
          </div>
        )}
        <div className="px-4 py-6">
          {purchases.length === 0 ? (
            <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-8 shadow-sm text-center border border-gray-100/50">
              <div className="flex justify-center mb-4">
                <div className="w-24 h-24 bg-blue-500/5 backdrop-blur-xl border border-blue-200/30 rounded-2xl flex items-center justify-center">
                  <Ticket size={48} className="text-blue-400" strokeWidth={2} />
                </div>
              </div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">보유한 티켓이 없습니다</h2>
              <p className="text-gray-600 mb-6">홈에서 새로운 이벤트를 확인하고 티켓을 구매해보세요!</p>
              <button
                onClick={() => router.push('/')}
                className="w-full bg-blue-500/80 backdrop-blur-sm border border-blue-300/30 text-white py-3.5 rounded-2xl font-bold shadow-sm transition-all duration-200 active:scale-[0.98]"
              >
                이벤트 보러가기
              </button>
            </div>
          ) : (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">보유 티켓 ({purchases.length}개)</h2>
              <div className="space-y-4">
                {purchases.map((purchase) => (
                  <TicketCard key={purchase.id} purchase={purchase} onShowQR={handleShowQR} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* QR 코드 팝업 */}
        {qrPopupOpen && selectedTicket && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in p-4">
            <div className="relative bg-gradient-to-b from-white/98 to-white/90 backdrop-blur-xl border border-white/50 rounded-3xl w-full max-w-md shadow-2xl animate-fade-in max-h-[90vh] flex flex-col">
              <button
                type="button"
                onClick={handleCloseQR}
                aria-label="티켓 QR 모달 닫기"
                className="absolute top-3 right-3 w-10 h-10 rounded-full bg-white/85 border border-gray-200/70 text-gray-600 flex items-center justify-center shadow-sm transition-all hover:bg-white hover:text-gray-900 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
              >
                <X size={18} strokeWidth={2.5} />
              </button>
              <div className="p-4 pt-6 pb-4 border-b border-gray-200/50 flex-shrink-0">
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 bg-blue-500/10 backdrop-blur-xl border border-blue-200/30 rounded-2xl flex items-center justify-center flex-shrink-0">
                    <Ticket size={32} className="text-blue-600" strokeWidth={2} />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl font-bold text-gray-900 mb-1">{selectedTicket.ticket.name}</h2>
                    <p className="text-sm text-gray-500">토큰 ID: #{selectedTicket.tokenId}</p>
                  </div>
                </div>
              </div>

              <div className="p-4 flex flex-col">
                <div className="p-4 rounded-2xl mb-5 relative w-full aspect-square max-h-[min(40vh,220px)] flex items-center justify-center">
                  {qrCodeDataURL ? (
                    <img src={qrCodeDataURL} alt="티켓 QR 코드" className="max-w-full max-h-full rounded-xl shadow-sm object-contain" />
                  ) : (
                    <LoadingSpinner size={40} />
                  )}
                </div>

                <div className="mb-4">
                  <div className="relative h-14 rounded-3xl border border-white/30 bg-white/12 backdrop-blur-xl overflow-hidden">
                    <div
                      aria-hidden="true"
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500/70 via-purple-500/60 to-transparent transition-[width] duration-1000 ease-linear"
                      style={{ width: `${Math.max(0, Math.min(timeLeft, 15)) / 15 * 100}%` }}
                    />
                    <div className="relative h-full flex items-center justify-between px-5">
                      <span className="flex items-baseline gap-1 text-white">
                        <span className="text-2xl font-bold leading-none drop-shadow-sm">{timeLeft}</span>
                        <span className="text-[11px] font-semibold text-white/80">sec</span>
                      </span>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-gray-500 text-center">QR코드는 보안을 위해 15초마다 새로고침됩니다.</p>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>

      <TabNavigation />
    </div>
  )
}

function TicketCard({ purchase, onShowQR }: { purchase: Purchase; onShowQR: (p: Purchase) => void }) {
  const isVIP = purchase.ticket.name.includes('VIP')
  const iconBgClass = purchase.used
    ? 'bg-gray-500/10 backdrop-blur-xl border border-gray-200/30'
    : isVIP
      ? 'bg-amber-500/10 backdrop-blur-xl border border-amber-200/30'
      : 'bg-blue-500/10 backdrop-blur-xl border border-blue-200/30'
  const iconColorClass = purchase.used
    ? 'text-gray-500'
    : isVIP
      ? 'text-amber-600'
      : 'text-blue-600'

  return (
    <div className={`bg-white/80 backdrop-blur-sm rounded-3xl p-5 shadow-sm border border-gray-100/50 transition-all duration-200 ${purchase.used ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-5">
        <div className={`w-20 h-20 rounded-2xl flex items-center justify-center flex-shrink-0 ${iconBgClass}`}>
          {isVIP ? (
            <Star size={40} className={iconColorClass} strokeWidth={2} fill="currentColor" />
          ) : (
            <Ticket size={40} className={iconColorClass} strokeWidth={2} />
          )}
        </div>
        <div className="flex-1">
          <div className="flex justify-between items-start">
            <h3 className="font-bold text-lg text-gray-900 mb-1.5 line-clamp-2">{purchase.ticket.name}</h3>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${purchase.used ? 'bg-gray-200 text-gray-600' : 'bg-emerald-100 text-emerald-800'}`}>
              {purchase.used ? '사용 완료' : '미사용'}
            </span>
          </div>
          <p className="text-sm text-gray-600 mb-3 line-clamp-2">{purchase.ticket.description}</p>
          <div className="text-xs text-gray-500 font-mono">
            <p>Token ID: #{purchase.tokenId}</p>
            <p>구매일: {new Date(purchase.purchaseDate).toLocaleString('ko-KR')}</p>
          </div>
        </div>
      </div>
      {!purchase.used && (
        <div className="mt-4 pt-4 border-t border-gray-100 flex gap-3">
          <button
            className="flex-1 bg-blue-500/80 backdrop-blur-sm border border-blue-300/30 text-white font-bold py-3 rounded-2xl shadow-sm transition-all duration-200 flex items-center justify-center gap-2 active:scale-[0.98]"
            onClick={() => onShowQR(purchase)}
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M3 4a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1v-2zM9 4a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 01-1 1h-2a1 1 0 01-1-1V4zM9 10a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 01-1 1h-2a1 1 0 01-1-1v-2zM15 4a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 01-1 1h-2a1 1 0 01-1-1V4zM15 10a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 01-1 1h-2a1 1 0 01-1-1v-2z"></path></svg>
            QR 코드 보기
          </button>
          <button
            className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 rounded-2xl transition-all duration-200 flex items-center justify-center gap-2"
            onClick={() => {
              navigator.clipboard.writeText(purchase.transactionHash)
              toast.success('트랜잭션 해시가 복사되었습니다.')
            }}
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M7 9a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2 2H9a2 2 0 01-2-2V9z"></path><path d="M3 5a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2V5z"></path></svg>
            거래내역 복사
          </button>
        </div>
      )}
    </div>
  )
}
