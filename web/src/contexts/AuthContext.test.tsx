import { render, screen, waitFor } from '@solidjs/testing-library'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { api } from '@/api/client'
import { accessToken, endSession } from '@/api/session'
import { AuthProvider, useAuth } from './AuthContext'

const me = {
  id: 'u1', name: 'Ana', email: 'ana@example.com', emailVerified: true, phone: null, locale: 'pt-BR', role: 'OWNER',
  establishment: { id: 'e1', tradeName: 'Tozzo', status: 'ACTIVE', plan: 'PAID', category: null, businessProfiles: null, visibleModules: null, preferencesRevision: 0 },
}
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

let refreshAnswer: () => Response
const calls: Request[] = []

function Probe() {
  const auth = useAuth()
  return (
    <>
      <output data-testid="state">{auth.isLoading() ? 'loading' : auth.isAuthenticated() ? 'in' : 'out'}</output>
      <output data-testid="name">{auth.user()?.name ?? ''}</output>
      <output data-testid="profiles">{String(auth.user()?.establishment?.businessProfiles)}</output>
      <button onClick={() => void auth.logout()}>logout</button>
    </>
  )
}

describe('AuthProvider', () => {
  let assign: ReturnType<typeof vi.fn<(url: string | URL) => void>>

  beforeEach(() => {
    endSession()
    calls.length = 0
    refreshAnswer = () => json(200, { accessToken: 'token-1', accessTokenExpiresAt: '2026-10-01T18:15:00Z', user: me })
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : new Request(input, init)
      calls.push(request)
      const path = new URL(request.url).pathname
      if (path === '/v1/auth/refresh') return refreshAnswer()
      if (path === '/v1/auth/logout') return new Response(null, { status: 204 })
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
})
