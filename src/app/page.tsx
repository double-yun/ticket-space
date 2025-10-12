'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import TabNavigation from '@/components/TabNavigation'
import TopBar from '@/components/TopBar'
import usePullToRefresh from '@/hooks/usePullToRefresh'
import * as PortOne from '@portone/browser-sdk/v2'
import { Capacitor } from '@capacitor/core'
import { Browser } from '@capacitor/browser'
import { App } from '@capacitor/app'
import { useAuth } from '@/contexts/AuthContext'
import EventCard from '@/components/EventCard';
import LoadingSpinner from '@/components/LoadingSpinner'
import { Gift, Ticket, Copy, Check, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import { copyToClipboard } from '@/lib/copy-to-clipboard';

interface TicketData {
  id: string
  name: string
  description: string
  price: number
  maxSupply: number
  currentSupply: number
  deadline: string
}

interface LotteryTicketData extends TicketData {
  roundId: string
  applicationDeadline: string
}

interface BalanceData {
  success: boolean
  address?: string
  ethBalance?: string
  nftBalance?: string
  totalSupply?: string
  pointBalance?: number
  error?: string
}

export default function Home() {
  const router = useRouter()
  const { user, token, isLoading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [directTickets, setDirectTickets] = useState<TicketData[]>([])
  const [lotteryTickets, setLotteryTickets] = useState<LotteryTicketData[]>([])
  const [balance, setBalance] = useState<BalanceData | null>(null)
  const [ticketCount, setTicketCount] = useState(0)
  const [funding, setFunding] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showAmountModal, setShowAmountModal] = useState(false)
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null)

  const fetchAllData = useCallback(async () => {
    if (!user || !token) return
    setLoading(true)
    await Promise.all([fetchTickets(), fetchBalance(), fetchTicketCount()])
    setLoading(false)
  }, [user, token])

  const { containerRef, isRefreshing } = usePullToRefresh(fetchAllData)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.push('/login')
    }
  }, [user, router, authLoading])

  useEffect(() => {
    if (user) {
      fetchAllData()
    }
  }, [user, fetchAllData])

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    const listener = App.addListener('appUrlOpen', (event) => {
      if (event.url.includes('payment-complete')) {
        Browser.close().then(() => {
          fetchBalance()
        })
      }
    })
    return () => {
      listener.then(l => l.remove())
    }
  }, [])

  const fetchTickets = async () => {
    try {
      const response = await fetch('/api/tickets')
      const data = await response.json()
      setDirectTickets(data.directPurchaseEvents || [])
      setLotteryTickets(data.lotteryEvents || [])
    } catch (error) {
      console.error('Error fetching tickets:', error)
    }
  }

  const fetchBalance = async () => {
    if (!token) return
    try {
      const response = await fetch('/api/balance', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json()
      setBalance(data)
    } catch (error) {
      console.error('Error fetching balance:', error)
    }
  }

  const fetchTicketCount = async () => {
    if (!token) return
    try {
      const response = await fetch('/api/purchases', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json()
      if (data.success) {
        setTicketCount(data.purchases.length)
      }
    } catch (error) {
      console.error('Error fetching ticket count:', error)
    }
  }

  const handleCopyAddress = async () => {
    if (!user?.walletAddress) return

    try {
      await copyToClipboard(user.walletAddress)
      setCopied(true)
      toast.success('주소가 복사되었습니다.');
      
      setTimeout(() => {
        setCopied(false)
      }, 2000)
    } catch (error) {
      console.error('Failed to copy address:', error)
      toast.error('주소 복사에 실패했습니다.')
    }
  }

  const generateUUID = () => {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
      return window.crypto.randomUUID();
    }
    // Fallback for environments without crypto.randomUUID
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  const handleFundWallet = async () => {
    if (funding) return
    setFunding(true)

    const paymentId = `payment-${generateUUID()}`
	const storeId = process.env.NEXT_PUBLIC_PORTONE_STORE_ID;
	const channelKey = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY;

    if (!storeId || !channelKey) {
      toast.error('결제 설정이 필요합니다.')
      setFunding(false)
      return
    }

    if (!selectedAmount) {
      toast.error('충전 금액을 선택해주세요.')
      setFunding(false)
      return
    }

    try {
      if (Capacitor.isNativePlatform()) {
        const paymentUrl = new URL('/points/charge/start', window.location.origin)
        paymentUrl.searchParams.set('paymentId', paymentId)
        paymentUrl.searchParams.set('storeId', storeId)
        paymentUrl.searchParams.set('channelKey', channelKey)
        paymentUrl.searchParams.set('orderName', '포인트 충전')
        paymentUrl.searchParams.set('totalAmount', selectedAmount.toString())
        paymentUrl.searchParams.set('from_app', 'true')
        if (user?.id) {
          paymentUrl.searchParams.set('userId', user.id)
        }
        await Browser.open({ url: paymentUrl.toString() })
      } else {
        const resp = await PortOne.requestPayment({
          storeId,
          channelKey,
          paymentId,
          orderName: '포인트 충전',
          totalAmount: selectedAmount,
          currency: 'KRW',
          payMethod: 'CARD',
          redirectUrl: `${window.location.origin}/points/charge/callback?userId=${user?.id}`,
        })
        if (resp?.code) {
          toast.error(resp.message || '결제가 취소되었습니다.')
        }
      }
    } catch (error) {
      toast.error('결제 처리 중 오류가 발생했습니다.')
    } finally {
      setFunding(false)
      setShowAmountModal(false)
      setSelectedAmount(null)
    }
  }

  const openAmountModal = () => {
    setShowAmountModal(true)
  }

  const closeAmountModal = () => {
    setShowAmountModal(false)
    setSelectedAmount(null)
  }

  const handleAmountSelect = (amount: number) => {
    setSelectedAmount(amount)
  }

  const confirmAndPay = () => {
    if (!selectedAmount) {
      toast.error('충전 금액을 선택해주세요.')
      return
    }
    handleFundWallet()
  }

  if (authLoading || !user) return null

  return (
    <div className="bg-gradient-to-b from-blue-50/30 via-white to-purple-50/30 h-[var(--app-height)] flex flex-col">
      <TopBar title="홈" />

      <main ref={containerRef} className="flex-1 overflow-y-auto">
        {isRefreshing && (
          <div className="fixed top-28 left-0 right-0 flex justify-center py-2 z-10">
            <LoadingSpinner size={24} />
          </div>
        )}
        <div className="px-4 py-6 space-y-8">
          {/* 지갑 정보 */}
          <div className="bg-gradient-to-br from-blue-500/5 to-purple-500/5 backdrop-blur-sm rounded-3xl p-6 shadow-sm border border-blue-100/50">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">내 지갑</h3>
              <button
                onClick={handleCopyAddress}
                className="flex items-center gap-2 bg-white/60 backdrop-blur-sm border border-blue-100/50 rounded-xl px-3 py-2 active:scale-[0.98] transition-all"
              >
                <p className="text-xs font-mono text-gray-600">
                  {user.walletAddress?.slice(0, 6)}...{user.walletAddress?.slice(-4)}
                </p>
                {copied ? (
                  <Check size={14} className="text-emerald-600" />
                ) : (
                  <Copy size={14} className="text-gray-400" />
                )}
              </button>
            </div>
            <div className="flex items-end justify-between gap-4 mb-4">
              <div className="flex-1 bg-blue-500/5 backdrop-blur-xl border border-blue-200/30 rounded-2xl p-4">
                <p className="text-sm text-gray-600 mb-1">보유 티켓</p>
                <p className="text-3xl font-bold text-gray-900">
                  {ticketCount}
                  <span className="text-xl font-normal ml-1 text-gray-600">개</span>
                </p>
              </div>
              <div className="flex-1 bg-purple-500/5 backdrop-blur-xl border border-purple-200/30 rounded-2xl p-4">
                <p className="text-sm text-gray-600 mb-1">보유 포인트</p>
                <p className="text-3xl font-bold text-gray-900">
                  {(balance?.pointBalance ?? 0).toLocaleString()}
                  <span className="text-xl font-normal ml-1 text-gray-600">P</span>
                </p>
              </div>
            </div>
            
            {/* 충전 버튼 */}
            <button
              onClick={openAmountModal}
              disabled={funding}
              className="w-full bg-white/70 backdrop-blur-sm border border-blue-200/50 text-blue-600 py-3 rounded-2xl font-semibold text-sm transition-all active:scale-[0.99] hover:bg-white/90 hover:border-blue-300/60 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Plus size={18} strokeWidth={2.5} />
              <span>포인트 충전</span>
            </button>
          </div>

          {/* 바로 구매 가능한 티켓 */}
          <div>
            <h2 className="text-2xl font-bold mb-4 text-gray-900">바로 구매 가능한 이벤트</h2>
            <div className="space-y-4">
              {directTickets.map((ticket) => (
                <EventCard key={ticket.id} ticket={ticket} type="direct" />
              ))}
              {!loading && directTickets.length === 0 && (
                <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-8 shadow-sm text-center border border-gray-100/50">
                  <div className="flex justify-center mb-4">
                    <div className="w-20 h-20 bg-gray-500/5 backdrop-blur-xl border border-gray-200/30 rounded-2xl flex items-center justify-center">
                      <Ticket size={40} className="text-gray-400" strokeWidth={2} />
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800">진행중인 이벤트가 없습니다</h3>
                  <p className="text-sm text-gray-500 mt-2">곧 새로운 이벤트로 찾아올게요!</p>
                </div>
              )}
            </div>
          </div>

          {/* 추첨 신청 가능한 티켓 */}
          <div>
            <h2 className="text-2xl font-bold mb-4 text-gray-900">추첨 이벤트</h2>
            <div className="space-y-4">
              {lotteryTickets.map((ticket) => (
                <EventCard key={`${ticket.id}-${ticket.roundId}`} ticket={ticket} type="lottery" />
              ))}
              {!loading && lotteryTickets.length === 0 && (
                <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-8 shadow-sm text-center border border-gray-100/50">
                  <div className="flex justify-center mb-4">
                    <div className="w-20 h-20 bg-emerald-500/5 backdrop-blur-xl border border-emerald-200/30 rounded-2xl flex items-center justify-center">
                      <Gift size={40} className="text-emerald-400" strokeWidth={2} />
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800">진행중인 추첨이 없습니다</h3>
                  <p className="text-sm text-gray-500 mt-2">곧 새로운 추첨 이벤트로 찾아올게요!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <TabNavigation />

      {/* 충전 금액 선택 모달 */}
      {showAmountModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl animate-slide-up">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">충전 금액 선택</h2>
              <p className="text-sm text-gray-500 mt-1">원하시는 금액을 선택해주세요</p>
              <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-700 font-medium">결제 테스트 모드</p>
                <p className="text-xs text-blue-600">실제 결제가 이루어지지 않으며, 결제 과정을 체험할 수 있습니다</p>
              </div>
            </div>
            
            <div className="p-6 space-y-3">
              {[1000, 5000, 10000, 30000, 50000, 100000].map((amount) => (
                <button
                  key={amount}
                  onClick={() => handleAmountSelect(amount)}
                  className={`w-full p-4 rounded-2xl font-semibold text-lg transition-all active:scale-[0.98] ${
                    selectedAmount === amount
                      ? 'bg-blue-500 text-white shadow-md'
                      : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {amount.toLocaleString()}원
                </button>
              ))}
            </div>

            <div className="p-6 pt-0 space-y-3">
              <button
                onClick={confirmAndPay}
                disabled={!selectedAmount || funding}
                className="w-full bg-blue-500 text-white py-4 rounded-2xl font-bold text-base transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {funding ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>처리 중...</span>
                  </>
                ) : (
                  <span>
                    {selectedAmount ? `${selectedAmount.toLocaleString()}원 충전하기` : '금액을 선택해주세요'}
                  </span>
                )}
              </button>
              <button
                onClick={closeAmountModal}
                disabled={funding}
                className="w-full bg-gray-100 text-gray-700 py-4 rounded-2xl font-semibold text-base transition-all active:scale-[0.99] disabled:opacity-50"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
