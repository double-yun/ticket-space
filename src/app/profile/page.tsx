'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import TabNavigation from '@/components/TabNavigation'
import TopBar from '@/components/TopBar'
import usePullToRefresh from '@/hooks/usePullToRefresh'

export default function ProfilePage() {
  const router = useRouter()
  const { user, logout, isLoading: authLoading } = useAuth()

  const { containerRef, isRefreshing } = usePullToRefresh(async () => {
    // 프로필 페이지는 실시간 데이터가 없으므로 빈 함수
  })

  useEffect(() => {
    if (authLoading) {
      return
    }

    if (!user) {
      router.push('/login')
    }
  }, [authLoading, user, router])

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
      })

      if (!response.ok) {
        console.error('Logout failed')
      }
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      logout()
      router.push('/login')
    }
  }

  const menuItems = [
    { icon: '⚙️', label: '설정', action: () => console.log('설정') },
    { icon: '🔔', label: '알림', action: () => console.log('알림') },
    { icon: '❓', label: '고객센터', action: () => console.log('고객센터') },
    { icon: '🚪', label: '로그아웃', action: handleLogout, danger: true },
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
        {/* 프로필 카드 */}
        <div className="bg-white rounded-3xl p-6 shadow-sm">
          <div className="flex items-center space-x-4 mb-6">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <span className="text-white text-4xl">👤</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{user?.name ?? '사용자'}</h2>
              <p className="text-gray-600">{user?.email ?? 'user@example.com'}</p>
            </div>
          </div>

          {/* 통계 */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">0</p>
              <p className="text-sm text-gray-600">보유 티켓</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">0</p>
              <p className="text-sm text-gray-600">사용한 티켓</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-600">0</p>
              <p className="text-sm text-gray-600">총 구매금액</p>
            </div>
          </div>
        </div>

        {/* 메뉴 */}
        <div className="bg-white rounded-3xl overflow-hidden shadow-sm">
          {menuItems.map((item, index) => (
            <button
              key={index}
              onClick={item.action}
              className={`w-full flex items-center justify-between p-4 border-b border-gray-100 last:border-0 active:bg-gray-50 transition-colors ${
                item.danger ? 'text-red-600' : 'text-gray-800'
              }`}
            >
              <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  item.danger ? 'bg-red-100' : 'bg-gray-100'
                }`}>
                  <span className="text-lg">{item.icon}</span>
                </div>
                <span className="font-medium">{item.label}</span>
              </div>
              <div className="text-gray-400">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M6 3l5 5-5 5V3z"/>
                </svg>
              </div>
            </button>
          ))}
        </div>

        {/* 앱 정보 */}
        <div className="bg-white rounded-3xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">앱 정보</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">버전</span>
              <span className="text-gray-800">1.0.0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">개발자</span>
              <span className="text-gray-800">Ticketing Team</span>
            </div>
          </div>
        </div>
        </div>
      </div>

      <TabNavigation />
    </div>
  )
}
