'use client'

import { useState, useEffect, useCallback, KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import TabNavigation from '@/components/TabNavigation'
import TopBar from '@/components/TopBar'
import usePullToRefresh from '@/hooks/usePullToRefresh'
import LoadingSpinner from '@/components/LoadingSpinner'
import { Ticket, Star, QrCode } from 'lucide-react'
import TicketQrModal from '@/components/TicketQrModal'
import type { TicketPurchase } from '@/types/purchase'

type Purchase = TicketPurchase

export default function MyTicketsPage() {
  const router = useRouter()
  const { user, token, isLoading: authLoading } = useAuth()
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [loading, setLoading] = useState(true)
  const [qrModalOpen, setQrModalOpen] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState<Purchase | null>(null)

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

  const handleShowQR = async (purchase: Purchase) => {
    setSelectedTicket(purchase)
    setQrModalOpen(true)
  }

  const handleCloseQR = () => {
    setQrModalOpen(false)
    setSelectedTicket(null)
  }
  
  const handleOpenDetail = (purchaseId: string) => {
    router.push(`/tickets/${purchaseId}`)
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
                  <TicketCard
                    key={purchase.id}
                    purchase={purchase}
                    onShowQR={handleShowQR}
                    onOpenDetail={handleOpenDetail}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <TicketQrModal
          open={qrModalOpen}
          purchase={selectedTicket}
          onClose={handleCloseQR}
          token={token}
          onRefresh={fetchPurchases}
        />

      </main>

      <TabNavigation />
    </div>
  )
}

function TicketCard({
  purchase,
  onShowQR,
  onOpenDetail,
}: {
  purchase: Purchase
  onShowQR: (p: Purchase) => void
  onOpenDetail: (id: string) => void
}) {
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

  const handleCardClick = () => {
    onOpenDetail(purchase.id)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handleCardClick()
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
      className={`bg-white/80 backdrop-blur-sm rounded-3xl p-5 shadow-sm border border-gray-100/50 transition-all duration-200 ${
        purchase.used ? 'opacity-60' : 'hover:shadow-md hover:border-gray-100'
      } cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200`}
    >
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
            type="button"
            className="flex-1 rounded-2xl border border-white/50 bg-gradient-to-r from-blue-500/75 via-indigo-500/70 to-purple-500/70 text-white font-semibold py-3 shadow-[0_10px_24px_rgba(59,130,246,0.18)] backdrop-blur-xl transition-all duration-200 flex items-center justify-center gap-2 active:scale-[0.98] hover:shadow-[0_14px_32px_rgba(99,102,241,0.18)]"
            onClick={(event) => {
              event.stopPropagation()
              onShowQR(purchase)
            }}
          >
            <QrCode size={18} strokeWidth={2.4} className="drop-shadow-sm" />
            QR 코드 보기
          </button>
        </div>
      )}
    </div>
  )
}
