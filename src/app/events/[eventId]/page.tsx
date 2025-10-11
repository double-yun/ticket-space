'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import TopBar from '@/components/TopBar'
import LoadingSpinner from '@/components/LoadingSpinner'
import PayButton from '@/components/PayButton'
import { useAuth } from '@/contexts/AuthContext'
import { Info, AlertTriangle } from 'lucide-react'

type EventType = 'direct' | 'lottery'

interface EventDetail {
  id: number
  title: string
  description: string
  price: number
  ticketCount: number
  currentSupply: number
  deadline: string
  saleStart: string | null
  status: string
  type: EventType
  rounds: RoundSummary[]
}

interface RoundSummary {
  id: string
  roundNumber: number
  status: string
  applicationDeadline: string
  drawnAt: string | null
  applicantCount: number
}

const LOTTERY_GUIDE_ITEMS = [
  '신청자가 티켓 수량보다 많으면 추첨을 통해 당첨자를 선정합니다.',
  '당첨 시 포인트가 자동으로 차감되고 SBT 티켓이 발급됩니다.',
  '포인트가 부족하면 결제가 실패할 수 있으니 미리 충전해 주세요.',
]

const LOTTERY_WARNING_ITEMS = [
  '응모 마감 이후에는 신청이 불가능합니다. 마감 시간을 꼭 확인해 주세요.',
  '추첨 신청 후에는 취소가 어렵습니다. 신청 전에 정보를 다시 확인해 주세요.',
  '당첨 결과와 세부 안내는 별도로 공지됩니다.',
]

function formatDateTime(value: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatRoundStatus(status: string) {
  switch (status) {
    case 'OPEN':
      return '진행 중'
    case 'CLOSED':
      return '마감'
    case 'DRAWN':
      return '추첨 완료'
    default:
      return status
  }
}

export default function EventDetailPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const { user, token, isLoading: authLoading } = useAuth()

  const eventId = params.eventId as string
  const typeParam = searchParams.get('type')
  const requestedType: EventType | null =
    typeParam === 'lottery' ? 'lottery' : typeParam === 'direct' ? 'direct' : null
  const requestedRoundId = searchParams.get('roundId')

  const [event, setEvent] = useState<EventDetail | null>(null)
  const [selectedRound, setSelectedRound] = useState<RoundSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasApplied, setHasApplied] = useState(false)
  const [applying, setApplying] = useState(false)
  const [lotteryError, setLotteryError] = useState<string | null>(null)

  const displayType: EventType = (event?.type ?? requestedType ?? 'direct') as EventType
  const isLotteryEvent = displayType === 'lottery'
  const isDirectEvent = displayType === 'direct'

  const fetchEventDetail = useCallback(async () => {
    if (!eventId) return

    setLoading(true)
    setError(null)

    try {
      const query = new URLSearchParams()
      if (requestedRoundId) {
        query.set('roundId', requestedRoundId)
      }

      const response = await fetch(
        `/api/events/${eventId}${query.size > 0 ? `?${query.toString()}` : ''}`
      )

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || '이벤트 정보를 불러오지 못했습니다.')
      }

      const data = await response.json()
      setEvent(data.event)
      setSelectedRound(data.round ?? null)
      setHasApplied(false)
      setLotteryError(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : '이벤트를 불러오는 중 오류가 발생했습니다.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [eventId, requestedRoundId])

  useEffect(() => {
    if (authLoading) return

    if (!user || !token) {
      router.push('/login')
      return
    }

    fetchEventDetail()
  }, [authLoading, user, token, router, fetchEventDetail])

  const effectiveRound = useMemo(() => {
    if (!isLotteryEvent || !event) return null

    if (selectedRound) {
      const matched = event.rounds.find((round) => round.id === selectedRound.id)
      return matched ?? selectedRound
    }

    if (requestedRoundId) {
      const roundFromQuery = event.rounds.find((round) => round.id === requestedRoundId)
      if (roundFromQuery) return roundFromQuery
    }

    const openRound = event.rounds.find((round) => round.status === 'OPEN')
    return openRound ?? event.rounds[0] ?? null
  }, [isLotteryEvent, event, selectedRound, requestedRoundId])

  const checkApplicationStatus = useCallback(
    async (roundId: string) => {
      if (!token) return

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
        const existing = data.applications?.some(
          (application: { roundId: string }) => application.roundId === roundId
        )
        setHasApplied(Boolean(existing))
        setLotteryError(null)
      } catch (err) {
        console.error('Failed to check lottery application status', err)
        setLotteryError('신청 내역을 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.')
      }
    },
    [token]
  )

useEffect(() => {
  if (!isLotteryEvent || !effectiveRound?.id || !token) return
  checkApplicationStatus(effectiveRound.id)
}, [isLotteryEvent, effectiveRound?.id, token, checkApplicationStatus])

  const remainingTickets = useMemo(() => {
    if (!event) return 0
    return Math.max(event.ticketCount - event.currentSupply, 0)
  }, [event])

  const handleLotteryApply = async () => {
    if (!effectiveRound || applying || hasApplied || !token) return

    const roundId = effectiveRound.id
    setApplying(true)
    setLotteryError(null)

    try {
      const response = await fetch('/api/lottery/apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ roundId }),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || '신청에 실패했습니다.')
      }

      alert('✅ 추첨 신청이 완료되었습니다!')
      setHasApplied(true)
      setEvent((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          rounds: prev.rounds.map((round) =>
            round.id === roundId
              ? { ...round, applicantCount: round.applicantCount + 1 }
              : round
          ),
        }
      })
      setSelectedRound((prev) =>
        prev && prev.id === roundId
          ? { ...prev, applicantCount: prev.applicantCount + 1 }
          : prev
      )
    } catch (err) {
      const message =
        err instanceof Error ? err.message : '신청 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'
      setLotteryError(message)
      alert(`❌ ${message}`)
    } finally {
      setApplying(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-gradient-to-b from-blue-50/30 via-white to-purple-50/30 min-h-screen">
        <TopBar title="이벤트 상세" />
        <div className="pt-[60px] flex items-center justify-center h-screen">
          <LoadingSpinner size={28} />
        </div>
      </div>
    )
  }

  if (error || !event) {
    return (
      <div className="bg-gradient-to-b from-blue-50/30 via-white to-purple-50/30 min-h-screen">
        <TopBar title="이벤트 상세" />
        <div className="pt-[60px] flex items-center justify-center h-screen">
          <p className="text-sm text-red-500">{error ?? '이벤트를 찾을 수 없습니다.'}</p>
        </div>
      </div>
    )
  }

  const saleStart = formatDateTime(event.saleStart)
  const deadline = formatDateTime(event.deadline)
  const applicationDeadline = formatDateTime(effectiveRound?.applicationDeadline ?? null)
  const applicationDeadlineDate = effectiveRound
    ? new Date(effectiveRound.applicationDeadline)
    : null
  const now = new Date()
  const isPastDeadline =
    applicationDeadlineDate !== null && applicationDeadlineDate.getTime() <= now.getTime()
  const lotteryClosed = Boolean(effectiveRound && effectiveRound.status !== 'OPEN')

  let lotteryButtonLabel = '신청하기'
  if (!effectiveRound) {
    lotteryButtonLabel = '진행 가능한 라운드가 없습니다'
  } else if (applying) {
    lotteryButtonLabel = '신청 중...'
  } else if (hasApplied) {
    lotteryButtonLabel = '신청 완료'
  } else if (isPastDeadline || lotteryClosed) {
    lotteryButtonLabel = '응모가 마감되었습니다'
  }

  const lotteryButtonDisabled =
    !effectiveRound || applying || hasApplied || isPastDeadline || lotteryClosed

  return (
    <div className="bg-gradient-to-b from-blue-50/30 via-white to-purple-50/30 h-screen flex flex-col">
      <TopBar title="이벤트 상세" />

      <main className="flex-1 overflow-y-auto pb-6 px-4">
        <div className="max-w-2xl mx-auto space-y-6 mt-6">
          <section className="bg-white/85 backdrop-blur-sm rounded-3xl p-6 shadow-sm border border-gray-100/60">
            <div className="flex items-start gap-4">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500/80 to-purple-500/80 flex items-center justify-center text-white text-3xl font-bold">
                {event.title.slice(0, 1)}
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold uppercase tracking-widest text-blue-500">
                  {isDirectEvent ? '바로 구매' : '추첨 이벤트'}
                </p>
                <h1 className="text-2xl font-bold text-gray-900 leading-snug mt-1">
                  {event.title}
                </h1>
                {event.description && (
                  <p className="text-sm text-gray-600 leading-6 mt-3 whitespace-pre-line">
                    {event.description}
                  </p>
                )}
              </div>
            </div>
          </section>

          <section className="bg-white/85 backdrop-blur-sm rounded-3xl p-6 shadow-sm border border-gray-100/60 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">이벤트 정보</h2>

            <div className="grid grid-cols-1 gap-4 text-sm">
              <div className="bg-gray-50/80 rounded-2xl p-4 border border-gray-100/60">
                <p className="text-xs text-gray-500 mb-1">장소</p>
                <p className="text-gray-800 font-medium">추후 공개 예정</p>
              </div>
              <div className="bg-gray-50/80 rounded-2xl p-4 border border-gray-100/60">
                <p className="text-xs text-gray-500 mb-1">일시</p>
                <p className="text-gray-800 font-medium">{saleStart ?? deadline ?? '일정 미정'}</p>
              </div>
              <div className="bg-gray-50/80 rounded-2xl p-4 border border-gray-100/60">
                <p className="text-xs text-gray-500 mb-1">
                  {isDirectEvent ? '판매 마감' : '응모 마감'}
                </p>
                <p className="text-gray-800 font-medium">
                  {isDirectEvent ? deadline ?? '마감 일정 미정' : applicationDeadline ?? '마감 일정 미정'}
                </p>
              </div>
              <div className="bg-gray-50/80 rounded-2xl p-4 border border-gray-100/60">
                <p className="text-xs text-gray-500 mb-1">티켓 가격</p>
                <p className={`text-xl font-bold ${isDirectEvent ? 'text-blue-600' : 'text-emerald-600'}`}>
                  {event.price.toLocaleString()}P
                </p>
              </div>
              <div className="bg-gray-50/80 rounded-2xl p-4 border border-gray-100/60 flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 mb-1">총 티켓 수량</p>
                  <p className="text-gray-800 font-medium">{event.ticketCount}장</p>
                </div>
                {isDirectEvent && (
                  <div className="text-right">
                    <p className="text-xs text-gray-500 mb-1">잔여 수량</p>
                    <p className="text-gray-800 font-semibold">{remainingTickets}장</p>
                  </div>
                )}
                {!isDirectEvent && effectiveRound && (
                  <div className="text-right">
                    <p className="text-xs text-gray-500 mb-1">현재 신청자</p>
                    <p className="text-gray-800 font-semibold">{effectiveRound.applicantCount}명</p>
                  </div>
                )}
              </div>
              {!isDirectEvent && effectiveRound && (
                <div className="bg-gray-50/80 rounded-2xl p-4 border border-gray-100/60">
                  <p className="text-xs text-gray-500 mb-1">라운드 정보</p>
                  <p className="text-gray-800 font-medium">
                    {effectiveRound.roundNumber}라운드 · 상태 {formatRoundStatus(effectiveRound.status)}
                  </p>
                </div>
              )}
            </div>
          </section>

          {isLotteryEvent && (
            <>
              <section className="bg-white/85 backdrop-blur-sm rounded-3xl p-6 shadow-sm border border-gray-100/60 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-200/60 flex items-center justify-center">
                    <Info size={18} className="text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">추첨 안내</h2>
                    <ul className="mt-2 space-y-1.5 text-sm text-gray-700 leading-6">
                      {LOTTERY_GUIDE_ITEMS.map((item) => (
                        <li key={item}>• {item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </section>

              <section className="bg-white/85 backdrop-blur-sm rounded-3xl p-6 shadow-sm border border-gray-100/60 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-200/60 flex items-center justify-center">
                    <AlertTriangle size={18} className="text-amber-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">주의 사항</h2>
                    <ul className="mt-2 space-y-1.5 text-sm text-gray-700 leading-6">
                      {LOTTERY_WARNING_ITEMS.map((item) => (
                        <li key={item}>• {item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </section>

              {(hasApplied || isPastDeadline || lotteryClosed || lotteryError) && (
                <section className="space-y-3">
                  {hasApplied && (
                    <div className="bg-emerald-50/90 border border-emerald-200/70 text-emerald-700 text-sm font-medium p-4 rounded-2xl">
                      ✅ 이미 신청하셨습니다. 추첨 결과를 기다려주세요!
                    </div>
                  )}
                  {isPastDeadline && (
                    <div className="bg-red-50/90 border border-red-200/70 text-red-600 text-sm font-medium p-4 rounded-2xl">
                      ⏰ 응모 마감 시간이 지났습니다.
                    </div>
                  )}
                  {lotteryClosed && !isPastDeadline && (
                    <div className="bg-gray-100/90 border border-gray-200 text-gray-600 text-sm font-medium p-4 rounded-2xl">
                      ⛔ 현재 라운드는 마감되어 신청할 수 없습니다.
                    </div>
                  )}
                  {lotteryError && (
                    <div className="bg-red-50/90 border border-red-200/70 text-red-600 text-sm font-medium p-4 rounded-2xl">
                      ❌ {lotteryError}
                    </div>
                  )}
                </section>
              )}
            </>
          )}
        </div>
      </main>

      <div className="bg-white/95 backdrop-blur-md border-t border-gray-200/80">
        <div className="max-w-2xl mx-auto px-4 py-5 space-y-2">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>이벤트 가격</span>
            <span className={`text-lg font-bold ${isDirectEvent ? 'text-blue-600' : 'text-emerald-600'}`}>
              {event.price.toLocaleString()}P
            </span>
          </div>
          {isDirectEvent ? (
            <PayButton
              eventId={eventId}
              disabled={remainingTickets <= 0}
              onSuccess={() => router.push('/tickets')}
              className={`w-full py-4 rounded-2xl text-base font-bold transition-all ${
                remainingTickets <= 0
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-500 text-white shadow-md active:scale-[0.99]'
              }`}
              buttonText={remainingTickets <= 0 ? '판매 완료' : '구매하기'}
            />
          ) : (
            <button
              onClick={handleLotteryApply}
              disabled={lotteryButtonDisabled}
              className={`w-full py-4 rounded-2xl text-base font-bold transition-all ${
                lotteryButtonDisabled
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-emerald-500 text-white shadow-md active:scale-[0.99]'
              }`}
            >
              {lotteryButtonLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
