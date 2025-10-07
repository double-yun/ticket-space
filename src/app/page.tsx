'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Swiper, SwiperSlide } from 'swiper/react'
import { Settings } from '@mui/icons-material'
import PayButton from '@/components/PayButton'
import * as PortOne from '@portone/browser-sdk/v2'
import { Capacitor } from '@capacitor/core'
import { Browser } from '@capacitor/browser'
import 'swiper/css'
interface SessionUser {
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
  price: string
  maxSupply: number
  currentSupply: number
  imageUrl?: string
  isActive: boolean
}

interface BalanceData {
  success: boolean
  address?: string
  ethBalance?: string
  nftBalance?: string
  totalSupply?: string
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

export default function Home() {
  const router = useRouter()
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [tickets, setTickets] = useState<TicketData[]>([])
  const [balance, setBalance] = useState<BalanceData | null>(null)
  const [funding, setFunding] = useState(false)

  useEffect(() => {
    fetch('/api/auth/session')
      .then(res => res.json())
      .then((data: { user: SessionUser | null }) => {
        if (data?.user) {
          setSessionUser(data.user)
        } else {
          router.push('/login')
        }
      })
  }, [router])

  // Deep Link 처리 (결제 완료 후 앱으로 돌아올 때)
  useEffect(() => {
    const { App } = require('@capacitor/app')

    const handleAppUrlOpen = async (event: any) => {
      console.log('App URL opened:', event.url)

      // ticketspace://payment-result?paymentId=...&returnUrl=... 형식
      if (event.url.startsWith('ticketspace://payment-result')) {
        const url = new URL(event.url.replace('ticketspace://', 'https://dummy.com/'))
        const paymentId = url.searchParams.get('paymentId')
        const returnUrl = url.searchParams.get('returnUrl') || '/'

        if (paymentId) {
          // payment-result 페이지로 이동
          router.push(`/payment-result?paymentId=${paymentId}&returnUrl=${encodeURIComponent(returnUrl)}`)
        }
      }
    }

    if (Capacitor.isNativePlatform()) {
      App.addListener('appUrlOpen', handleAppUrlOpen)

      return () => {
        App.removeAllListeners()
      }
    }
  }, [router])

  useEffect(() => {
    if (sessionUser) {
      fetchTickets()
      fetchBalance()
    }
  }, [sessionUser])

  // 페이지가 다시 포커스될 때 잔액 새로고침 (결제 후 돌아왔을 때)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && sessionUser) {
        fetchBalance()
        setFunding(false) // 결제 상태 초기화
      }
    }

    const handleFocus = () => {
      if (sessionUser) {
        fetchBalance()
        setFunding(false) // 결제 상태 초기화
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [sessionUser])

  const fetchTickets = async () => {
    try {
      const response = await fetch('/api/tickets')
      const data = await response.json()
      setTickets(data.tickets || [])
    } catch (error) {
      console.error('Error fetching tickets:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchBalance = async () => {
    if (!sessionUser?.walletAddress) return

    try {
      const response = await fetch(`/api/balance?address=${sessionUser.walletAddress}`)
      const data = await response.json()
      setBalance(data)
    } catch (error) {
      console.error('Error fetching balance:', error)
    }
  }

  const handleFundWallet = async () => {
    if (funding) {
      console.log('이미 결제 진행 중입니다.')
      return
    }

    setFunding(true)
    console.log('결제 시작...')

    const generateUUID = () =>
      'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = (Math.random() * 16) | 0
        const v = c === 'x' ? r : (r & 0x3) | 0x8
        return v.toString(16)
      })

    const paymentId = `payment-${generateUUID()}-${Date.now()}`
    const storeId = 'store-c9209e03-9213-49bb-99bc-904ae521bb56'
    const channelKey = 'channel-key-87cd1fa3-c29c-4125-be0a-b4fb02f993bc'
    const orderName = '지갑 충전'
    const totalAmount = '1000'

    console.log('결제 정보:', { paymentId, isCapacitor: Capacitor.isNativePlatform() })

    try {
      const isCapacitorApp = Capacitor.isNativePlatform()

      // 리다이렉트 URL 설정
      const redirectUrl = isCapacitorApp
        ? `ticketspace://payment-result?paymentId=${paymentId}&returnUrl=${encodeURIComponent(window.location.pathname)}`
        : `${window.location.origin}/payment-redirect`

      console.log('redirectUrl:', redirectUrl)

      // PortOne 결제 시작
      console.log('PortOne.requestPayment 호출 시작')
      const resp = await PortOne.requestPayment({
        storeId,
        channelKey,
        paymentId,
        orderName,
        totalAmount: Number(totalAmount),
        currency: 'CURRENCY_KRW',
        payMethod: 'CARD',
        redirectUrl,
      })

      console.log('PortOne.requestPayment 응답:', resp)

      // 앱 환경에서는 외부 브라우저로 이동하므로 여기서 상태 초기화
      if (isCapacitorApp) {
        console.log('앱 환경 - 상태 초기화')
        setFunding(false)
        return
      }

      // 결제 실패/취소 시
      if (resp && resp.code !== undefined) {
        console.log('결제 실패/취소:', resp.code, resp.message)
        alert(resp.message || '결제가 취소되었습니다.')
        setFunding(false)
        return
      }

      // 웹 환경에서만 여기 도달
      console.log('웹 환경 - 결제 완료 처리')
      await fetch('/api/payment/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId }),
      })

      fetchBalance()
    } catch (error) {
      console.error('Wallet funding payment failed.', error)
      alert('❌ 결제 연동 중 오류가 발생했습니다.')
      setFunding(false)
    } finally {
      console.log('결제 처리 완료 - finally 블록')
      setFunding(false)
    }
  }

  if (!sessionUser) return null

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* 상단바 */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex justify-between items-center">
        <h1 className="text-xl font-bold">티켓팅</h1>
        <button
          onClick={async () => {
            await fetch('/api/auth/logout', { method: 'POST' })
            router.push('/login')
          }}
        >
          <Settings className="text-gray-600" />
        </button>
      </div>

      <div className="pb-20 px-4 space-y-6 pt-6">
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
                  {sessionUser.walletAddress?.slice(0, 6)}...{sessionUser.walletAddress?.slice(-4)}
                </p>
              </div>
            </div>
            {balance && (
              <div className="text-right">
                <p className="text-2xl font-bold">{balance.ethBalance} ETH</p>
                <p className="text-sm opacity-80">NFT: {balance.nftBalance}개</p>
                {parseFloat(balance.ethBalance) < 0.1 && (
                  <button
                    className="mt-2 bg-white/20 backdrop-blur-sm text-white px-3 py-1 rounded-xl text-sm font-medium"
                    onClick={handleFundWallet}
                    disabled={funding}
                  >
                    {funding ? '결제 연결 중...' : '💰 충전'}
                  </button>
                )}
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
          <h2 className="text-xl font-bold mb-4 text-gray-900">🎪 이용 가능한 티켓</h2>
          <div className="space-y-3">
            {tickets.map((ticket) => (
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
                      {(parseFloat(ticket.price) / 1e18).toFixed(3)} ETH
                    </p>
                    <PayButton
                      ticketId={ticket.id}
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
          </div>
        </div>
      </div>

      {/* 하단 네비게이션 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200">
        <div className="flex">
          <button onClick={() => router.push('/')} className="flex-1 flex flex-col items-center py-3 text-blue-600">
            <span className="text-lg">🏠</span>
            <span className="text-xs mt-1">홈</span>
          </button>
          <button onClick={() => router.push('/search')} className="flex-1 flex flex-col items-center py-3 text-gray-500">
            <span className="text-lg">🔍</span>
            <span className="text-xs mt-1">검색</span>
          </button>
          <button onClick={() => router.push('/my-tickets')} className="flex-1 flex flex-col items-center py-3 text-gray-500">
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
