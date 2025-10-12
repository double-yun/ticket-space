'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import TabNavigation from '@/components/TabNavigation'
import TopBar from '@/components/TopBar'
import usePullToRefresh from '@/hooks/usePullToRefresh'
import LoadingSpinner from '@/components/LoadingSpinner'
import { Info, PartyPopper, Folder, Clock, Ticket } from 'lucide-react'

type ApplicationStatus = 'APPLIED' | 'WON' | 'PAID' | 'EXPIRED' | 'CANCELLED'
type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED'

interface LotteryApplication {
  id: string
  roundId: string
  status: ApplicationStatus
  paymentStatus: PaymentStatus
  priority: number | null
  pointAmount: number | null
  paymentDeadline: string | null
  createdAt: string
  updatedAt: string
  round: {
    id: string
    roundNumber: number
    status: string
    applicationDeadline: string
    drawnAt: string | null
    event: {
      id: number
      title: string
      description: string
      price: number
      deadline: string
      saleStart: string | null
    }
  } | null
  ticket: {
    id: string
    tokenId: string | null
    txHash: string | null
    issuedAt: string
  } | null
}

const statusLabels: Record<ApplicationStatus, string> = {
  APPLIED: '추첨 대기',
  WON: '당첨',
  PAID: '발급 완료',
  EXPIRED: '기한 만료',
  CANCELLED: '취소됨',
}

const paymentStatusLabels: Record<PaymentStatus, string> = {
  PENDING: '결제 대기',
  PAID: '결제 완료',
  FAILED: '결제 실패',
  REFUNDED: '환불 완료',
}

function formatDate(dateString: string | null) {
  if (!dateString) return null
  const timestamp = Date.parse(dateString)
  if (Number.isNaN(timestamp)) return null
  const date = new Date(timestamp)
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

function getStatusBadgeColors(status: ApplicationStatus) {
  switch (status) {
    case 'APPLIED':
      return 'bg-blue-100 text-blue-700'
    case 'WON':
      return 'bg-emerald-100 text-emerald-700'
    case 'PAID':
      return 'bg-purple-100 text-purple-700'
    case 'EXPIRED':
      return 'bg-gray-200 text-gray-600'
    case 'CANCELLED':
      return 'bg-gray-200 text-gray-600'
    default:
      return 'bg-gray-200 text-gray-600'
  }
}

function getPaymentBadgeColors(status: PaymentStatus) {
  switch (status) {
    case 'PENDING':
      return 'bg-amber-100 text-amber-700'
    case 'PAID':
      return 'bg-emerald-100 text-emerald-700'
    case 'FAILED':
      return 'bg-red-100 text-red-700'
    case 'REFUNDED':
      return 'bg-purple-100 text-purple-700'
    default:
      return 'bg-gray-200 text-gray-600'
  }
}

export default function LotteryApplicationsPage() {
  const router = useRouter()
  const { user, token, isLoading: authLoading } = useAuth()
  const [applications, setApplications] = useState<LotteryApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { containerRef, isRefreshing } = usePullToRefresh(async () => {
    await fetchApplications()
  })

  const fetchApplications = useCallback(async () => {
    if (!token) {
      return
    }

    try {
      const response = await fetch('/api/lottery/applications', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      if (!response.ok) {
        throw new Error('failed')
      }
      const data = await response.json()
      setApplications(data.applications ?? [])
      setError(null)
    } catch (err) {
      console.error('Failed to fetch lottery applications', err)
      setError('신청 내역을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    if (authLoading) {
      return
    }

    if (!user || !token) {
      router.push('/login')
      return
    }

    setLoading(true)
    fetchApplications()
  }, [authLoading, user, token, router, fetchApplications])

  const { pendingApplications, completedApplications } = useMemo(() => {
    const pending = applications.filter(app => app.status === 'APPLIED' || app.status === 'WON')
    const completed = applications.filter(app => app.status !== 'APPLIED' && app.status !== 'WON')
    return { pendingApplications: pending, completedApplications: completed }
  }, [applications])

  return (
    <div className="bg-gradient-to-b from-emerald-50/30 via-white to-blue-50/30 h-[var(--app-height)] flex flex-col">
      <TopBar title="추첨 내역" />

      <main ref={containerRef} className="flex-1 overflow-y-auto">
        {isRefreshing && (
          <div className="text-center py-2">
            <LoadingSpinner size={24} />
          </div>
        )}
        <div className="px-4 py-6 space-y-8">
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-5 shadow-sm border border-gray-100/50">
            <h2 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-500/10 backdrop-blur-xl border border-blue-200/30 rounded-lg flex items-center justify-center">
                <Info size={18} className="text-blue-600" />
              </div>
              자동 결제 안내
            </h2>
            <p className="text-sm text-gray-600 leading-6">
              추첨에 당첨되면 포인트가 자동으로 차감되고 SBT 티켓이 발급돼요. 잔액이 부족하면 결제가 실패할 수 있으니 여유 있게 충전해 주세요.
            </p>
          </div>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">진행 중인 추첨</h2>
            <div className="space-y-4">
              {pendingApplications.map((application) => (
                <ApplicationCard key={application.id} application={application} />
              ))}
              {!loading && pendingApplications.length === 0 && (
                <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-8 shadow-sm text-center border border-gray-100/50">
                  <div className="flex justify-center mb-4">
                    <div className="w-20 h-20 bg-emerald-500/5 backdrop-blur-xl border border-emerald-200/30 rounded-2xl flex items-center justify-center">
                      <PartyPopper size={40} className="text-emerald-400" strokeWidth={2} />
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800">진행 중인 추첨이 없습니다</h3>
                  <p className="text-sm text-gray-500 mt-2">새로운 추첨 이벤트를 기대해주세요!</p>
                </div>
              )}
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">지난 추첨</h2>
            <div className="space-y-4">
              {completedApplications.map((application) => (
                <ApplicationCard key={application.id} application={application} />
              ))}
              {!loading && completedApplications.length === 0 && (
                <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-8 shadow-sm text-center border border-gray-100/50">
                  <div className="flex justify-center mb-4">
                    <div className="w-20 h-20 bg-gray-500/5 backdrop-blur-xl border border-gray-200/30 rounded-2xl flex items-center justify-center">
                      <Folder size={40} className="text-gray-400" strokeWidth={2} />
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800">지난 추첨 내역이 없습니다</h3>
                </div>
              )}
            </div>
          </section>

          {loading && (
            <div className="text-center text-gray-500 py-8">불러오는 중...</div>
          )}
          {error && (
            <div className="text-center text-red-500 text-sm py-8">{error}</div>
          )}
        </div>
      </main>

      <TabNavigation />
    </div>
  )
}

function ApplicationCard({ application }: { application: LotteryApplication }) {
  const eventTitle = application.round?.event.title ?? '알 수 없는 이벤트'
  const roundNumber = application.round?.roundNumber
  const statusLabel = statusLabels[application.status]
  const statusColor = getStatusBadgeColors(application.status)
  const paymentLabel = paymentStatusLabels[application.paymentStatus]
  const deadline = formatDate(application.round?.applicationDeadline ?? null)
  const drawTime = formatDate(application.round?.drawnAt ?? null)
  const createdAt = formatDate(application.createdAt)

  const getCardStyle = (status: ApplicationStatus) => {
    switch (status) {
      case 'APPLIED':
        return { bg: 'bg-blue-500/10 backdrop-blur-xl border border-blue-200/30', icon: 'text-blue-600' }
      case 'WON':
        return { bg: 'bg-emerald-500/10 backdrop-blur-xl border border-emerald-200/30', icon: 'text-emerald-600' }
      case 'PAID':
        return { bg: 'bg-purple-500/10 backdrop-blur-xl border border-purple-200/30', icon: 'text-purple-600' }
      default:
        return { bg: 'bg-gray-500/10 backdrop-blur-xl border border-gray-200/30', icon: 'text-gray-500' }
    }
  }

  const cardStyle = getCardStyle(application.status)

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-5 shadow-sm border border-gray-100/50 transition-transform duration-200">
      <div className="flex items-start gap-5 mb-4">
        <div className={`w-20 h-20 ${cardStyle.bg} rounded-2xl flex items-center justify-center flex-shrink-0`}>
          {application.status === 'APPLIED' ? (
            <Clock size={40} className={cardStyle.icon} strokeWidth={2} />
          ) : application.status === 'WON' ? (
            <PartyPopper size={40} className={cardStyle.icon} strokeWidth={2} />
          ) : application.status === 'PAID' ? (
            <Ticket size={40} className={cardStyle.icon} strokeWidth={2} />
          ) : (
            <Folder size={40} className={cardStyle.icon} strokeWidth={2} />
          )}
        </div>
        <div className="flex-1">
          <div className="flex justify-between items-start mb-1.5">
            <h3 className="font-bold text-lg text-gray-900 line-clamp-2">{eventTitle}</h3>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColor}`}>
              {statusLabel}
            </span>
          </div>
          {roundNumber !== undefined && (
            <p className="text-sm font-semibold text-gray-600 mb-3">라운드 #{roundNumber}</p>
          )}
        </div>
      </div>

      <div className="space-y-3 text-sm text-gray-600 bg-gray-50/70 p-4 rounded-2xl">
        <div className="flex items-center justify-between">
          <span className="font-semibold">신청일</span>
          <span className="font-mono text-gray-800">{createdAt}</span>
        </div>
        {deadline !== '-' && (
          <div className="flex items-center justify-between">
            <span className="font-semibold">신청 마감</span>
            <span className="font-mono text-gray-800">{deadline}</span>
          </div>
        )}
        {drawTime !== '-' && (
          <div className="flex items-center justify-between">
            <span className="font-semibold">추첨 시간</span>
            <span className="font-mono text-gray-800">{drawTime}</span>
          </div>
        )}
        {application.pointAmount !== null && (
          <div className="flex items-center justify-between">
            <span className="font-semibold">결제 금액</span>
            <span className="font-bold text-lg text-emerald-600">{application.pointAmount.toLocaleString()}P</span>
          </div>
        )}
      </div>

      {application.paymentStatus === 'FAILED' && (
        <div className="mt-3 bg-red-50 text-red-700 text-xs font-medium p-3 rounded-lg text-center">
          결제가 실패했습니다. 포인트 잔액을 확인하고 다음 기회에 다시 시도해주세요.
        </div>
      )}
      {application.paymentStatus === 'PENDING' && application.paymentDeadline && (
        <div className="mt-3 bg-amber-50 text-amber-700 text-xs font-medium p-3 rounded-lg text-center">
          결제 대기 중입니다. 마감 ({formatDate(application.paymentDeadline)}) 전까지 포인트 잔액을 확인해주세요.
        </div>
      )}
    </div>
  )
}