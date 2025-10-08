'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'

interface User {
  id: string
  name?: string | null
  email?: string | null
  image?: string | null
  walletAddress?: string | null
  kakaoId?: string | null
  phoneNumber?: string | null
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  token: string | null
  getToken: () => Promise<string | undefined>
  setAuthToken: (token: string) => void
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const TOKEN_KEY = 'auth_token'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Load token from localStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem(TOKEN_KEY)
    if (savedToken) {
      setToken(savedToken)
    } else {
      setIsLoading(false)
    }
  }, [])

  // Fetch user when token changes
  const refreshUser = useCallback(async () => {
    if (!token) {
      setUser(null)
      setIsLoading(false)
      return
    }

    try {
      const response = await fetch('/api/auth/session', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      const data = await response.json()
      setUser(data.user || null)
    } catch (error) {
      console.error('Failed to fetch user:', error)
      setUser(null)
      // Invalid token, clear it
      localStorage.removeItem(TOKEN_KEY)
      setToken(null)
    } finally {
      setIsLoading(false)
    }
  }, [token])

  useEffect(() => {
    if (token) {
      setIsLoading(true)
      refreshUser()
    }
  }, [token, refreshUser])

  // Privy custom auth callback
  const getToken = useCallback(async () => {
    return token || undefined
  }, [token])

  const setAuthToken = useCallback((newToken: string) => {
    setIsLoading(true)
    localStorage.setItem(TOKEN_KEY, newToken)
    setToken(newToken)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    setToken(null)
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      token,
      getToken,
      setAuthToken,
      logout,
      refreshUser
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
