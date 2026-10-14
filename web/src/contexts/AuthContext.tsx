import { createContext, createSignal, onMount, useContext, type Accessor, type JSX } from 'solid-js'

import { api, setSessionExpiredHandler } from '@/api/client'
import { unwrap } from '@/api/errors'
import { API_URL, endSession, refreshSession, sessionUser } from '@/api/session'
import { toUser, type User } from '@/domain/user'

export interface AuthContextType {
  isAuthenticated: Accessor<boolean>
  user: Accessor<User | null>
  isLoading: Accessor<boolean>
  logout: () => Promise<void>
  refreshUserProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>()

const goToLogin = () => window.location.assign('/login')

/**
 * The session of the /v1: on boot, the refresh cookie gives back an access
 * token (kept in memory) and the user. Login and the auth pages come in S2.
 */
export function AuthProvider(props: { children?: JSX.Element }) {
  const [isLoading, setIsLoading] = createSignal(true)
  const [profile, setProfile] = createSignal<User | null>(null)
  const user = () => profile() ?? (sessionUser() ? toUser(sessionUser()!) : null)
  const isAuthenticated = () => sessionUser() !== null

  setSessionExpiredHandler(() => {
    setProfile(null)
    goToLogin()
  })

  onMount(() => {
    void refreshSession().finally(() => setIsLoading(false))
  })

  const refreshUserProfile = async () => {
    try {
      setProfile(toUser(unwrap(await api.GET('/v1/me'))))
    } catch (error) {
      console.error('Error fetching user profile', error)
    }
  }

  const logout = async () => {
    try {
      await fetch(`${API_URL}/v1/auth/logout`, { method: 'POST', credentials: 'include' })
    } catch {
      // Signing out locally still happens; the cookie expires on its own.
    }
    endSession()
    setProfile(null)
    goToLogin()
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, isLoading, logout, refreshUserProfile }}>
      {props.children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
