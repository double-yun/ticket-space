'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import TopBar from '@/components/TopBar'

type RoundStatus = 'OPEN' | 'CLOSED' | 'DRAWN'
type EventStatus = 'DRAFT' | 'PUBLISHED' | 'CLOSED'

interface LotteryRoundData {
  id: string
  eventId: number
  roundNumber: number
  status: RoundStatus
  applicationDeadline: string
  drawnAt: string | null
  applicantCount: number
  event: {
    id: number
    title: string
    description: string | null
    ticketCount: number
    price: number
    deadline: string
    saleStart: string | null
    status: EventStatus
  }
}

export default function LotteryApplicationPage() {
  const router = useRouter()
  const params = useParams()
  const roundId = params.roundId as string
  const { user, token, isLoading: authLoading } = useAuth()
  const [round, setRound] = useState<LotteryRoundData | null>(null)
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasApplied, setHasApplied] = useState(false)

  const fetchRoundData = useCallback(async () => {
    if (!roundId) return

    try {
      const response = await fetch(`/api/lottery/rounds/${roundId}`)
      if (!response.ok) {
        throw new Error('Failed to fetch round data')
      }
      const data = await response.json()
      setRound(data.round)
    } catch (err) {
      console.error('Failed to fetch round:', err)
      setError('라운드 정보를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [roundId])

  const checkApplicationStatus = useCallback(async () => {
    if (!token || !roundId) return

    try {
      const response = await fetch('/api/lottery/applications', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      if (!response.ok) return

      const data = await response.json()
      const existingApp = data.applications?.find(
        (app: { roundId: string }) => app.roundId === roundId
      )
      setHasApplied(!!existingApp)
    } catch (err) {
      console.error('Failed to check application status:', err)
    }
  }, [token, roundId])

  useEffect(() => {
    if (authLoading) return

    if (!user || !token) {
      router.push('/login')
      return
    }

    fetchRoundData()
    checkApplicationStatus()
  }, [authLoading, user, token, router, fetchRoundData, checkApplicationStatus])

  const handleApply = async () => {
    if (!token || !roundId || applying) return

    setApplying(true)
    setError(null)

    try {
      const response = await fetch('/api/lottery/apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ roundId }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '신청에 실패했습니다.')
      }

      alert('✅ 추첨 신청이 완료되었습니다!')
      router.push('/lottery')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '신청 중 오류가 발생했습니다.'
      setError(errorMessage)
      alert(`❌ ${errorMessage}`)
    } finally {
      setApplying(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-gray-50 min-h-screen">
        <TopBar title="추첨 신청" />
        <div className="pt-[60px] flex items-center justify-center h-screen">
          <div className="text-center text-gray-500">불러오는 중...</div>
        </div>
      </div>
    )
  }

  if (error && !round) {
    return (
      <div className="bg-gray-50 min-h-screen">
        <TopBar title="추첨 신청" />
        <div className="pt-[60px] flex items-center justify-center h-screen">
          <div className="text-center text-red-500">{error}</div>
        </div>
      </div>
    )
  }

  if (!round) {
    return (
      <div className="bg-gray-50 min-h-screen">
        <TopBar title="추첨 신청" />
        <div className="pt-[60px] flex items-center justify-center h-screen">
          <div className="text-center text-gray-500">라운드를 찾을 수 없습니다.</div>
        </div>
      </div>
    )
  }

  const now = new Date()
  const deadline = new Date(round.applicationDeadline)
  const isPastDeadline = deadline <= now
  const isNotOpen = round.status !== 'OPEN'
  const canApply = !hasApplied && !isPastDeadline && !isNotOpen && !applying

  return (
    <div className="bg-gray-50 min-h-screen">
      <TopBar title="추첨 신청" />

      <div className="pt-[60px] pb-20 px-4">
        <div className="max-w-2xl mx-auto space-y-6 mt-6">
          {/* 이벤트 카드 */}
          <div className="bg-white rounded-3xl p-6 shadow-lg border border-gray-100">
            <div className="flex items-start gap-5 mb-4">
              <div className="w-24 h-24 bg-gradient-to-br from-emerald-400 to-cyan-500 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-md">
                <span className="text-white text-5xl">✨</span>
              </div>
              <div className="flex-1">
                <h1 className="font-bold text-2xl text-gray-900 mb-2">{round.event.title}</h1>
                {round.event.description && (
                  <p className="text-sm text-gray-600 leading-relaxed">{round.event.description}</p>
                )}
              </div>
            </div>

            <div className="space-y-3 text-sm bg-gray-50/70 p-4 rounded-2xl">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-700">티켓 가격</span>
                <span className="font-bold text-xl text-emerald-600">{round.event.price.toLocaleString()}P</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-700">총 티켓 수량</span>
                <span className="font-mono text-gray-800">{round.event.ticketCount}장</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-700">현재 신청자</span>
                <span className="font-mono text-gray-800">{round.applicantCount}명</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-700">신청 마감</span>
                <span className="font-mono text-gray-800">
                  {new Date(round.applicationDeadline).toLocaleString('ko-KR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            </div>
          </div>

          {/* 안내 메시지 */}
          <div className="bg-blue-50 rounded-2xl p-5 border border-blue-100">
            <h3 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
              <span className="text-xl">💡</span> 추첨 안내
            </h3>
            <ul className="text-sm text-blue-800 space-y-1.5 leading-6">
              <li>• 신청자가 티켓 수량보다 많으면 추첨을 통해 당첨자를 선정합니다.</li>
              <li>• 당첨 시 포인트가 자동으로 차감되고 티켓이 발급됩니다.</li>
              <li>• 포인트가 부족하면 결제가 실패하니 미리 충전해주세요.</li>
            </ul>
          </div>

          {/* 신청 버튼 */}
          <div className="space-y-3">
            {hasApplied && (
              <div className="bg-green-50 text-green-700 text-sm font-medium p-4 rounded-2xl text-center">
                ✅ 이미 신청하셨습니다. 추첨 결과를 기다려주세요!
              </div>
            )}

            {isPastDeadline && (
              <div className="bg-red-50 text-red-700 text-sm font-medium p-4 rounded-2xl text-center">
                ⏰ 신청 마감 시간이 지났습니다.
              </div>
            )}

            {isNotOpen && (
              <div className="bg-gray-100 text-gray-700 text-sm font-medium p-4 rounded-2xl text-center">
                📁 현재 신청할 수 없는 라운드입니다.
              </div>
            )}

            <button
              onClick={handleApply}
              disabled={!canApply}
              className={`w-full py-4 rounded-2xl font-bold text-lg transition-all duration-200 ${
                canApply
                  ? 'bg-emerald-500 hover:bg-emerald-600 text-white active:scale-95 shadow-lg'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {applying ? '신청 중...' : hasApplied ? '신청 완료' : '추첨 신청하기'}
            </button>
          </div>

          {/* 지갑 정보 */}
          {user?.walletAddress && (
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <p className="text-xs text-gray-500 mb-1">내 지갑 주소</p>
              <p className="text-sm font-mono text-gray-700">
                {user.walletAddress.slice(0, 10)}...{user.walletAddress.slice(-8)}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
