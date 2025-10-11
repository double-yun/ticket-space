'use client'

import { ReactNode } from 'react'
import { Bell } from 'lucide-react'

interface TopBarProps {
  title: string
  leftButton?: ReactNode
  rightButton?: ReactNode
}

export default function TopBar({ title, leftButton, rightButton }: TopBarProps) {
  return (
    <div 
      className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-lg z-40 border-b border-gray-200/80"
    >
      <div className="relative flex items-center h-14 px-6">
        {leftButton && (
          <div className="mr-2 -ml-2 transition-transform active:scale-90 duration-150">
            {leftButton}
          </div>
        )}
        <h1 className="text-xl font-bold text-gray-900 tracking-tight truncate">
          {title}
        </h1>
        <div className="flex-1" /> {/* Spacer */}
        <div className="flex justify-end items-center">
          {rightButton ? (
            <div className="transition-transform active:scale-90 duration-150">
              {rightButton}
            </div>
          ) : (
            <button className="p-2 -mr-2 text-gray-600 hover:text-gray-900 active:scale-95 transition-all">
              <Bell size={22} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
