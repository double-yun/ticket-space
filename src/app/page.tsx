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

interface AuthUser {
  id: string
  name?: string | null
  email?: string | null
  image?: string | null
  walletAddress?: string | null
  kakaoId?: string | null
}

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
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [directTickets, setDirectTickets] = useState<TicketData[]>([])
  const [lotteryTickets, setLotteryTickets] = useState<LotteryTicketData[]>([])
  const [balance, setBalance] = useState<BalanceData | null>(null)
  const [ticketCount, setTicketCount] = useState(0)
  const [funding, setFunding] = useState(false)

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
    } else {
      setAuthUser(user as AuthUser)
    }
  }, [user, router, authLoading])

  useEffect(() => {
    if (authUser) {
      fetchAllData()
    }
  }, [authUser, fetchAllData])

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

  const handleFundWallet = async () => {
    if (funding) return
    setFunding(true)

    const paymentId = `payment-${crypto.randomUUID()}`
	const storeId = process.env.NEXT_PUBLIC_PORTONE_STORE_ID;
	const channelKey = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY;

    if (!storeId || !channelKey) {
      alert('결제 설정이 필요합니다.')
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
        paymentUrl.searchParams.set('totalAmount', '1000')
        paymentUrl.searchParams.set('from_app', 'true')
        if (authUser?.id) {
          paymentUrl.searchParams.set('userId', authUser.id)
        }
        await Browser.open({ url: paymentUrl.toString() })
      } else {
        const resp = await PortOne.requestPayment({
          storeId,
          channelKey,
          paymentId,
          orderName: '포인트 충전',
          totalAmount: 1000,
          currency: 'KRW',
          payMethod: 'CARD',
          redirectUrl: `${window.location.origin}/points/charge/callback?userId=${authUser?.id}`,
        })
        if (resp?.code) {
          alert(resp.message || '결제가 취소되었습니다.')
        }
      }
    } catch (error) {
      alert('결제 처리 중 오류가 발생했습니다.')
    } finally {
      setFunding(false)
    }
  }

  if (!authUser) return null

  return (
    <div className="bg-gray-50 min-h-screen overflow-hidden">
      <TopBar title="티켓팅" />

      <div ref={containerRef} className="h-[calc(100vh-60px)] overflow-y-auto pt-[60px]">
        {isRefreshing && (
          <div className="fixed top-16 left-0 right-0 flex justify-center py-2 z-10">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
        )}
        <div className="pb-20 px-4 pt-6 space-y-8">
          {/* 지갑 정보 */}
          <div className="bg-gradient-to-br from-blue-500 via-blue-600 to-purple-600 rounded-3xl p-6 shadow-xl shadow-blue-500/20">
            <div className="flex items-start justify-between text-white mb-4">
              <div>
                <h3 className="text-lg font-bold mb-1">내 지갑</h3>
                <p className="text-sm text-blue-100 font-mono tracking-wider">
                  {authUser.walletAddress?.slice(0, 6)}...{authUser.walletAddress?.slice(-4)}
                </p>
              </div>
              <button
                className="bg-white/20 backdrop-blur-sm text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-white/30 transition-all active:scale-95"
                onClick={handleFundWallet}
                disabled={funding}
              >
                {funding ? '처리 중...' : '충전'}
              </button>
            </div>
            <div className="flex items-end justify-between">
              <div className="text-left">
                <p className="text-sm text-blue-200 mb-1">보유 티켓</p>
                <p className="text-3xl font-bold text-white">
                  {ticketCount}
                  <span className="text-2xl font-normal ml-1">개</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-blue-200 mb-1">보유 포인트</p>
                <p className="text-3xl font-bold text-white">
                  {(balance?.pointBalance ?? 0).toLocaleString()}
                  <span className="text-2xl font-normal ml-1">P</span>
                </p>
              </div>
            </div>
          </div>

          {/* 바로 구매 가능한 티켓 */}
          <div>
            <h2 className="text-2xl font-bold mb-4 text-gray-900">바로 구매 가능한 이벤트</h2>
            <div className="space-y-4">
              {directTickets.map((ticket) => (
                <EventCard key={ticket.id} ticket={ticket} type="direct" onSuccess={fetchAllData} />
              ))}
              {!loading && directTickets.length === 0 && (
                <div className="bg-white rounded-3xl p-8 shadow-lg text-center border border-gray-100">
                  <span className="text-5xl opacity-40 block mb-4">🎟️</span>
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
                <EventCard key={`${ticket.id}-${ticket.roundId}`} ticket={ticket} type="lottery" onSuccess={fetchAllData} />
              ))}
              {!loading && lotteryTickets.length === 0 && (
                <div className="bg-white rounded-3xl p-8 shadow-lg text-center border border-gray-100">
                  <span className="text-5xl opacity-40 block mb-4">🎁</span>
                  <h3 className="text-lg font-semibold text-gray-800">진행중인 추첨이 없습니다</h3>
                  <p className="text-sm text-gray-500 mt-2">곧 새로운 추첨 이벤트로 찾아올게요!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <TabNavigation />
    </div>
  )
}