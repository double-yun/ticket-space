'use client'

import { ReactNode } from 'react'

interface TopBarProps {
  title: string
  leftButton?: ReactNode
  rightButton?: ReactNode
}

export default function TopBar({ title, leftButton, rightButton }: TopBarProps) {
  return (
    <div className="fixed top-0 left-0 right-0 bg-white border-b border-gray-200 px-4 py-3 flex justify-between items-center z-40">
      <div className="w-10">
        {leftButton}
      </div>
      <h1 className="text-xl font-bold flex-1 text-center">{title}</h1>
      <div className="w-10 flex justify-end">
        {rightButton}
      </div>
    </div>
  )
}
