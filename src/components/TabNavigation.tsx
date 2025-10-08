'use client'

import { useRouter, usePathname } from 'next/navigation'

export default function TabNavigation() {
  const router = useRouter()
  const pathname = usePathname()

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
      <div className="flex">
        <button
          onClick={() => router.push('/')}
          className={`flex-1 flex flex-col items-center py-3 ${
            pathname === '/' ? 'text-blue-600' : 'text-gray-500'
          }`}
        >
          <span className="text-lg">🏠</span>
          <span className="text-xs mt-1">홈</span>
        </button>
        <button
          onClick={() => router.push('/lottery')}
          className={`flex-1 flex flex-col items-center py-3 ${
            pathname === '/lottery' ? 'text-blue-600' : 'text-gray-500'
          }`}
        >
          <span className="text-lg">🍀</span>
          <span className="text-xs mt-1">추첨 내역</span>
        </button>
        <button
          onClick={() => router.push('/tickets')}
          className={`flex-1 flex flex-col items-center py-3 ${
            pathname === '/tickets' ? 'text-blue-600' : 'text-gray-500'
          }`}
        >
          <span className="text-lg">🎫</span>
          <span className="text-xs mt-1">내 티켓</span>
        </button>
        <button
          onClick={() => router.push('/profile')}
          className={`flex-1 flex flex-col items-center py-3 ${
            pathname === '/profile' ? 'text-blue-600' : 'text-gray-500'
          }`}
        >
          <span className="text-lg">👤</span>
          <span className="text-xs mt-1">프로필</span>
        </button>
      </div>
    </div>
  )
}
