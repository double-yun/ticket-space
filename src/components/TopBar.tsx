'use client'

import { ReactNode } from 'react'

interface TopBarProps {
  title: string
  leftButton?: ReactNode
  rightButton?: ReactNode
}

export default function TopBar({ title, leftButton, rightButton }: TopBarProps) {
  return (
    <div className="fixed top-0 left-0 right-0 bg-white/95 backdrop-blur-md border-b border-gray-100 px-4 py-3.5 flex justify-between items-center z-40 shadow-sm">
      <div className="w-10 flex items-center">
        {leftButton && (
          <div className="transition-transform active:scale-90 duration-150">
            {leftButton}
          </div>
        )}
      </div>
      <h1 className="text-lg font-semibold flex-1 text-center text-gray-900 tracking-tight">
        {title}
      </h1>
      <div className="w-10 flex justify-end items-center">
        {rightButton && (
          <div className="transition-transform active:scale-90 duration-150">
            {rightButton}
          </div>
        )}
      </div>
    </div>
  )
}
