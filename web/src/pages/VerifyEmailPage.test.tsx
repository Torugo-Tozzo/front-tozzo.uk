import { createSignal } from 'solid-js'
import { Route } from '@solidjs/router'
import { screen, waitFor } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n/config'
import { json, mockApi, problem } from '@/test/api'
import { renderPage } from '@/test/page'
import VerifyEmailPage from './VerifyEmailPage'

const mockUseAuth = vi.fn()
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

const session = (status: string) => ({
  accessToken: 'token-1',
  accessTokenExpiresAt: '2026-10-01T18:15:00Z',
  user: {
    id: 'u1', name: 'Ana', email: 'ana@example.com', emailVerified: true, phone: null, locale: 'en', role: 'OWNER',
    establishment: { id: 'e1', tradeName: 'Bar', status, plan: 'FREE', category: null, businessProfiles: null, visibleModules: null, preferencesRevision: 0 },
  },
})

function renderVerify(path = '/verify-email?token=verify-token') {
  return renderPage(path, () => (
    <>
      <Route path="/verify-email" component={VerifyEmailPage} />
      <Route path="/dashboard" component={() => <div>Dashboard home</div>} />
      <Route path="/plan" component={() => <div>Plan selection</div>} />
    </>
  ))
}

describe('VerifyEmailPage', () => {
  const establishSession = vi.fn()
  const [authLoading, setAuthLoading] = createSignal(false)

  beforeEach(async () => {
    establishSession.mockReset()
    setAuthLoading(false)
    mockUseAuth.mockReturnValue({ isLoading: authLoading, establishSession })
    await i18n.changeLanguage('en')
  })
  afterEach(() => { vi.unstubAllGlobals() })

  it('confirms the email, opens the session and goes to the dashboard (Free is active on sign-up)', async () => {
    const api = mockApi(({ path }) => (path === '/v1/auth/verify-email' ? json(200, session('ACTIVE')) : undefined))
    renderVerify()

    expect(await screen.findByText('Dashboard home')).toBeInTheDocument()
    const [verify] = api.to('/v1/auth/verify-email')
    expect(verify.body).toEqual({ token: 'verify-token', client: 'web' })
    expect(verify.credentials).toBe('include')
    expect(establishSession).toHaveBeenCalledWith(session('ACTIVE'))
  })

  it('an establishment that is not active goes to plan selection', async () => {
    mockApi(({ path }) => (path === '/v1/auth/verify-email' ? json(200, session('PENDING_PAYMENT')) : undefined))
    renderVerify()

    expect(await screen.findByText('Plan selection')).toBeInTheDocument()
  })

  it('waits for the boot refresh and sends the single-use token once', async () => {
    setAuthLoading(true)
    const api = mockApi(({ path }) => (path === '/v1/auth/verify-email' ? json(200, session('ACTIVE')) : undefined))
    renderVerify()

    expect(screen.getByRole('status')).toHaveTextContent('Confirming your email...')
    expect(api.calls).toHaveLength(0)
    setAuthLoading(false)

    expect(await screen.findByText('Dashboard home')).toBeInTheDocument()
    expect(api.to('/v1/auth/verify-email')).toHaveLength(1)
  })

  it('an expired or used link says so and points to the login (where the email can be resent)', async () => {
    mockApi(({ path }) => (path === '/v1/auth/verify-email' ? problem(400, 'TOKEN_INVALID') : undefined))
    renderVerify()

    expect(await screen.findByText(/The confirmation link has expired or was already used/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to sign in' })).toHaveAttribute('href', '/login')
    expect(establishSession).not.toHaveBeenCalled()
  })

  it('a link without a token does not call the API', async () => {
    const api = mockApi(() => undefined)
    renderVerify('/verify-email')

    expect(screen.getByText(/The confirmation link has expired or was already used/)).toBeInTheDocument()
    await waitFor(() => expect(api.calls).toHaveLength(0))
  })
})
