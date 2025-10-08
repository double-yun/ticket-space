'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import PayButton from '@/components/PayButton'
import TabNavigation from '@/components/TabNavigation'
import TopBar from '@/components/TopBar'
import usePullToRefresh from '@/hooks/usePullToRefresh'
import * as PortOne from '@portone/browser-sdk/v2'
import { Capacitor } from '@capacitor/core'
import { Browser } from '@capacitor/browser'
import { App } from '@capacitor/app'
import { useAuth } from '@/contexts/AuthContext'
import 'swiper/css'

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

const PORTONE_STORE_ID = process.env.NEXT_PUBLIC_PORTONE_STORE_ID
const PORTONE_CHANNEL_KEY = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY
const PORTONE_ORDER_NAME = '지갑 충전'
const PORTONE_TOPUP_AMOUNT = 1000

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
    if (!authUser?.walletAddress) return
    try {
      const response = await fetch(`/api/balance?address=${authUser.walletAddress}`)
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
    const { NEXT_PUBLIC_PORTONE_STORE_ID: storeId, NEXT_PUBLIC_PORTONE_CHANNEL_KEY: channelKey } = process.env

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
                <div key={ticket.id} className="bg-white rounded-3xl p-5 shadow-lg border border-gray-100 hover:shadow-xl transition-shadow duration-300">
                  <div className="flex items-start gap-5">
                    <div className="w-20 h-20 bg-gradient-to-br from-blue-400 to-purple-500 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-md">
                      <span className="text-white text-4xl">🎫</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-lg text-gray-900 mb-1.5">{ticket.name}</h3>
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">{ticket.description}</p>
                      <div className="flex items-center justify-between">
                        <div className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                          ticket.currentSupply >= ticket.maxSupply ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                        }`}>
                          남은 수량: {ticket.maxSupply - ticket.currentSupply}개
                        </div>
                        <p className="text-xl font-bold text-blue-600">
                          {ticket.price.toLocaleString()}P
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4">
                    <PayButton
                      eventId={ticket.id}
                      disabled={ticket.currentSupply >= ticket.maxSupply}
                      onSuccess={fetchAllData}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-2xl transition-all duration-200 disabled:bg-gray-300"
                    />
                  </div>
                </div>
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
                <div key={`${ticket.id}-${ticket.roundId}`} className="bg-white rounded-3xl p-5 shadow-lg border border-gray-100 hover:shadow-xl transition-shadow duration-300">
                  <div className="flex items-start gap-5">
                    <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-cyan-500 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-md">
                      <span className="text-white text-4xl">✨</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-lg text-gray-900 mb-1.5">{ticket.name}</h3>
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">{ticket.description}</p>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                        <span className="inline-flex items-center bg-gray-100 text-gray-700 px-3 py-1 rounded-full font-semibold">
                          <svg className="w-3 h-3 mr-1.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.414-1.414L11 10.586V6z" clipRule="evenodd"></path></svg>
                          마감: {new Date(ticket.applicationDeadline).toLocaleString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <p className="text-xl font-bold text-emerald-600">
                      {ticket.price.toLocaleString()}P
                      <span className="text-sm font-normal text-gray-500 ml-1">(당첨 시)</span>
                    </p>
                    <button
                      className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-2xl text-sm font-bold transition-all duration-200 disabled:bg-gray-300 active:scale-95"
                      onClick={() => router.push(`/lottery/${ticket.roundId}`)}
                    >
                      추첨 신청하기
                    </button>
                  </div>
                </div>
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