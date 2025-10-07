'use client'

import { useEffect, useRef } from 'react'
import jsQR from 'jsqr'

interface QrScannerProps {
  onScan: (data: string) => void
  onError: (error: Error) => void
}

export default function QrScanner({ onScan, onError }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animationFrameRef = useRef<number | null>(null)

  useEffect(() => {
    let mounted = true

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }, // 후면 카메라 우선
        })

        if (!mounted) {
          stream.getTracks().forEach(track => track.stop())
          return
        }

        streamRef.current = stream

        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play()

          // 비디오가 재생되면 스캔 시작
          videoRef.current.onloadedmetadata = () => {
            scanQRCode()
          }
        }
      } catch (error) {
        console.error('카메라 시작 실패:', error)
        onError(error as Error)
      }
    }

    const scanQRCode = () => {
      if (!mounted || !videoRef.current || !canvasRef.current) return

      const video = videoRef.current
      const canvas = canvasRef.current
      const context = canvas.getContext('2d')

      if (!context) return

      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.height = video.videoHeight
        canvas.width = video.videoWidth

        context.drawImage(video, 0, 0, canvas.width, canvas.height)
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        })

        if (code && code.data) {
          console.log('QR 코드 감지:', code.data)
          onScan(code.data)
          stopCamera()
          return
        }
      }

      // 다음 프레임 스캔
      animationFrameRef.current = requestAnimationFrame(scanQRCode)
    }

    const stopCamera = () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
        streamRef.current = null
      }

      if (videoRef.current) {
        videoRef.current.srcObject = null
      }
    }

    startCamera()

    return () => {
      mounted = false
      stopCamera()
    }
  }, [onScan, onError])

  return (
    <div className="relative w-full aspect-square bg-black rounded-xl overflow-hidden">
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        playsInline
        muted
      />
      <canvas ref={canvasRef} className="hidden" />

      {/* 스캔 가이드 오버레이 */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-64 h-64 border-4 border-white rounded-2xl shadow-lg opacity-50"></div>
      </div>

      <div className="absolute bottom-4 left-0 right-0 text-center">
        <p className="text-white text-sm bg-black bg-opacity-50 px-4 py-2 rounded-full inline-block">
          QR 코드를 스캔 영역에 맞춰주세요
        </p>
      </div>
    </div>
  )
}