'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import usePullToRefresh from '@/hooks/usePullToRefresh'
import TopBar from '@/components/TopBar'
import TabNavigation from '@/components/TabNavigation'
import { Settings, Bell, HelpCircle, LogOut, User } from 'lucide-react'

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

  const stats = useMemo(() => {
    const heldTickets = purchases.filter(p => !p.used).length
    const usedTickets = purchases.filter(p => p.used).length
    const totalPurchaseAmount = purchases.reduce((sum, p) => sum + p.pointAmount, 0)
    return { heldTickets, usedTickets, totalPurchaseAmount }
  }, [purchases])

  const menuItems = [
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="bg-gray-50 min-h-screen overflow-hidden">
      <TopBar title="프로필" />

      <div ref={containerRef} className="h-[calc(100vh-60px)] overflow-y-auto pt-[60px]">
        {isRefreshing && (
          <div className="text-center py-2">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
        )}
        <div className="pb-20 px-4 pt-6 space-y-6">
          <div className="bg-gradient-to-br from-blue-500 via-blue-600 to-purple-600 rounded-3xl p-6 shadow-xl shadow-blue-500/20">
            <div className="flex items-center space-x-4 mb-6">
              <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center ring-4 ring-white/30">
                <User className="h-10 w-10 text-white" strokeWidth={1.5} />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-white mb-1">{user?.name ?? '사용자'}</h2>
                <p className="text-blue-100 text-sm font-mono">{user?.email ?? 'user@example.com'}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-3 text-center">
                <p className="text-2xl font-bold text-white mb-1">{stats.heldTickets}</p>
                <p className="text-xs text-blue-100">보유 티켓</p>
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-3 text-center">
                <p className="text-2xl font-bold text-white mb-1">{stats.usedTickets}</p>
                <p className="text-xs text-blue-100">사용한 티켓</p>
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-3 text-center">
                <p className="text-2xl font-bold text-white mb-1">{stats.totalPurchaseAmount.toLocaleString()}</p>
                <p className="text-xs text-blue-100">총 구매액</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl overflow-hidden shadow-lg border border-gray-100">
            {menuItems.map((item, index) => {
              const IconComponent = item.icon
              return (
                <button
                  key={index}
                  onClick={item.action}
                  className={`w-full flex items-center justify-between p-4 border-b border-gray-100 last:border-0 active:bg-gray-50 transition-colors duration-150 ${
                    item.danger ? 'text-red-600' : 'text-gray-800'
                  }`}
                >
                  <div className="flex items-center space-x-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                      item.danger ? 'bg-red-50' : 'bg-gray-100'
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

          <div className="bg-white rounded-3xl p-5 shadow-lg border border-gray-100">
            <h3 className="text-base font-bold text-gray-900 mb-4">앱 정보</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center py-1">
                <span className="text-gray-600">버전</span>
                <span className="font-semibold text-gray-900">1.0.0</span>
              </div>
              <div className="h-px bg-gray-100" />
              <div className="flex justify-between items-center py-1">
                <span className="text-gray-600">개발자</span>
                <span className="font-semibold text-gray-900">Ticketing Team</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <TabNavigation />
    </div>
  )
}
