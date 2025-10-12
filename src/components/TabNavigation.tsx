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
    <div className="bg-white/80 backdrop-blur-lg border-t border-gray-100/50 z-50 shadow-sm pb-[env(safe-area-inset-bottom)]">
      <div className="flex">
        {tabs.map(({ path, icon: Icon, label }) => {
          const isActive = pathname === path

          return (
            <button
              key={path}
              onClick={() => router.push(path)}
              className={`
                flex-1 flex flex-col items-center py-2.5 px-2 relative
                transition-all duration-200 ease-out
                active:scale-[0.98]
                ${isActive ? 'text-blue-600' : 'text-gray-400'}
              `}
            >
              {/* Active indicator - glassmorphism style */}
              {isActive && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-blue-500/80 backdrop-blur-sm rounded-full shadow-sm" />
              )}

              {/* Icon */}
              <div className={`
                relative transition-all duration-200
                ${isActive ? 'scale-100' : 'scale-90'}
              `}>
                <Icon
                  size={24}
                  strokeWidth={isActive ? 2.5 : 2}
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
