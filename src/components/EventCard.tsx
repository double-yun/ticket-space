
'use client'

import { useRouter } from 'next/navigation'
import { Ticket, Sparkles } from 'lucide-react'
import PayButton from './PayButton'

interface TicketData {
  id: string
  name: string
  description: string
  price: number
  maxSupply: number
  currentSupply: number
  deadline?: string
  roundId?: string
  applicationDeadline?: string
}

interface EventCardProps {
  ticket: TicketData
  type: 'direct' | 'lottery'
  onSuccess: () => void
}

export default function EventCard({ ticket, type, onSuccess }: EventCardProps) {
  const router = useRouter()
  const isSoldOut = type === 'direct' && ticket.currentSupply >= ticket.maxSupply

  const handleLotteryClick = () => {
    if (ticket.roundId) {
      router.push(`/lottery/${ticket.roundId}`)
    }
  }

  const Badge = () => {
    if (type === 'lottery') {
      return (
        <span className="absolute top-3 right-3 bg-emerald-500/10 backdrop-blur-sm border border-emerald-200/50 text-emerald-700 text-xs font-semibold px-2.5 py-1 rounded-full">
          추첨 이벤트
        </span>
      )
    }
    return (
      <span className="absolute top-3 right-3 bg-blue-500/10 backdrop-blur-sm border border-blue-200/50 text-blue-700 text-xs font-semibold px-2.5 py-1 rounded-full">
        바로 구매
      </span>
    )
  }

  const iconStyles = type === 'direct'
    ? 'bg-blue-500/10 backdrop-blur-xl border border-blue-200/30'
    : 'bg-emerald-500/10 backdrop-blur-xl border border-emerald-200/30';

  const iconColorClass = type === 'direct' ? 'text-blue-600' : 'text-emerald-600';

  return (
    <div className="relative bg-white/80 backdrop-blur-sm rounded-3xl p-5 shadow-sm border border-gray-100/50 transition-transform duration-200">
      <Badge />
      <div className="flex items-start gap-5">
        <div className={`w-20 h-20 ${iconStyles} rounded-2xl flex items-center justify-center flex-shrink-0`}>
          {type === 'direct' ? (
            <Ticket size={40} className={iconColorClass} strokeWidth={2} />
          ) : (
            <Sparkles size={40} className={iconColorClass} strokeWidth={2} />
          )}
        </div>
        <div className="flex-1 pt-1">
          <h3 className="font-bold text-lg text-gray-900 mb-1.5 pr-16">
            {ticket.name}
          </h3>
          <p className="text-sm text-gray-600 mb-3 line-clamp-2">
            {ticket.description}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-end justify-between">
        <div className="text-left">
          <p className="text-sm text-gray-500 mb-0.5">
            {type === 'lottery' ? '응모 포인트' : '구매 포인트'}
          </p>
          <p className={`text-2xl font-bold ${type === 'direct' ? 'text-blue-600' : 'text-emerald-600'}`}>
            {ticket.price.toLocaleString()}P
          </p>
        </div>
        
        {type === 'direct' ? (
          <PayButton
            eventId={ticket.id}
            disabled={isSoldOut}
            onSuccess={onSuccess}
            className="w-auto px-6 py-3 bg-blue-500/80 backdrop-blur-sm border border-blue-300/30 text-white font-bold rounded-2xl shadow-sm transition-all duration-200 disabled:bg-gray-300 disabled:shadow-none active:scale-[0.98]"
            buttonText={isSoldOut ? '판매 완료' : '구매하기'}
          />
        ) : (
          <button
            className="w-auto px-6 py-3 bg-emerald-500/80 backdrop-blur-sm border border-emerald-300/30 text-white font-bold rounded-2xl shadow-sm transition-all duration-200 disabled:bg-gray-300 disabled:shadow-none active:scale-[0.98]"
            onClick={handleLotteryClick}
          >
            신청하기
          </button>
        )}
      </div>
       {type === 'lottery' && ticket.applicationDeadline && (
        <div className="mt-3 text-center text-xs text-gray-500 border-t border-gray-100 pt-3">
          응모 마감: {new Date(ticket.applicationDeadline).toLocaleString('ko-KR', {
            month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
          })}
        </div>
      )}
    </div>
  )
}
