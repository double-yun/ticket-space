'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import TopBar from '@/components/TopBar'
import LoadingSpinner from '@/components/LoadingSpinner'

export default function LotteryRoundRedirectPage() {
  const router = useRouter()
  const params = useParams()
  const roundId = params.roundId as string

  useEffect(() => {
    let isMounted = true

    const redirectToEventDetail = async () => {
      try {
        const response = await fetch(`/api/lottery/rounds/${roundId}`)
        if (!response.ok) {
          throw new Error('failed')
        }
        const data = await response.json()
        if (!isMounted) return

        const eventId = data?.round?.event?.id
        if (eventId) {
          router.replace(`/events/${eventId}?type=lottery&roundId=${roundId}`)
        } else {
          router.replace('/events')
        }
      } catch (error) {
        console.error('Failed to redirect legacy lottery route', error)
        if (!isMounted) return
        router.replace('/events')
      }
    }

    if (roundId) {
      redirectToEventDetail()
    } else {
      router.replace('/events')
    }

    return () => {
      isMounted = false
    }
  }, [router, roundId])

  return (
    <div className="bg-gradient-to-b from-blue-50/30 via-white to-purple-50/30 min-h-screen">
      <TopBar title="추첨 신청" />
      <div className="pt-[60px] flex items-center justify-center h-screen">
        <div className="flex flex-col items-center gap-3 text-sm text-gray-600">
          <LoadingSpinner size={28} />
          <p>새로운 이벤트 상세 페이지로 이동 중입니다...</p>
        </div>
      </div>
    </div>
  )
}
