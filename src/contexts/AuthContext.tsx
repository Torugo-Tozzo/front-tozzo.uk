import React, { createContext, useContext, useEffect, useState } from 'react'
import api from '../services/api'
import { authClient } from '../lib/authClient'
import type { Establishment, User } from '@/domain/models'
import { fromLegacyWire, normalizeRole } from '@/lib/legacyWire'

interface AuthContextType {
  isAuthenticated: boolean
  user: User | null
  isLoading: boolean
  logout: () => Promise<void>
  refreshUserProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType)

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const refreshUserProfile = async () => {
    try {
      const userResponse = await api.get('/usuarios/me')
      const authenticatedUser: User = {
        id: userResponse.data.id,
        name: userResponse.data.name || '',
        email: userResponse.data.email || '',
        role: normalizeRole(userResponse.data.role),
        establishment: undefined,
      }
      try {
        const response = await api.get('/estabelecimentos')
        const raw = Array.isArray(response.data) ? response.data[0] : response.data
        if (raw) authenticatedUser.establishment = fromLegacyWire<unknown>(raw, 'establishment') as Establishment
      } catch (error: any) {
        console.warn('Não foi possível buscar detalhes do estabelecimento', error)
        if (error.response?.status === 402) authenticatedUser.establishment = { id: 0, tradeName: '', status: 'PENDING_PAYMENT' }
      }
      setUser(authenticatedUser)
    } catch (error) {
      console.error('Error fetching user profile', error)
    }
  }

  useEffect(() => {
    let mounted = true
    const { data: { subscription } } = authClient.onAuthStateChange(async (_event: string, session: { access_token: string } | null) => {
      if (!mounted) return
      if (!session) {
        setIsAuthenticated(false)
        setUser(null)
        setIsLoading(false)
        return
      }
      setIsAuthenticated(true)
      setIsLoading(true)
      await refreshUserProfile()
      if (mounted) setIsLoading(false)
    })
    return () => { mounted = false; subscription.unsubscribe() }
  }, [])

  const logout = async () => {
    await authClient.signOut()
    setIsAuthenticated(false)
    setUser(null)
    window.location.href = '/login'
  }

  return <AuthContext.Provider value={{ isAuthenticated, user, isLoading, logout, refreshUserProfile }}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
