'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import LoadingSpinner from '@/components/LoadingSpinner'
import { Ticket, X } from 'lucide-react'
import toast from 'react-hot-toast'
import type { TicketPurchase } from '@/types/purchase'

interface TicketQrModalProps {
  open: boolean
  purchase: TicketPurchase | null
  onClose: () => void
  token?: string | null
  onRefresh?: () => void | Promise<void>
}

const REFRESH_INTERVAL = 15

export default function TicketQrModal({ open, purchase, onClose, token, onRefresh }: TicketQrModalProps) {
  const [qrCodeDataURL, setQrCodeDataURL] = useState<string>('')
  const [timeLeft, setTimeLeft] = useState(REFRESH_INTERVAL)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const purchaseId = purchase?.id ?? null

  const clearPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }

  const generateQRCode = useCallback(async () => {
    if (!purchase) return
    try {
      const QRCode = (await import('qrcode')).default
      const ticketData = {
        tokenId: purchase.tokenId,
        transactionHash: purchase.transactionHash,
        userId: purchase.userId,
        timestamp: Date.now(),
      }

      const qrDataURL = await QRCode.toDataURL(JSON.stringify(ticketData), {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      })
      setQrCodeDataURL(qrDataURL)
    } catch (error) {
      console.error('QR 코드 생성 실패:', error)
      toast.error('QR 코드 생성에 실패했습니다.')
    }
  }, [purchase])

  const startPollingTicketStatus = useCallback(
    (targetPurchaseId: string) => {
      if (!token) return

      clearPolling()
      pollingRef.current = setInterval(async () => {
        try {
          const response = await fetch('/api/purchases', {
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          })
          const data = await response.json()

          if (data.success) {
            const updatedPurchase = data.purchases.find((p: { id: string }) => p.id === targetPurchaseId)

            if (updatedPurchase && updatedPurchase.used) {
              clearPolling()
              onClose()
              await onRefresh?.()
            }
          }
        } catch (error) {
          console.error('티켓 상태 확인 실패:', error)
        }
      }, 2000)
    },
    [onClose, onRefresh, token]
  )

  useEffect(() => {
    if (!open || !purchaseId) {
      setQrCodeDataURL('')
      setTimeLeft(REFRESH_INTERVAL)
      clearPolling()
      return
    }

    setTimeLeft(REFRESH_INTERVAL)
    generateQRCode()
    startPollingTicketStatus(purchaseId)

    return () => {
      clearPolling()
    }
  }, [open, purchaseId, generateQRCode, startPollingTicketStatus])

  useEffect(() => {
    if (!open || !purchase) return

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          generateQRCode()
          return REFRESH_INTERVAL
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [open, purchase, generateQRCode])

  const handleClose = useCallback(() => {
    clearPolling()
    onClose()
  }, [onClose])

  const formattedTimeLeft = useMemo(() => Math.max(0, Math.min(timeLeft, REFRESH_INTERVAL)), [timeLeft])

  if (!open || !purchase) {
    return null
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in p-4">
      <div className="relative bg-gradient-to-b from-white/98 to-white/90 backdrop-blur-xl border border-white/50 rounded-3xl w-full max-w-md shadow-2xl animate-fade-in max-h-[90vh] flex flex-col">
        <button
          type="button"
          onClick={handleClose}
          aria-label="티켓 QR 모달 닫기"
          className="absolute top-3 right-3 w-10 h-10 rounded-full bg-white/85 border border-gray-200/70 text-gray-600 flex items-center justify-center shadow-sm transition-all hover:bg-white hover:text-gray-900 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
        >
          <X size={18} strokeWidth={2.5} />
        </button>

        <div className="p-4 pt-6 pb-4 border-b border-gray-200/50 flex-shrink-0">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-blue-500/10 backdrop-blur-xl border border-blue-200/30 rounded-2xl flex items-center justify-center flex-shrink-0">
              <Ticket size={32} className="text-blue-600" strokeWidth={2} />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900 mb-1">{purchase.ticket.name}</h2>
              <p className="text-sm text-gray-500">토큰 ID: #{purchase.tokenId}</p>
            </div>
          </div>
        </div>

        <div className="p-4 flex flex-col">
          <div className="p-4 rounded-2xl mb-5 relative w-full aspect-square max-h-[min(40vh,220px)] flex items-center justify-center">
            {qrCodeDataURL ? (
              <img src={qrCodeDataURL} alt="티켓 QR 코드" className="max-w-full max-h-full rounded-xl shadow-sm object-contain" />
            ) : (
              <LoadingSpinner size={40} />
            )}
          </div>

          <div className="mb-4">
            <div className="relative h-14 rounded-3xl border border-white/30 bg-white/12 backdrop-blur-xl overflow-hidden">
              <div
                aria-hidden="true"
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500/70 via-purple-500/60 to-transparent transition-[width] duration-1000 ease-linear"
                style={{ width: `${(formattedTimeLeft / REFRESH_INTERVAL) * 100}%` }}
              />
              <div className="relative h-full flex items-center justify-between px-5">
                <span className="flex items-baseline gap-1 text-white">
                  <span className="text-2xl font-bold leading-none drop-shadow-sm">{formattedTimeLeft}</span>
                  <span className="text-[11px] font-semibold text-white/80">sec</span>
                </span>
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-500 text-center">QR코드는 보안을 위해 15초마다 새로고침됩니다.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
