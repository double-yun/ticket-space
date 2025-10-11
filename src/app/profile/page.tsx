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

interface Purchase {
  id: string
  eventId: string
  ticketId: string
  pointAmount: number
  purchaseDate: string
  used: boolean
}

export default function ProfilePage() {
  const router = useRouter()
  const { user, token, logout, isLoading: authLoading } = useAuth()
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [copied, setCopied] = useState(false)

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

  const { containerRef, isRefreshing } = usePullToRefresh(fetchPurchases)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.push('/login')
    } else {
      fetchPurchases()
    }
  }, [authLoading, user, router, fetchPurchases])

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
      await navigator.clipboard.writeText(user.walletAddress)
      setCopied(true)
      
      // 2초 후 복사 상태 초기화
      setTimeout(() => {
        setCopied(false)
      }, 2000)
    } catch (error) {
      console.error('Failed to copy address:', error)
      toast.error('주소 복사에 실패했습니다.')
    }
  }

  const stats = useMemo(() => {
    const heldTickets = purchases.filter(p => !p.used).length
    const usedTickets = purchases.filter(p => p.used).length
    const totalPurchaseAmount = purchases.reduce((sum, p) => sum + p.pointAmount, 0)
    return { heldTickets, usedTickets, totalPurchaseAmount }
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
      <div className="bg-gray-50 min-h-screen flex justify-center items-center">
        <LoadingSpinner size={48} />
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-b from-indigo-50/30 via-white to-blue-50/30 h-screen flex flex-col">
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
                      <div className="flex items-center gap-1 text-emerald-600">
                        <Check size={18} />
                        <span className="text-xs font-semibold">복사됨</span>
                      </div>
                    ) : (
                      <Copy size={18} className="text-gray-400" />
                    )}
                  </div>
                </div>
              </button>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-blue-500/5 backdrop-blur-xl border border-blue-200/30 rounded-2xl p-3 text-center">
                <p className="text-2xl font-bold text-gray-900 mb-1">{stats.heldTickets}</p>
                <p className="text-xs text-gray-600">보유 티켓</p>
              </div>
              <div className="bg-emerald-500/5 backdrop-blur-xl border border-emerald-200/30 rounded-2xl p-3 text-center">
                <p className="text-2xl font-bold text-gray-900 mb-1">{stats.usedTickets}</p>
                <p className="text-xs text-gray-600">사용한 티켓</p>
              </div>
              <div className="bg-purple-500/5 backdrop-blur-xl border border-purple-200/30 rounded-2xl p-3 text-center">
                <p className="text-2xl font-bold text-gray-900 mb-1">{stats.totalPurchaseAmount.toLocaleString()}</p>
                <p className="text-xs text-gray-600">총 구매액</p>
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
                    item.danger ? 'text-red-600' : 'text-gray-800'
                  }`}
                >
                  <div className="flex items-center space-x-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                      item.danger
                        ? 'bg-red-500/10 backdrop-blur-xl border border-red-200/30'
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