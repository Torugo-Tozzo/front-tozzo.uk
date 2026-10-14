import { createContext, createSignal, onMount, useContext, type Accessor, type JSX } from 'solid-js'

import { logout as revokeSession } from '@/api/auth'
import { api, setSessionExpiredHandler } from '@/api/client'
import { apiErrorOf, unwrap } from '@/api/errors'
import { endSession, refreshSession, sessionUser, startSession, type SessionBody } from '@/api/session'
import { toUser, type User } from '@/domain/user'
import { useTranslation } from '@/i18n/solid'

export interface AuthContextType {
  isAuthenticated: Accessor<boolean>
  user: Accessor<User | null>
  isLoading: Accessor<boolean>
  logout: () => Promise<void>
  refreshUserProfile: () => Promise<void>
  /** Login, sign-up confirmation and Google hand their session here. */
  establishSession: (session: SessionBody) => void
  /** Forgets the session here only (the API already revoked it, e.g. after a password reset). */
  clearSession: () => void
}

const AuthContext = createContext<AuthContextType>()

const goToLogin = () => window.location.assign('/login')

/**
 * The session of the /v1: on boot, the refresh cookie gives back an access
 * token (kept in memory) and the user. The auth pages (login, Google, email
 * confirmation) open a session through establishSession().
 */
export function AuthProvider(props: { children?: JSX.Element }) {
  const [isLoading, setIsLoading] = createSignal(true)
  const [profile, setProfile] = createSignal<User | null>(null)
  const user = () => profile() ?? (sessionUser() ? toUser(sessionUser()!) : null)
  const isAuthenticated = () => sessionUser() !== null
  const { t } = useTranslation('common')

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

  const establishSession = (session: SessionBody) => {
    setProfile(null)
    startSession(session)
  }

  const clearSession = () => {
    endSession()
    setProfile(null)
  }

  const logout = async () => {
    try {
      await revokeSession()
    } catch (error) {
      // 401: the session was already gone. Anything else (5xx, network) left
      // the refresh cookie alive, and a reload would sign the user back in.
      if (apiErrorOf(error).status !== 401) {
        const message = t('logoutFailed')
        // solid-sonner stays out of the initial chunk.
        void import('solid-sonner').then(({ toast }) => toast.error(message))
        return
      }
    }
    clearSession()
    goToLogin()
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, isLoading, logout, refreshUserProfile, establishSession, clearSession }}>
      {props.children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
