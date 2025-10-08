'use client'

import { useEffect, useRef, useState } from 'react'

export default function usePullToRefresh(onRefresh: () => Promise<void>) {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const startY = useRef(0)
  const pullDistance = useRef(0)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let touchStartY = 0
    let currentY = 0
    let isPulling = false

    const handleTouchStart = (e: TouchEvent) => {
      // 스크롤이 최상단에 있을 때만 pull-to-refresh 활성화
      if (container.scrollTop === 0) {
        touchStartY = e.touches[0].clientY
        startY.current = touchStartY
        isPulling = true
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPulling || isRefreshing) return

      currentY = e.touches[0].clientY
      const diff = currentY - touchStartY

      // 아래로 당길 때만 (diff > 0)
      if (diff > 0 && container.scrollTop === 0) {
        pullDistance.current = Math.min(diff, 100) // 최대 100px
        container.style.transform = `translateY(${pullDistance.current}px)`
        container.style.transition = 'none'
      }
    }

    const handleTouchEnd = async () => {
      if (!isPulling) return
      isPulling = false

      // 70px 이상 당겼을 때 새로고침 트리거
      if (pullDistance.current > 70 && !isRefreshing) {
        setIsRefreshing(true)
        try {
          await onRefresh()
        } finally {
          setIsRefreshing(false)
        }
      }

      // 원래 위치로 복귀
      container.style.transform = 'translateY(0)'
      container.style.transition = 'transform 0.3s ease'
      pullDistance.current = 0
    }

    container.addEventListener('touchstart', handleTouchStart, { passive: true })
    container.addEventListener('touchmove', handleTouchMove, { passive: true })
    container.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      container.removeEventListener('touchstart', handleTouchStart)
      container.removeEventListener('touchmove', handleTouchMove)
      container.removeEventListener('touchend', handleTouchEnd)
    }
  }, [onRefresh, isRefreshing])

  return { containerRef, isRefreshing }
}
