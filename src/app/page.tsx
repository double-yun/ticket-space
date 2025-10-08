'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Swiper, SwiperSlide } from 'swiper/react'
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

const categories = [
  { id: 'concert', name: '콘서트', icon: '🎵', color: 'from-purple-500 to-pink-500' },
  { id: 'sports', name: '스포츠', icon: '🏆', color: 'from-green-500 to-emerald-500' },
  { id: 'theater', name: '연극/뮤지컬', icon: '🎭', color: 'from-red-500 to-rose-500' },
  { id: 'exhibition', name: '전시회', icon: '🎨', color: 'from-blue-500 to-cyan-500' },
  { id: 'festival', name: '페스티벌', icon: '🎪', color: 'from-yellow-500 to-orange-500' },
  { id: 'other', name: '기타', icon: '⋯', color: 'from-gray-500 to-slate-500' }
]

const featuredEvents = [
  { id: 1, title: 'K-POP 슈퍼콘서트 2024', date: '2024.09.20', location: '올림픽공원 체조경기장', image: 'bg-gradient-to-r from-pink-400 to-purple-600' },
  { id: 2, title: '클래식 갈라콘서트', date: '2024.09.25', location: '세종문화회관', image: 'bg-gradient-to-r from-blue-400 to-indigo-600' },
  { id: 3, title: '뮤지컬 <라이온킹>', date: '2024.10.01', location: '샤롯데씨어터', image: 'bg-gradient-to-r from-orange-400 to-red-600' }
]

const upcomingEvents = [
  { name: 'IU 콘서트', date: '9월 20일', dday: 'D-6' },
  { name: '야구 경기', date: '9월 22일', dday: 'D-8' },
  { name: '뮤지컬 관람', date: '9월 25일', dday: 'D-11' }
]

const PORTONE_STORE_ID = process.env.NEXT_PUBLIC_PORTONE_STORE_ID
const PORTONE_CHANNEL_KEY = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY
const PORTONE_ORDER_NAME = '지갑 충전'
const PORTONE_TOPUP_AMOUNT = 1000

export default function Home() {
  const router = useRouter()
  const { user, token, logout, isLoading: authLoading } = useAuth()
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [directTickets, setDirectTickets] = useState<TicketData[]>([])
  const [lotteryTickets, setLotteryTickets] = useState<LotteryTicketData[]>([])
  const [balance, setBalance] = useState<BalanceData | null>(null)
  const [funding, setFunding] = useState(false)

  const handleRefresh = async () => {
    await Promise.all([fetchTickets(), fetchBalance()])
  }

  const { containerRef, isRefreshing } = usePullToRefresh(handleRefresh)

  useEffect(() => {
    // Wait for auth to finish loading
    if (authLoading) return

    if (!user) {
      router.push('/login')
      return
    }
    setAuthUser(user as AuthUser)
  }, [user, router, authLoading])

  useEffect(() => {
    if (authUser) {
      fetchTickets()
      fetchBalance()
    }
  }, [authUser])

  // Custom URL Scheme 리스너 (결제 완료 후 InAppBrowser 닫기)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    const urlListener = App.addListener('appUrlOpen', (event) => {
      console.log('App opened with URL:', event.url)
      
      // ticketspace://payment-complete 감지 시 InAppBrowser 닫기
      if (event.url.includes('payment-complete')) {
        Browser.close().then(() => {
          console.log('InAppBrowser closed after payment')
          fetchBalance() // 잔액 새로고침
        }).catch(err => {
          console.error('Failed to close browser:', err)
        })
      }
    })

    return () => {
      urlListener.then(listener => listener.remove())
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
    } finally {
      setLoading(false)
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

  const handleFundWallet = async () => {
    if (funding) return

    setFunding(true)

    const generateUUID = () =>
      'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = (Math.random() * 16) | 0
        const v = c === 'x' ? r : (r & 0x3) | 0x8
        return v.toString(16)
      })

    const paymentId = `payment-${generateUUID()}`
    const storeId = PORTONE_STORE_ID
    const channelKey = PORTONE_CHANNEL_KEY
    const orderName = PORTONE_ORDER_NAME
    const totalAmount = PORTONE_TOPUP_AMOUNT

    if (!storeId || !channelKey) {
      console.error('PortOne store/channel configuration missing')
      alert('결제 연동 설정이 되어 있지 않습니다. 관리자에게 문의해주세요.')
      setFunding(false)
      return
    }

    if (totalAmount <= 0) {
      console.error('Invalid PortOne top-up amount configured', totalAmount)
      alert('결제 금액 설정을 확인해주세요.')
      setFunding(false)
      return
    }

    try {
      const isCapacitorApp = Capacitor.isNativePlatform()

      if (isCapacitorApp) {
        const paymentUrl = new URL('/points/charge/start', window.location.origin)
        paymentUrl.searchParams.set('paymentId', paymentId)
        paymentUrl.searchParams.set('storeId', storeId)
        paymentUrl.searchParams.set('channelKey', channelKey)
        paymentUrl.searchParams.set('orderName', orderName)
        paymentUrl.searchParams.set('totalAmount', totalAmount.toString())
        paymentUrl.searchParams.set('from_app', 'true')
        
        // userId 추가 (InAppBrowser 인증용)
        if (authUser?.id) {
          paymentUrl.searchParams.set('userId', authUser.id)
        }

        const finishedListener = await Browser.addListener('browserFinished', async () => {
          try {
            await fetch('/api/points/charge', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                paymentId,
                userId: authUser?.id  // userId 추가
              }),
            })
          } catch (error) {
            console.error('Payment verification failed after browser close.', error)
          } finally {
            fetchBalance()
          }
        })

        try {
          await Browser.open({
            url: paymentUrl.toString(),
            presentationStyle: 'fullscreen',
            windowName: '_blank',
            toolbarColor: '#ffffff',
          })
        } finally {
          await finishedListener.remove()
        }

        return
      }

      const resp = await PortOne.requestPayment({
        storeId,
        channelKey,
        paymentId,
        orderName,
        totalAmount,
        currency: 'CURRENCY_KRW',
        payMethod: 'CARD',
        redirectUrl: `${window.location.origin}/points/charge/callback?userId=${authUser?.id}`,
      })

      if (resp && resp.code !== undefined) {
        alert(resp.message || '결제가 취소되었습니다.')
        return
      }

      await fetch('/api/points/charge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          paymentId,
          userId: authUser?.id
        }),
      })

      fetchBalance()
    } catch (error) {
      console.error('Wallet funding payment failed.', error)
      alert('❌ 결제 연동 중 오류가 발생했습니다.')
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
          <div className="text-center py-2">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
        )}
        <div className="pb-20 px-4 pt-6 space-y-6">
        {/* 지갑 정보 */}
        <div className="bg-gradient-to-br from-blue-500 via-purple-600 to-indigo-700 rounded-3xl p-6 shadow-lg">
          <div className="flex items-center justify-between text-white">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                <span className="text-white text-2xl">💳</span>
              </div>
              <div>
                <h3 className="text-lg font-semibold">내 지갑</h3>
                <p className="text-sm opacity-80 font-mono">
                  {authUser.walletAddress?.slice(0, 6)}...{authUser.walletAddress?.slice(-4)}
                </p>
              </div>
            </div>
            {balance && (
              <div className="text-right">
                <p className="text-2xl font-bold">
                  {(balance.pointBalance ?? 0).toLocaleString()}P
                </p>
                <button
                  className="mt-2 bg-white/20 backdrop-blur-sm text-white px-3 py-1 rounded-xl text-sm font-medium"
                  onClick={handleFundWallet}
                  disabled={funding}
                >
                  {funding ? '결제 연결 중...' : '💰 충전'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 인기 이벤트 */}
        <div>
          <h2 className="text-xl font-bold mb-4 text-gray-900">🔥 인기 이벤트</h2>
          <Swiper spaceBetween={16} slidesPerView={1.1}>
            {featuredEvents.map((event) => (
              <SwiperSlide key={event.id}>
                <div className={`h-48 ${event.image} rounded-3xl p-6 flex items-end shadow-lg`}>
                  <div className="text-white">
                    <h3 className="font-bold text-lg mb-1">{event.title}</h3>
                    <p className="text-sm opacity-90">{event.date} · {event.location}</p>
                  </div>
                </div>
              </SwiperSlide>
            ))}
          </Swiper>
        </div>

        {/* 카테고리 */}
        <div>
          <h2 className="text-xl font-bold mb-4 text-gray-900">카테고리</h2>
          <div className="grid grid-cols-3 gap-4">
            {categories.map((category) => (
              <div key={category.id} className="bg-white rounded-2xl p-4 shadow-sm active:scale-95 transition-transform">
                <div className={`w-14 h-14 bg-gradient-to-br ${category.color} rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-sm`}>
                  <span className="text-white text-2xl">{category.icon}</span>
                </div>
                <p className="text-sm font-semibold text-gray-800 text-center">{category.name}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 티켓 목록 */}
        <div>
          <h2 className="text-xl font-bold mb-4 text-gray-900">🎪 바로 구매 가능한 티켓</h2>
          <div className="space-y-3">
            {directTickets.map((ticket) => (
              <div key={ticket.id} className="bg-white rounded-3xl p-5 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-purple-500 rounded-2xl flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-3xl">🎫</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 mb-1">{ticket.name}</h3>
                    <p className="text-sm text-gray-600 mb-2">{ticket.description}</p>
                    <div className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                      ticket.currentSupply >= ticket.maxSupply ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                    }`}>
                      {ticket.currentSupply}/{ticket.maxSupply} 판매됨
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-lg font-bold text-blue-600 mb-2">
                      {ticket.price.toLocaleString()}P
                    </p>
                    <PayButton
                      eventId={ticket.id}
                      disabled={ticket.currentSupply >= ticket.maxSupply}
                      onSuccess={() => {
                        fetchTickets()
                        fetchBalance()
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
            {!loading && directTickets.length === 0 && (
              <div className="bg-white rounded-3xl p-5 shadow-sm text-center text-gray-500">
                바로 구매 가능한 티켓이 없습니다.
              </div>
            )}
          </div>
        </div>

        {/* 추첨 신청 가능한 티켓 */}
        <div>
          <h2 className="text-xl font-bold mb-4 text-gray-900">🍀 추첨 신청 가능한 티켓</h2>
          <div className="space-y-3">
            {lotteryTickets.map((ticket) => (
              <div key={`${ticket.id}-${ticket.roundId}`} className="bg-white rounded-3xl p-5 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-emerald-400 to-blue-500 rounded-2xl flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-3xl">🍀</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 mb-1">{ticket.name}</h3>
                    <p className="text-sm text-gray-600 mb-2">{ticket.description}</p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                      <span className="inline-flex items-center bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full font-medium">
                        추첨 신청 마감 {new Date(ticket.applicationDeadline).toLocaleString()}
                      </span>
                      <span className="inline-flex items-center bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">
                        {ticket.price.toLocaleString()}P (당첨 시 결제)
                      </span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <button
                      className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-2xl text-sm font-semibold transition disabled:bg-gray-300 disabled:text-gray-500"
                      onClick={() => router.push(`/lottery/${ticket.roundId}`)}
                    >
                      추첨 신청
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {!loading && lotteryTickets.length === 0 && (
              <div className="bg-white rounded-3xl p-5 shadow-sm text-center text-gray-500">
                현재 신청 가능한 추첨 티켓이 없습니다.
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
