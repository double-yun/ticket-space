'use client'

interface LoadingSpinnerProps {
  size?: number
  color?: 'primary' | 'inherit' | 'white'
}

export default function LoadingSpinner({ size = 40, color = 'primary' }: LoadingSpinnerProps) {
  const diameter = Math.max(12, size)
  const thickness = Math.max(2, Math.round(diameter / 8))

  const colorValue =
    color === 'inherit' ? 'currentColor' : color === 'white' ? '#ffffff' : '#3b82f6' // tailwind blue-500

  return (
    <div className="flex items-center justify-center">
      <span
        className="animate-spin rounded-full border-solid border-t-transparent"
        style={{
          width: diameter,
          height: diameter,
          borderWidth: thickness,
          borderColor: colorValue,
          borderTopColor: 'transparent',
        }}
        aria-label="Loading"
        role="status"
      />
    </div>
  )
}
