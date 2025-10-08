'use client'

import { useRouter, usePathname } from 'next/navigation'
import { Home, TicketCheck, Ticket, User } from 'lucide-react'

export default function TabNavigation() {
  const router = useRouter()
  const pathname = usePathname()

  const tabs = [
    { path: '/', icon: Home, label: '홈' },
    { path: '/lottery', icon: TicketCheck, label: '추첨 내역' },
    { path: '/tickets', icon: Ticket, label: '내 티켓' },
    { path: '/profile', icon: User, label: '프로필' },
  ]

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-50 shadow-lg">
      <div className="flex safe-area-inset-bottom">
        {tabs.map(({ path, icon: Icon, label }) => {
          const isActive = pathname === path

          return (
            <button
              key={path}
              onClick={() => router.push(path)}
              className={`
                flex-1 flex flex-col items-center py-2.5 px-2 relative
                transition-all duration-200 ease-out
                active:scale-95 active:bg-gray-50
                ${isActive ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}
              `}
            >
              {/* Active indicator */}
              {isActive && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-blue-600 rounded-full" />
              )}

              {/* Icon with background effect */}
              <div className={`
                relative transition-all duration-200
                ${isActive ? 'scale-100' : 'scale-90'}
              `}>
                {isActive && (
                  <div className="absolute inset-0 bg-blue-50 rounded-xl blur-sm scale-110" />
                )}
                <Icon
                  size={24}
                  strokeWidth={isActive ? 2.5 : 2}
                  className="relative z-10"
                />
              </div>

              {/* Label */}
              <span className={`
                text-xs mt-1 font-medium transition-all duration-200
                ${isActive ? 'text-blue-600 scale-100' : 'text-gray-500 scale-95'}
              `}>
                {label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
