'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Swiper, SwiperSlide } from 'swiper/react'
import { Settings } from '@mui/icons-material'
import PayButton from '@/components/PayButton'
import 'swiper/css'

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
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [tickets, setTickets] = useState<TicketData[]>([])
  const [balance, setBalance] = useState<BalanceData | null>(null)
  const [purchasing, setPurchasing] = useState<string | null>(null)
  const [funding, setFunding] = useState(false)

  useEffect(() => {
    fetch('/api/auth/session')
      .then(res => res.json())
      .then(data => {
        if (data.user) {
          setSession({ user: data.user })
        } else {
          router.push('/login')
        }
      })
  }, [router])

  useEffect(() => {
    if (session) {
      fetchTickets()
      fetchBalance()
    }
  }, [session])

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
    if (!session?.user?.walletAddress) return

    try {
      const response = await fetch(`/api/balance?address=${session.user.walletAddress}`)
      const data = await response.json()
      setBalance(data)
    } catch (error) {
      console.error('Error fetching balance:', error)
    }
  }

  const handlePurchase = async (ticketId: string) => {
    if (!session?.user?.walletAddress) {
      alert('지갑 주소가 없습니다.')
      return
    }

    if (purchasing) return

    setPurchasing(ticketId)
    try {
      const response = await fetch('/api/purchase-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId })
      })

      const data = await response.json()

      if (data.success) {
        alert('🎉 티켓 구매 성공!')
        fetchTickets()
        fetchBalance()
      } else {
        alert(`❌ 구매 실패: ${data.error}`)
      }
    } catch (error) {
      alert('❌ 구매 중 오류가 발생했습니다.')
    } finally {
      setPurchasing(null)
    }
  }

  const handleFundWallet = async () => {
    if (funding) return
    setFunding(true)
    try {
      const response = await fetch('/api/wallet/fund', { method: 'POST' })
      const data = await response.json()
      if (data.success) {
        if (data.alreadyFunded) {
          alert(`💰 이미 충분한 잔액이 있습니다!\n현재 잔액: ${data.balance} ETH`)
        } else {
          alert(`🎉 충전 완료!\n${data.amount} ETH가 지갑에 추가되었습니다!\n새 잔액: ${data.newBalance} ETH`)
        }
        fetchBalance()
      } else {
        alert(`❌ 충전 실패: ${data.error}`)
      }
    } catch (error) {
      alert('❌ 충전 중 오류가 발생했습니다.')
    } finally {
      setFunding(false)
    }
  }

  if (!session) return null

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
                  {session.user?.walletAddress?.slice(0, 6)}...{session.user?.walletAddress?.slice(-4)}
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
                    {funding ? '충전 중...' : '💰 충전'}
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
                    <PayButton />
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