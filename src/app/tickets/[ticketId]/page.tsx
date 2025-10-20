'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import TopBar from '@/components/TopBar'
import LoadingSpinner from '@/components/LoadingSpinner'
import { useAuth } from '@/contexts/AuthContext'
import TicketQrModal from '@/components/TicketQrModal'
import { Copy, Ticket as TicketIcon, QrCode, ChevronLeft, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import type { TicketPurchase } from '@/types/purchase'

interface TicketDetail {
  id: string
  transactionHash: string
  tokenId: string
  purchaseDate: string
  used: boolean
  usedAt: string | null
  refunded: boolean
  event: {
    id: number
    title: string
    description: string
    price: number
    deadline: string
    saleStart: string | null
    seatCapacity: number | null
    eventStartAt: string | null
    eventEndAt: string | null
    doorsOpenAt: string | null
    venueName: string | null
    venueAddress: string | null
    seatLayoutSummary: string | null
    lotteryApplicationDeadline: string | null
    lotteryResultAnnouncementAt: string | null
    status: string
  }
  application: {
    id: string
    roundId: string
    status: string
    paymentStatus: string
    paymentDeadline: string | null
    pointAmount: number | null
  } | null
}

const formatDateTime = (value: string | null) => {
  if (!value) return '정보 없음'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '정보 없음'
  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function TicketDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user, token, isLoading: authLoading } = useAuth()

  const normalizeDate = (value: string | null) => {
    const formatted = formatDateTime(value)
    return formatted === '정보 없음' ? null : formatted
  }

  const ticketId = params.ticketId as string

  const [ticket, setTicket] = useState<TicketDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [qrOpen, setQrOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const fetchTicketDetail = useCallback(async () => {
    if (!ticketId || !token) return

    try {
      setLoading(true)
      const response = await fetch(`/api/purchases/${ticketId}` , {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || '티켓 정보를 불러오지 못했습니다.')
      }
      const data = await response.json()
      setTicket(data.ticket)
      setError(null)
    } catch (err) {
      console.error('Failed to fetch ticket detail:', err)
      const message = err instanceof Error ? err.message : '티켓 정보를 불러오지 못했습니다.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [ticketId, token])

  useEffect(() => {
    if (authLoading) return
    if (!user || !token) {
      router.push('/login')
      return
    }
    fetchTicketDetail()
  }, [authLoading, user, token, router, fetchTicketDetail])

  const handleCopyHash = async () => {
    if (!ticket?.transactionHash) return

    try {
      await navigator.clipboard.writeText(ticket.transactionHash)
      setCopied(true)
      toast.success('트랜잭션 해시가 복사되었습니다.')
      
      // 2초 후 복사 상태 초기화
      setTimeout(() => {
        setCopied(false)
      }, 2000)
    } catch (error) {
      console.error('Failed to copy hash:', error)
      toast.error('해시 복사에 실패했습니다.')
    }
  }

  const qrModalPurchase: TicketPurchase | null = useMemo(() => {
    if (!ticket) return null
    return {
      id: ticket.id,
      transactionHash: ticket.transactionHash,
      tokenId: ticket.tokenId,
      purchaseDate: ticket.purchaseDate,
      used: ticket.used,
      usedAt: ticket.usedAt,
      ticket: {
        id: ticket.event.id,
        name: ticket.event.title,
        description: ticket.event.description,
        price: ticket.event.price.toString(),
        imageUrl: null,
      },
    }
  }, [ticket])

  const eventPrice = useMemo(() => {
    if (!ticket) return ''
    return `${ticket.event.price.toLocaleString()}P`
  }, [ticket])

  const shortenHash = (hash: string) => {
    if (!hash || hash.length <= 10) return hash
    return `${hash.slice(0, 6)}...${hash.slice(-4)}`
  }

  const eventDetailHref = useMemo(() => {
    if (!ticket) return '/events'
    const searchParams = new URLSearchParams({
      type: ticket.application ? 'lottery' : 'direct',
    })
    if (ticket.application?.roundId) {
      searchParams.set('roundId', ticket.application.roundId)
    }
    return `/events/${ticket.event.id}?${searchParams.toString()}`
  }, [ticket])

  if (loading) {
    return (
      <div className="bg-gradient-to-b from-blue-50/30 via-white to-purple-50/30 min-h-screen">
        <TopBar title="티켓 상세" />
        <div className="pt-[60px] flex items-center justify-center h-screen">
          <LoadingSpinner size={48} />
        </div>
      </div>
    )
  }

  if (error || !ticket) {
    return (
      <div className="bg-gradient-to-b from-blue-50/30 via-white to-purple-50/30 min-h-screen">
        <TopBar title="티켓 상세" />
        <div className="pt-[60px] flex items-center justify-center h-screen">
          <p className="text-sm text-red-500">{error ?? '티켓을 찾을 수 없습니다.'}</p>
        </div>
      </div>
    )
  }

  const eventStartAt = normalizeDate(ticket.event.eventStartAt)
  const eventEndAt = normalizeDate(ticket.event.eventEndAt)
  const eventSchedule = eventStartAt && eventEndAt
    ? `${eventStartAt} ~ ${eventEndAt}`
    : eventStartAt ?? (eventEndAt ? `종료 예정 ${eventEndAt}` : '미정')
  const doorsOpenAt = normalizeDate(ticket.event.doorsOpenAt) ?? '미정'
  const saleStartAt = normalizeDate(ticket.event.saleStart) ?? '미정'
  const saleDeadlineAt = normalizeDate(ticket.event.deadline) ?? '미정'
  const lotteryDeadlineAt = normalizeDate(ticket.event.lotteryApplicationDeadline)
  const lotteryAnnouncementAt = normalizeDate(ticket.event.lotteryResultAnnouncementAt)
  const venueName = ticket.event.venueName ?? '장소 미정'
  const venueAddress = ticket.event.venueAddress ?? null
  const seatCapacityLabel =
    typeof ticket.event.seatCapacity === 'number'
      ? `${ticket.event.seatCapacity.toLocaleString()}석`
      : '정보 미정'
  const seatLayoutSummary = ticket.event.seatLayoutSummary ?? '좌석 정보가 등록되지 않았습니다.'
  const isLotteryTicket = Boolean(ticket.application)
  const lotteryDeadlineDisplay = lotteryDeadlineAt ?? saleDeadlineAt

  return (
    <div className="bg-gradient-to-b from-blue-50/30 via-white to-purple-50/30 h-[var(--app-height)] flex flex-col">
      <TopBar 
        title="티켓 상세" 
        leftButton={
          <button
            onClick={() => router.back()}
            className="p-2 -ml-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ChevronLeft size={24} />
          </button>
        }
      />

      <main className="flex-1 overflow-y-auto pb-6 px-4">
        <div className="max-w-2xl mx-auto space-y-6 mt-6">
          <section className="relative bg-white/80 backdrop-blur-sm rounded-3xl p-5 shadow-sm border border-gray-100/50">
            {/* 배지 */}
            <span className={`absolute top-3 right-3 ${
              ticket.used 
                ? 'bg-emerald-500/10 backdrop-blur-sm border border-emerald-200/50 text-emerald-700' 
                : 'bg-blue-500/10 backdrop-blur-sm border border-blue-200/50 text-blue-700'
            } text-xs font-semibold px-2.5 py-1 rounded-full`}>
              {ticket.used ? '사용 완료' : '미사용'}
            </span>

            <div className="flex items-start gap-5">
              {/* 아이콘 */}
              <div className={`w-20 h-20 ${
                ticket.used
                  ? 'bg-gray-500/10 backdrop-blur-xl border border-gray-200/30'
                  : 'bg-blue-500/10 backdrop-blur-xl border border-blue-200/30'
              } rounded-2xl flex items-center justify-center flex-shrink-0`}>
                <TicketIcon size={40} className={ticket.used ? 'text-gray-600' : 'text-blue-600'} strokeWidth={2} />
              </div>

              {/* 제목 및 설명 */}
              <div className="flex-1 pt-1">
                <h1 className="font-bold text-xl text-gray-900 mb-2 pr-20">
                  {ticket.event.title}
                </h1>
                {ticket.event.description && (
                  <p className="text-sm text-gray-600 leading-6 whitespace-pre-line">
                    {ticket.event.description}
                  </p>
                )}
              </div>
            </div>

            {/* 가격 정보 */}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-end justify-between">
                <div className="text-left">
                  <p className="text-sm text-gray-500 mb-0.5">
                    티켓 가격
                  </p>
                  <p className={`text-2xl font-bold ${ticket.used ? 'text-gray-600' : 'text-blue-600'}`}>
                    {eventPrice}
                  </p>
                </div>
                {ticket.refunded && (
                  <span className="inline-block text-xs font-semibold text-amber-600 bg-amber-100/80 px-3 py-1.5 rounded-full">
                    환불됨
                  </span>
                )}
              </div>
            </div>
          </section>

          <section className="bg-white/85 backdrop-blur-sm rounded-3xl p-6 shadow-sm border border-gray-100/60 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">이벤트 정보</h2>
            <div className="grid grid-cols-1 gap-4 text-sm">
              <div className="bg-gray-50/80 rounded-2xl p-4 border border-gray-100/60">
                <p className="text-xs text-gray-500 mb-1">공연 일시</p>
                <p className="text-gray-800 font-medium">{eventSchedule}</p>
              </div>
              <div className="bg-gray-50/80 rounded-2xl p-4 border border-gray-100/60">
                <p className="text-xs text-gray-500 mb-1">입장 가능 시간</p>
                <p className="text-gray-800 font-medium">{doorsOpenAt}</p>
              </div>
              <div className="bg-gray-50/80 rounded-2xl p-4 border border-gray-100/60">
                <p className="text-xs text-gray-500 mb-1">장소</p>
                <p className="text-gray-800 font-medium">{venueName}</p>
                {venueAddress && (
                  <p className="text-xs text-gray-500 mt-1 whitespace-pre-line">{venueAddress}</p>
                )}
              </div>
              <div className="bg-gray-50/80 rounded-2xl p-4 border border-gray-100/60">
                <p className="text-xs text-gray-500 mb-1">{isLotteryTicket ? '응모 일정' : '판매 일정'}</p>
                <div className="space-y-1 text-gray-800 font-medium">
                  <p>시작: {saleStartAt}</p>
                  <p>{isLotteryTicket ? '응모 마감' : '판매 마감'}: {lotteryDeadlineDisplay}</p>
                  {isLotteryTicket && lotteryAnnouncementAt && (
                    <p className="text-xs text-gray-500 font-normal">추첨 결과 발표: {lotteryAnnouncementAt}</p>
                  )}
                </div>
              </div>
              <div className="bg-gray-50/80 rounded-2xl p-4 border border-gray-100/60">
                <p className="text-xs text-gray-500 mb-1">좌석 정보</p>
                <p className="text-gray-800 font-medium">{seatCapacityLabel}</p>
                {seatLayoutSummary && (
                  <p className="text-xs text-gray-500 mt-1 whitespace-pre-line">{seatLayoutSummary}</p>
                )}
              </div>
            </div>
          </section>

          <section className="bg-white/85 backdrop-blur-sm rounded-3xl p-6 shadow-sm border border-gray-100/60 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">티켓 정보</h2>
            <div className="grid grid-cols-1 gap-4 text-sm">
              <div className="bg-gray-50/80 rounded-2xl p-4 border border-gray-100/60">
                <p className="text-xs text-gray-500 mb-1">토큰 ID</p>
                <p className="text-gray-800 font-medium font-mono">#{ticket.tokenId}</p>
              </div>
              <div className="bg-gray-50/80 rounded-2xl p-4 border border-gray-100/60">
                <p className="text-xs text-gray-500 mb-1">발급 일시</p>
                <p className="text-gray-800 font-medium">{formatDateTime(ticket.purchaseDate)}</p>
              </div>
              {ticket.usedAt && (
                <div className="bg-gray-50/80 rounded-2xl p-4 border border-gray-100/60">
                  <p className="text-xs text-gray-500 mb-1">사용 일시</p>
                  <p className="text-gray-800 font-medium">{formatDateTime(ticket.usedAt)}</p>
                </div>
              )}
            </div>
          </section>

          <section className="bg-white/85 backdrop-blur-sm rounded-3xl p-6 shadow-sm border border-gray-100/60 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">트랜잭션 정보</h2>
            <div className="grid grid-cols-1 gap-4 text-sm">
              <div className="bg-gray-50/80 rounded-2xl p-4 border border-gray-100/60">
                <p className="text-xs text-gray-500 mb-1">Transaction Hash</p>
                <button
                  onClick={handleCopyHash}
                  className="w-full rounded-2xl p-3 active:scale-[0.98] transition-all duration-150 hover:bg-white/20 flex items-center justify-between"
                >
                  <p className="text-sm font-mono text-gray-800">
                    {shortenHash(ticket.transactionHash || '')}
                  </p>
                  <div className="flex-shrink-0">
                    {copied ? (
                      <Check size={18} className="text-emerald-600" />
                    ) : (
                      <Copy size={18} className="text-gray-400" />
                    )}
                  </div>
                </button>
              </div>
              {ticket.application && (
                <div className="bg-gray-50/80 rounded-2xl p-4 border border-gray-100/60 space-y-2 text-sm text-gray-600">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">응모 상태</span>
                    <span className="font-bold text-indigo-600">{ticket.application.status}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">결제 상태</span>
                    <span className="font-medium text-gray-700">{ticket.application.paymentStatus}</span>
                  </div>
                  {ticket.application.paymentDeadline && (
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">결제 마감</span>
                      <span className="text-gray-700">{formatDateTime(ticket.application.paymentDeadline)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>

        </div>
      </main>

      <div className="bg-white/95 backdrop-blur-md border-t border-gray-200/80">
        <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
          {!ticket.used && (
            <button
              type="button"
              onClick={() => setQrOpen(true)}
              className="w-full rounded-2xl bg-gradient-to-r from-blue-500/80 via-indigo-500/75 to-purple-500/75 px-4 py-4 text-white font-semibold shadow-lg transition-all hover:shadow-xl active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <QrCode size={18} /> QR 코드 보기
            </button>
          )}
          <button
            type="button"
            onClick={() => router.push(eventDetailHref)}
            className="w-full rounded-2xl border border-white/60 bg-white/60 px-4 py-4 text-sm font-semibold text-gray-700 backdrop-blur-xl transition-all hover:bg-white active:scale-[0.98]"
          >
            이벤트 상세 페이지로 이동
          </button>
        </div>
      </div>

      <TicketQrModal
        open={qrOpen}
        purchase={qrModalPurchase}
        onClose={() => setQrOpen(false)}
        token={token}
        onRefresh={fetchTicketDetail}
      />
    </div>
  )
}
