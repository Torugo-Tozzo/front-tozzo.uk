import { Route, type RouteSectionProps } from '@solidjs/router'
import { render, screen, waitFor } from '@solidjs/testing-library'
import userEvent from '@testing-library/user-event'
import { toast } from 'solid-sonner'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { api } from '@/api/client'
import { accessToken, endSession, type SessionBody } from '@/api/session'
import { Navbar } from '@/components/Navbar'
import { ThemeProvider } from '@/components/theme-provider'
import ProtectedRoute from '@/components/ProtectedRoute'
import { i18n } from '@/i18n/config'
import { renderAt } from '@/test/router'
import { ConfirmProvider } from './ConfirmContext'
import { AuthProvider, useAuth } from './AuthContext'

const me = {
  id: 'u1', name: 'Ana', email: 'ana@example.com', emailVerified: true, phone: null, locale: 'pt-BR', role: 'OWNER',
  establishment: { id: 'e1', tradeName: 'Tozzo', status: 'ACTIVE', plan: 'PAID', category: null, businessProfiles: null, visibleModules: null, preferencesRevision: 0 },
}
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

let refreshAnswer: () => Response | Promise<Response>
let logoutAnswer: (() => Response | Promise<Response>) | null = null
const loginSession = {
  accessToken: 'token-login', accessTokenExpiresAt: '2026-10-01T18:15:00Z', user: { ...me, name: 'Bia' },
} as SessionBody
const calls: Request[] = []

function Probe() {
  const auth = useAuth()
  return (
    <>
      <output data-testid="state">{auth.isLoading() ? 'loading' : auth.isAuthenticated() ? 'in' : 'out'}</output>
      <output data-testid="name">{auth.user()?.name ?? ''}</output>
      <output data-testid="profiles">{String(auth.user()?.establishment?.businessProfiles)}</output>
      <output data-testid="status">{auth.user()?.establishment?.status ?? 'none'}</output>
      <button onClick={() => void auth.logout()}>logout</button>
      <button onClick={() => auth.establishSession(loginSession)}>sign in</button>
    </>
  )
}

describe('AuthProvider', () => {
  let assign: ReturnType<typeof vi.fn<(url: string | URL) => void>>

  beforeEach(() => {
    endSession()
    logoutAnswer = null
    calls.length = 0
    refreshAnswer = () => json(200, { accessToken: 'token-1', accessTokenExpiresAt: '2026-10-01T18:15:00Z', user: me })
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : new Request(input, init)
      calls.push(request)
      const path = new URL(request.url).pathname
      if (path === '/v1/auth/refresh') return refreshAnswer()
      if (path === '/v1/auth/logout') {
        if (logoutAnswer) return logoutAnswer()
        return request.headers.get('Authorization') ? new Response(null, { status: 204 }) : json(401, { title: 'Unauthorized', status: 401, code: 'UNAUTHENTICATED' })
      }
      return json(401, { title: 'Unauthorized', status: 401, code: 'INVALID_TOKEN' })
    }))
    assign = vi.fn<(url: string | URL) => void>()
    vi.spyOn(window.location, 'assign').mockImplementation(assign)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('boots the session from the refresh cookie, keeping the token in memory only', async () => {
    render(() => <AuthProvider><Probe /></AuthProvider>)
    expect(screen.getByTestId('state')).toHaveTextContent(/^loading$/)

    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent(/^in$/))
    expect(screen.getByTestId('name')).toHaveTextContent('Ana')
    // A null business profile list is a legacy establishment (full legacy menu).
    expect(screen.getByTestId('profiles')).toHaveTextContent('undefined')
    expect(calls[0].credentials).toBe('include')
    expect(accessToken()).toBe('token-1')
    expect(JSON.stringify({ ...localStorage, ...sessionStorage })).not.toContain('token-1')
  })

  test('without a valid cookie the user is signed out', async () => {
    refreshAnswer = () => json(401, { title: 'Unauthorized', status: 401, code: 'UNAUTHENTICATED' })
    render(() => <AuthProvider><Probe /></AuthProvider>)
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent(/^out$/))
    expect(accessToken()).toBeNull()
  })

  test('logout revokes the cookie session, forgets the token and goes to /login', async () => {
    const user = userEvent.setup()
    render(() => <AuthProvider><Probe /></AuthProvider>)
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent(/^in$/))

    await user.click(screen.getByRole('button', { name: 'logout' }))

    const logout = calls.find((request) => new URL(request.url).pathname === '/v1/auth/logout')!
    expect(logout.method).toBe('POST')
    expect(logout.credentials).toBe('include')
    // The /v1 logout is an authenticated route: it needs the bearer token.
    expect(logout.headers.get('Authorization')).toBe('Bearer token-1')
    expect(accessToken()).toBeNull()
    expect(assign).toHaveBeenCalledWith('/login')
  })

  test('an expired session that cannot refresh goes to /login', async () => {
    render(() => <AuthProvider><Probe /></AuthProvider>)
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent(/^in$/))
    refreshAnswer = () => json(401, { title: 'Unauthorized', status: 401, code: 'SESSION_REVOKED' })

    await api.GET('/v1/me')

    expect(assign).toHaveBeenCalledWith('/login')
    expect(screen.getByTestId('state')).toHaveTextContent(/^out$/)
  })

  test('establishSession opens the session a login, Google or email confirmation returned', async () => {
    refreshAnswer = () => json(401, { title: 'Unauthorized', status: 401, code: 'UNAUTHENTICATED' })
    const user = userEvent.setup()
    render(() => <AuthProvider><Probe /></AuthProvider>)
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent(/^out$/))

    await user.click(screen.getByRole('button', { name: 'sign in' }))

    expect(screen.getByTestId('state')).toHaveTextContent(/^in$/)
    expect(screen.getByTestId('name')).toHaveTextContent('Bia')
    expect(accessToken()).toBe('token-login')
  })

  test('a boot refresh that fails after a login finished does not sign the new session out', async () => {
    let answer!: (response: Response) => void
    refreshAnswer = () => new Promise<Response>((resolve) => { answer = resolve })
    const user = userEvent.setup()
    render(() => <AuthProvider><Probe /></AuthProvider>)

    await user.click(screen.getByRole('button', { name: 'sign in' }))
    expect(accessToken()).toBe('token-login')
    answer(json(401, { title: 'Unauthorized', status: 401, code: 'UNAUTHENTICATED' }))

    // isLoading turns false only when the boot refresh settled (its finally).
    await waitFor(() => expect(screen.getByTestId('state')).not.toHaveTextContent(/^loading$/))
    expect(screen.getByTestId('state')).toHaveTextContent(/^in$/)
    expect(accessToken()).toBe('token-login')
  })

  test('keeps a pending user authenticated and on the allowed plan route', async () => {
    refreshAnswer = () => json(200, { accessToken: 'token-1', accessTokenExpiresAt: '2026-10-01T18:15:00Z', user: { ...me, establishment: { ...me.establishment, status: 'PENDING_PAYMENT' } } })
    renderAt('/plan', () => (
      <>
        <Route path="/login" component={() => <div>login page</div>} />
        <Route component={(props: RouteSectionProps) => <ProtectedRoute allowPending>{props.children}</ProtectedRoute>}>
          <Route path="/plan" component={() => <div>plan page</div>} />
        </Route>
      </>
    ), (router) => <AuthProvider><Probe />{router()}</AuthProvider>)

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('PENDING_PAYMENT'))
    expect(screen.getByTestId('state')).toHaveTextContent(/^in$/)
    expect(await screen.findByText('plan page')).toBeInTheDocument()
    expect(screen.queryByText('login page')).not.toBeInTheDocument()
  })

  test('keeps a structured pending status and localizes the payment pending label', async () => {
    await i18n.changeLanguage('pt-BR')
    refreshAnswer = () => json(200, { accessToken: 'token-1', accessTokenExpiresAt: '2026-10-01T18:15:00Z', user: { ...me, establishment: { ...me.establishment, tradeName: '', status: 'PENDING_PAYMENT' } } })
    render(() => <ThemeProvider><AuthProvider><ConfirmProvider><Probe /><Navbar /></ConfirmProvider></AuthProvider></ThemeProvider>)

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('PENDING_PAYMENT'))
    expect(screen.getByText('Pagamento pendente')).toBeInTheDocument()

    await i18n.changeLanguage('en')
    expect(await screen.findByText('Payment pending')).toBeInTheDocument()
    expect(screen.queryByText('Pagamento pendente')).not.toBeInTheDocument()
  })

  test('a failed logout (5xx or network) keeps the session, says so and does not leave the page', async () => {
    await i18n.changeLanguage('en')
    const toastError = vi.spyOn(toast, 'error').mockImplementation(() => '')
    const user = userEvent.setup()
    render(() => <AuthProvider><Probe /></AuthProvider>)
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent(/^in$/))

    logoutAnswer = () => json(500, { title: 'Internal', status: 500, code: 'INTERNAL_ERROR' })
    await user.click(screen.getByRole('button', { name: 'logout' }))
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Could not sign out. Check your connection and try again.'))

    logoutAnswer = () => Promise.reject(new TypeError('Failed to fetch'))
    await user.click(screen.getByRole('button', { name: 'logout' }))
    await waitFor(() => expect(toastError).toHaveBeenCalledTimes(2))

    expect(assign).not.toHaveBeenCalled()
    expect(screen.getByTestId('state')).toHaveTextContent(/^in$/)
    expect(accessToken()).toBe('token-1')
  })

  test('a logout answered 401 (session already gone) still signs out here', async () => {
    const user = userEvent.setup()
    render(() => <AuthProvider><Probe /></AuthProvider>)
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent(/^in$/))

    logoutAnswer = () => json(401, { title: 'Unauthorized', status: 401, code: 'UNAUTHENTICATED' })
    await user.click(screen.getByRole('button', { name: 'logout' }))

    await waitFor(() => expect(assign).toHaveBeenCalledWith('/login'))
    expect(accessToken()).toBeNull()
  })
})
