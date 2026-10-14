import { Route } from '@solidjs/router'
import { screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n/config'
import { mockApi, noContent, problem } from '@/test/api'
import { renderPage } from '@/test/page'
import ConfirmEmailPage from './ConfirmEmailPage'

const mockUseAuth = vi.fn()
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

const renderConfirm = (path = '/confirm-email?token=change-token') =>
  renderPage(path, () => <Route path="/confirm-email" component={ConfirmEmailPage} />)

describe('ConfirmEmailPage', () => {
  const refreshUserProfile = vi.fn()

  beforeEach(async () => {
    refreshUserProfile.mockReset()
    mockUseAuth.mockReturnValue({ isAuthenticated: () => true, refreshUserProfile })
    await i18n.changeLanguage('en')
  })
  afterEach(() => { vi.unstubAllGlobals() })

  it('applies the new email and reloads the signed-in profile', async () => {
    const api = mockApi(({ path }) => (path === '/v1/auth/email/confirm' ? noContent() : undefined))
    renderConfirm()

    expect(screen.getByRole('status')).toHaveTextContent('Confirming your new email...')
    expect(await screen.findByText(/Your email was changed/)).toBeInTheDocument()
    expect(api.to('/v1/auth/email/confirm')[0].body).toEqual({ token: 'change-token' })
    expect(refreshUserProfile).toHaveBeenCalled()
  })

  it('an expired or used link says so', async () => {
    mockApi(({ path }) => (path === '/v1/auth/email/confirm' ? problem(400, 'TOKEN_INVALID') : undefined))
    renderConfirm()

    expect(await screen.findByText(/This confirmation link has expired or was already used/)).toBeInTheDocument()
    expect(refreshUserProfile).not.toHaveBeenCalled()
  })

  it('an address taken meanwhile (409 EMAIL_IN_USE) gets its own message', async () => {
    mockApi(({ path }) => (path === '/v1/auth/email/confirm' ? problem(409, 'EMAIL_IN_USE') : undefined))
    renderConfirm()

    expect(await screen.findByText('This email is already in use by another account.')).toBeInTheDocument()
  })

  it('a link without a token does not call the API', () => {
    const api = mockApi(() => undefined)
    renderConfirm('/confirm-email')

    expect(screen.getByText(/This confirmation link has expired or was already used/)).toBeInTheDocument()
    expect(api.calls).toHaveLength(0)
  })
})
