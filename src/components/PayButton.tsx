'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'

interface PayButtonProps {
  eventId: string
  disabled?: boolean
  onSuccess?: () => void
}

export default function PayButton({ eventId, disabled, onSuccess }: PayButtonProps) {
  const { token } = useAuth()
  const [processing, setProcessing] = useState(false)

  const handleClick = async () => {
    if (processing || disabled) return

    if (!token) {
      alert('로그인이 필요합니다. 다시 로그인해 주세요.')
      return
    }

    setProcessing(true)

    try {
      const response = await fetch('/api/tickets/purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ eventId }),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok || !data.success) {
        const message = data?.error ?? '티켓 결제에 실패했습니다.'
        alert(`❌ ${message}`)
        return
      }

      alert('🎉 티켓 결제 및 발급이 완료되었습니다!')
      onSuccess?.()
    } catch (error) {
      console.error('Ticket purchase failed.', error)
      alert('❌ 결제를 처리하는 중 오류가 발생했습니다.')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={disabled || processing}
      className={`bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
        disabled || processing ? 'opacity-60 cursor-not-allowed' : 'hover:bg-blue-700'
      }`}
    >
      {processing ? '결제 중...' : '결제하기'}
    </button>
  )
}
