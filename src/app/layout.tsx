'use client'

import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'
import { Toaster } from 'react-hot-toast'
import { useEffect } from 'react'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const setAppHeight = () => {
      const doc = document.documentElement
      doc.style.setProperty('--app-height', `${window.innerHeight}px`)
    }
    window.addEventListener('resize', setAppHeight)
    setAppHeight()

    return () => window.removeEventListener('resize', setAppHeight)
  }, [])

  return (
    <html lang="ko">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0, viewport-fit=cover" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="ios">
        <AuthProvider>
          {children}
          <Toaster
            position="top-center"
            toastOptions={{
              duration: 3000,
              style: {
                background: '#ffffff',
                color: '#374151',
                border: '1px solid #e5e7eb',
                borderRadius: '16px',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                fontSize: '14px',
                fontWeight: '500',
              },
              success: {
                iconTheme: {
                  primary: '#10b981',
                  secondary: '#ffffff',
                },
              },
              error: {
                iconTheme: {
                  primary: '#ef4444',
                  secondary: '#ffffff',
                },
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}