'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import usePullToRefresh from '@/hooks/usePullToRefresh'
import TopBar from '@/components/TopBar'
import TabNavigation from '@/components/TabNavigation'
import { Settings, Bell, HelpCircle, LogOut, User, ScanLine, Copy, Check } from 'lucide-react'
import LoadingSpinner from '@/components/LoadingSpinner'
import toast from 'react-hot-toast';
import { copyToClipboard } from '@/lib/copy-to-clipboard';

interface Purchase {
  id: string
  eventId: string
  ticketId: string
  pointAmount: number
  purchaseDate: string
  used: boolean
}

interface LotteryRoundOption {
  id: string
  status: 'OPEN' | 'CLOSED'
  applicationDeadline: string
  event: {
    id: number
    title: string
    ticketCount: number
  }
  applicantCount: number
}

export default function ProfilePage() {
  const router = useRouter()
  const { user, token, logout, isLoading: authLoading } = useAuth()
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [copied, setCopied] = useState(false)
  const [directEventForm, setDirectEventForm] = useState({ title: '', ticketCount: '2', price: '10000' })
  const [lotteryEventForm, setLotteryEventForm] = useState({
    title: '',
    ticketCount: '2',
    price: '10000',
    applicationDeadlineMinutes: '60',
  })
  const [isCreatingDirectEvent, setIsCreatingDirectEvent] = useState(false)
  const [isCreatingLotteryEvent, setIsCreatingLotteryEvent] = useState(false)
  const [lotteryRounds, setLotteryRounds] = useState<LotteryRoundOption[]>([])
  const [selectedRoundId, setSelectedRoundId] = useState('')
  const [isLoadingRounds, setIsLoadingRounds] = useState(false)
  const [isDrawingRound, setIsDrawingRound] = useState(false)

  const fetchPurchases = useCallback(async () => {
    if (!token) return
    try {
      const response = await fetch('/api/purchases', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      const data = await response.json()
      if (data.success) {
        setPurchases(data.purchases)
      }
    } catch (error) {
      console.error('Error fetching purchases:', error)
    }
  }, [token])

  const refreshLotteryRounds = useCallback(async () => {
    setIsLoadingRounds(true)
    try {
      const response = await fetch('/api/test-tools/lottery/rounds')
      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error ?? '라운드 목록을 불러오지 못했습니다.')
      }

      const rounds = data.rounds as LotteryRoundOption[]
      setLotteryRounds(rounds)
      setSelectedRoundId((prev) => {
        if (prev && rounds.some((round) => round.id === prev)) {
          return prev
        }
        return rounds[0]?.id ?? ''
      })
    } catch (error) {
      console.error('Failed to load rounds:', error)
      toast.error(error instanceof Error ? error.message : '라운드 목록을 불러오지 못했습니다.')
    } finally {
      setIsLoadingRounds(false)
    }
  }, [])

  const { containerRef, isRefreshing } = usePullToRefresh(fetchPurchases)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.push('/login')
    } else {
      fetchPurchases()
    }
  }, [authLoading, user, router, fetchPurchases])

  useEffect(() => {
    if (user) {
      refreshLotteryRounds()
    }
  }, [user, refreshLotteryRounds])

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      logout()
      router.push('/login')
    }
  }

  const handleCopyAddress = async () => {
    if (!user?.walletAddress) return

    try {
      await copyToClipboard(user.walletAddress)
      setCopied(true)
      toast.success('주소가 복사되었습니다.');
      
      // 2초 후 복사 상태 초기화
      setTimeout(() => {
        setCopied(false)
      }, 2000)
    } catch (error) {
      console.error('Failed to copy address:', error)
      toast.error('주소 복사에 실패했습니다.')
    }
  }

  const handleCreateDirectEvent = async () => {
    const ticketCount = Number(directEventForm.ticketCount)
    const price = Number(directEventForm.price)

    if (!directEventForm.title.trim()) {
      toast.error('이벤트 제목을 입력해주세요.')
      return
    }

    if (!Number.isFinite(ticketCount) || ticketCount < 1) {
      toast.error('티켓 수는 1 이상이어야 합니다.')
      return
    }

    if (!Number.isFinite(price) || price < 0) {
      toast.error('가격을 올바르게 입력해주세요.')
      return
    }

    setIsCreatingDirectEvent(true)
    try {
      const response = await fetch('/api/test-tools/events/direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: directEventForm.title,
          ticketCount,
          price,
        }),
      })

      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.error ?? '이벤트 생성에 실패했습니다.')
      }

      toast.success(`"${data.event.title}" 이벤트가 생성되었습니다.`)
      setDirectEventForm({ title: '', ticketCount: directEventForm.ticketCount, price: directEventForm.price })
    } catch (error) {
      console.error('Direct event creation failed:', error)
      toast.error(error instanceof Error ? error.message : '이벤트 생성에 실패했습니다.')
    } finally {
      setIsCreatingDirectEvent(false)
    }
  }

  const handleCreateLotteryEvent = async () => {
    const ticketCount = Number(lotteryEventForm.ticketCount)
    const price = Number(lotteryEventForm.price)
    const applicationDeadlineMinutes = Number(lotteryEventForm.applicationDeadlineMinutes)

    if (!lotteryEventForm.title.trim()) {
      toast.error('추첨 이벤트 제목을 입력해주세요.')
      return
    }

    if (!Number.isFinite(ticketCount) || ticketCount < 1) {
      toast.error('티켓 수는 1 이상이어야 합니다.')
      return
    }

    if (!Number.isFinite(price) || price < 0) {
      toast.error('가격을 올바르게 입력해주세요.')
      return
    }

    if (!Number.isFinite(applicationDeadlineMinutes) || applicationDeadlineMinutes < 5) {
      toast.error('신청 마감 시간은 5분 이상으로 입력해주세요.')
      return
    }

    setIsCreatingLotteryEvent(true)
    try {
      const response = await fetch('/api/test-tools/events/lottery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: lotteryEventForm.title,
          ticketCount,
          price,
          applicationDeadlineMinutes,
        }),
      })

      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.error ?? '추첨 이벤트 생성에 실패했습니다.')
      }

      toast.success(`"${data.event.title}" 추첨 이벤트가 생성되었습니다.`)
      setLotteryEventForm({
        title: '',
        ticketCount: lotteryEventForm.ticketCount,
        price: lotteryEventForm.price,
        applicationDeadlineMinutes: lotteryEventForm.applicationDeadlineMinutes,
      })
      refreshLotteryRounds()
    } catch (error) {
      console.error('Lottery event creation failed:', error)
      toast.error(error instanceof Error ? error.message : '추첨 이벤트 생성에 실패했습니다.')
    } finally {
      setIsCreatingLotteryEvent(false)
    }
  }

  const handleDrawRound = async () => {
    if (!selectedRoundId) {
      toast.error('추첨할 라운드를 선택해주세요.')
      return
    }

    setIsDrawingRound(true)
    try {
      const response = await fetch(`/api/lottery/rounds/${selectedRoundId}/draw?force=true`, {
        method: 'POST',
      })
      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error ?? '추첨 실행에 실패했습니다.')
      }

      toast.success(`추첨 완료! 당첨자 ${data.winners.count}명 / 결제 성공 ${data.payment.successCount}명`)
      refreshLotteryRounds()
    } catch (error) {
      console.error('Lottery draw failed:', error)
      toast.error(error instanceof Error ? error.message : '추첨 실행에 실패했습니다.')
    } finally {
      setIsDrawingRound(false)
    }
  }

  const stats = useMemo(() => {
    const heldTickets = purchases.filter(p => !p.used).length
    const usedTickets = purchases.filter(p => p.used).length
    return { heldTickets, usedTickets }
  }, [purchases])

  const menuItems = [
    {
      icon: ScanLine,
      label: '티켓 검증',
      action: () => router.push('/admin/scan'),
    },
    {
      icon: Settings,
      label: '설정',
      action: () => console.log('설정'),
    },
    {
      icon: Bell,
      label: '알림',
      action: () => console.log('알림'),
    },
    {
      icon: HelpCircle,
      label: '고객센터',
      action: () => console.log('고객센터'),
    },
    {
      icon: LogOut,
      label: '로그아웃',
      action: handleLogout,
      danger: true,
    },
  ]

  if (authLoading || !user) {
    return (
      <div className="bg-gray-50 min-h-[var(--app-height)] flex justify-center items-center">
        <LoadingSpinner size={48} />
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-b from-indigo-50/30 via-white to-blue-50/30 h-[var(--app-height)] flex flex-col">
      <TopBar title="프로필" />

      <main ref={containerRef} className="flex-1 overflow-y-auto">
        {isRefreshing && (
          <div className="text-center py-2">
            <LoadingSpinner size={24} />
          </div>
        )}
        <div className="px-4 py-6 space-y-6">
          <div className="bg-gradient-to-br from-indigo-500/5 to-blue-500/5 backdrop-blur-sm rounded-3xl p-6 shadow-sm border border-indigo-100/50">
            <div className="flex items-center space-x-4 mb-6">
              <div className="w-20 h-20 bg-indigo-500/10 backdrop-blur-xl border border-indigo-200/30 rounded-full flex items-center justify-center">
                <User className="h-10 w-10 text-indigo-600" strokeWidth={1.5} />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-900 mb-1">{user?.name ?? '사용자'}</h2>
                <p className="text-gray-500 text-sm font-mono">{user?.email ?? 'user@example.com'}</p>
              </div>
            </div>

            {/* 지갑 주소 */}
            {user?.walletAddress && (
              <button
                onClick={handleCopyAddress}
                className="w-full bg-white/60 backdrop-blur-sm border border-indigo-100/50 rounded-2xl p-4 mb-4 active:scale-[0.98] transition-all duration-150 hover:bg-white/80"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 text-left mr-3">
                    <p className="text-xs text-gray-500 mb-1">지갑 주소</p>
                    <p className="text-sm font-mono text-gray-800 break-all">
                      {user.walletAddress}
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    {copied ? (
					  <Check size={18} className="text-emerald-600" />
                    ) : (
                      <Copy size={18} className="text-gray-400" />
                    )}
                  </div>
                </div>
              </button>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-500/5 backdrop-blur-xl border border-blue-200/30 rounded-2xl p-3 text-center">
                <p className="text-2xl font-bold text-gray-900 mb-1">{stats.heldTickets}</p>
                <p className="text-xs text-gray-600">보유 티켓</p>
              </div>
              <div className="bg-emerald-500/5 backdrop-blur-xl border border-emerald-200/30 rounded-2xl p-3 text-center">
                <p className="text-2xl font-bold text-gray-900 mb-1">{stats.usedTickets}</p>
                <p className="text-xs text-gray-600">사용한 티켓</p>
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-3xl overflow-hidden shadow-sm border border-gray-100/50">
            {menuItems.map((item, index) => {
              const IconComponent = item.icon
              return (
                <button
                  key={index}
                  onClick={item.action}
                  className={`w-full flex items-center justify-between p-4 border-b border-gray-100/50 last:border-0 active:scale-[0.98] transition-all duration-150 ${
                    item.danger ? 'text-red-600' : item.highlight ? 'text-emerald-700' : 'text-gray-800'
                  }`}
                >
                  <div className="flex items-center space-x-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                      item.danger
                        ? 'bg-red-500/10 backdrop-blur-xl border border-red-200/30'
                        : item.highlight
                        ? 'bg-emerald-500/10 backdrop-blur-xl border border-emerald-200/30'
                        : 'bg-gray-500/5 backdrop-blur-xl border border-gray-200/30'
                    }`}>
                      <IconComponent className="h-6 w-6" strokeWidth={2} />
                    </div>
                    <span className="font-semibold text-base">{item.label}</span>
                  </div>
                  <div className="text-gray-300">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                </button>
              )
            })}
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-5 shadow-sm border border-gray-100/50 space-y-6">
            <h3 className="text-base font-bold text-gray-900">이벤트 & 추첨 도구</h3>

            <section className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-gray-800 mb-1">일반 이벤트 만들기</p>
                <p className="text-xs text-gray-500">즉시 판매형 이벤트를 빠르게 생성합니다.</p>
              </div>
              <input
                type="text"
                placeholder="이벤트 제목"
                value={directEventForm.title}
                onChange={(e) => setDirectEventForm((prev) => ({ ...prev, title: e.target.value }))}
                className="w-full rounded-2xl border border-gray-200/70 bg-white px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">티켓 수</label>
                  <input
                    type="number"
                    min={1}
                    value={directEventForm.ticketCount}
                    onChange={(e) => setDirectEventForm((prev) => ({ ...prev, ticketCount: e.target.value }))}
                    className="w-full rounded-2xl border border-gray-200/70 bg-white px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">가격 (P)</label>
                  <input
                    type="number"
                    min={0}
                    value={directEventForm.price}
                    onChange={(e) => setDirectEventForm((prev) => ({ ...prev, price: e.target.value }))}
                    className="w-full rounded-2xl border border-gray-200/70 bg-white px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={handleCreateDirectEvent}
                disabled={isCreatingDirectEvent}
                className="w-full rounded-2xl bg-indigo-500 text-white py-3 text-sm font-semibold active:scale-[0.98] transition disabled:opacity-60"
              >
                {isCreatingDirectEvent ? '생성 중...' : '일반 이벤트 만들기'}
              </button>
            </section>

            <div className="h-px bg-gray-100" />

            <section className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-gray-800 mb-1">추첨 이벤트 만들기</p>
                <p className="text-xs text-gray-500">라운드와 온체인 lottery를 함께 생성합니다.</p>
              </div>
              <input
                type="text"
                placeholder="추첨 이벤트 제목"
                value={lotteryEventForm.title}
                onChange={(e) => setLotteryEventForm((prev) => ({ ...prev, title: e.target.value }))}
                className="w-full rounded-2xl border border-gray-200/70 bg-white px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">티켓 수</label>
                  <input
                    type="number"
                    min={1}
                    value={lotteryEventForm.ticketCount}
                    onChange={(e) => setLotteryEventForm((prev) => ({ ...prev, ticketCount: e.target.value }))}
                    className="w-full rounded-2xl border border-gray-200/70 bg-white px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">가격 (P)</label>
                  <input
                    type="number"
                    min={0}
                    value={lotteryEventForm.price}
                    onChange={(e) => setLotteryEventForm((prev) => ({ ...prev, price: e.target.value }))}
                    className="w-full rounded-2xl border border-gray-200/70 bg-white px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">신청 마감 (분)</label>
                <input
                  type="number"
                  min={5}
                  value={lotteryEventForm.applicationDeadlineMinutes}
                  onChange={(e) =>
                    setLotteryEventForm((prev) => ({ ...prev, applicationDeadlineMinutes: e.target.value }))
                  }
                  className="w-full rounded-2xl border border-gray-200/70 bg-white px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
              </div>
              <button
                type="button"
                onClick={handleCreateLotteryEvent}
                disabled={isCreatingLotteryEvent}
                className="w-full rounded-2xl bg-blue-500 text-white py-3 text-sm font-semibold active:scale-[0.98] transition disabled:opacity-60"
              >
                {isCreatingLotteryEvent ? '생성 중...' : '추첨 이벤트 만들기'}
              </button>
            </section>

            <div className="h-px bg-gray-100" />

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-800 mb-1">추첨 실행</p>
                  <p className="text-xs text-gray-500">라운드를 선택하고 추첨을 실행합니다.</p>
                </div>
                <button
                  type="button"
                  onClick={refreshLotteryRounds}
                  disabled={isLoadingRounds}
                  className="px-3 py-1.5 text-xs font-semibold text-indigo-600 border border-indigo-200 rounded-full bg-indigo-50/70 disabled:opacity-60"
                >
                  {isLoadingRounds ? '로딩...' : '라운드 새로고침'}
                </button>
              </div>
              <select
                value={selectedRoundId}
                onChange={(e) => setSelectedRoundId(e.target.value)}
                className="w-full rounded-2xl border border-gray-200/70 bg-white px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              >
                {lotteryRounds.length === 0 && <option value="">추첨 가능한 라운드가 없습니다</option>}
                {lotteryRounds.map((round) => (
                  <option key={round.id} value={round.id}>
                    {round.event.title} · {round.status} · 신청 {round.applicantCount}명
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleDrawRound}
                disabled={isDrawingRound || !selectedRoundId}
                className="w-full rounded-2xl bg-emerald-500 text-white py-3 text-sm font-semibold active:scale-[0.98] transition disabled:opacity-60"
              >
                {isDrawingRound ? '추첨 중...' : '추첨 실행'}
              </button>
            </section>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-5 shadow-sm border border-gray-100/50">
            <h3 className="text-base font-bold text-gray-900 mb-4">앱 정보</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center py-1">
                <span className="text-gray-600">버전</span>
                <span className="font-semibold text-gray-900">1.0.0</span>
              </div>
              <div className="h-px bg-gray-100" />
              <div className="flex justify-between items-center py-1">
                <span className="text-gray-600">개발자</span>
                <span className="font-semibold text-gray-900">Double-Yun</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      <TabNavigation />
    </div>
  )
}
