'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import TabNavigation from '@/components/TabNavigation'
import TopBar from '@/components/TopBar'
import usePullToRefresh from '@/hooks/usePullToRefresh'

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
    const pending = []
    const completed = []

    for (const application of applications) {
      if (application.status === 'APPLIED' || application.status === 'WON') {
        pending.push(application)
      } else {
        completed.push(application)
      }
    }

    return {
      pendingApplications: pending,
      completedApplications: completed,
    }
  }, [applications])

  return (
    <div className="bg-gray-50 min-h-screen overflow-hidden">
      <TopBar title="추첨 신청 내역" />

      <div ref={containerRef} className="h-[calc(100vh-60px)] overflow-y-auto pt-[60px]">
        {isRefreshing && (
          <div className="text-center py-2">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
        )}
        <div className="pb-20 px-4 space-y-6">
        <div className="bg-white rounded-3xl p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">자동 결제 안내</h2>
          <p className="text-sm text-gray-600 leading-6">
            추첨에 당첨되면 포인트가 자동으로 차감되고 SBT 티켓이 발급돼요. 잔액이 부족하면 결제가 실패할 수 있으니
            여유 있게 충전해 주세요.
          </p>
        </div>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">⏳ 진행 중인 추첨</h2>
          <div className="space-y-3">
            {pendingApplications.map((application) => (
              <ApplicationCard key={application.id} application={application} />
            ))}
            {!loading && pendingApplications.length === 0 && (
              <div className="bg-white rounded-3xl p-6 shadow-sm text-center text-gray-500">
                진행 중인 추첨 신청이 없습니다.
              </div>
            )}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">📒 지난 추첨</h2>
          <div className="space-y-3">
            {completedApplications.map((application) => (
              <ApplicationCard key={application.id} application={application} />
            ))}
            {!loading && completedApplications.length === 0 && (
              <div className="bg-white rounded-3xl p-6 shadow-sm text-center text-gray-500">
                지난 추첨 신청 내역이 없습니다.
              </div>
            )}
          </div>
        </section>

        {loading && (
          <div className="text-center text-gray-500">불러오는 중...</div>
        )}
        {error && (
          <div className="text-center text-red-500 text-sm">{error}</div>
        )}
        </div>
      </div>

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
  const paymentColor = getPaymentBadgeColors(application.paymentStatus)
  const deadline = formatDate(application.round?.applicationDeadline ?? null)
  const drawTime = formatDate(application.round?.drawnAt ?? null)
  const createdAt = formatDate(application.createdAt)
  const ticketIssuedAt = formatDate(application.ticket?.issuedAt ?? null)
  const paymentDeadline = formatDate(application.paymentDeadline)

  return (
    <div className="bg-white rounded-3xl p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-lg font-bold text-gray-900">{eventTitle}</h3>
          {roundNumber !== undefined && (
            <p className="text-sm text-gray-600">라운드 #{roundNumber}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusColor}`}>
            {statusLabel}
          </span>
          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${paymentColor}`}>
            {paymentLabel}
          </span>
        </div>
      </div>

      <div className="space-y-2 text-sm text-gray-600">
        <div className="flex items-center justify-between">
          <span>신청일</span>
          <span className="font-medium text-gray-900">{createdAt}</span>
        </div>
        {deadline && (
          <div className="flex items-center justify-between">
            <span>신청 마감</span>
            <span>{deadline}</span>
          </div>
        )}
        {drawTime && (
          <div className="flex items-center justify-between">
            <span>추첨 예정</span>
            <span>{drawTime}</span>
          </div>
        )}
        {application.priority !== null && (
          <div className="flex items-center justify-between">
            <span>우선순위</span>
            <span className="font-semibold text-emerald-600">{application.priority}위</span>
          </div>
        )}
        {application.pointAmount !== null && (
          <div className="flex items-center justify-between">
            <span>결제 금액</span>
            <span>{application.pointAmount.toLocaleString()}P</span>
          </div>
        )}
        {application.ticket && ticketIssuedAt && (
          <div className="flex items-center justify-between">
            <span>SBT 발급</span>
            <span>{ticketIssuedAt}</span>
          </div>
        )}
        {application.paymentStatus === 'FAILED' && (
          <p className="text-xs text-red-500">
            결제가 실패했습니다. 포인트 잔액을 확인하고 라운드 재오픈 시 다시 시도해주세요.
          </p>
        )}
        {paymentDeadline && application.paymentStatus === 'PENDING' && (
          <p className="text-xs text-amber-600">
            결제 대기 중입니다. 결제 마감 {paymentDeadline}까지 포인트 잔액을 확인해주세요.
          </p>
        )}
      </div>
    </div>
  )
}
