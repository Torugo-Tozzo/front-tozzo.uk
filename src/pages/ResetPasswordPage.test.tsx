import { Route } from '@solidjs/router'
import { screen, waitFor } from '@solidjs/testing-library'
import userEvent from '@testing-library/user-event'
import { toast } from 'solid-sonner'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n/config'
import { mockApi, noContent, problem } from '@/test/api'
import { renderPage } from '@/test/page'
import ResetPasswordPage from './ResetPasswordPage'

const clearSession = vi.fn()
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ clearSession }),
}))

function renderReset(path = '/reset-password?token=reset-token') {
  return renderPage(path, () => (
    <>
      <Route path="/reset-password" component={ResetPasswordPage} />
      <Route path="/login" component={() => <div>login page</div>} />
    </>
  ))
}

async function fillPasswords(password: string, confirmation = password) {
  const user = userEvent.setup()
  await user.type(await screen.findByLabelText(/^new password$/i), password)
  await user.type(screen.getByLabelText(/confirm new password/i), confirmation)
  await user.click(screen.getByRole('button', { name: /reset password/i }))
}

describe('ResetPasswordPage', () => {
  beforeEach(async () => {
    clearSession.mockReset()
    await i18n.changeLanguage('en')
  })
  afterEach(() => { vi.unstubAllGlobals() })

  it('sends the token from the link and the new password, then goes to the login', async () => {
    const api = mockApi(({ path }) => (path === '/v1/auth/password/reset' ? noContent() : undefined))
    const toastSuccess = vi.spyOn(toast, 'success').mockImplementation(() => '')
    renderReset()

    await fillPasswords('novaSenha123')

    expect(await screen.findByText('login page')).toBeInTheDocument()
    expect(api.to('/v1/auth/password/reset')[0].body).toEqual({ token: 'reset-token', newPassword: 'novaSenha123' })
    expect(toastSuccess).toHaveBeenCalledWith('Password reset successfully.')
    // The API revoked every session, this one included: forget it here too.
    expect(clearSession).toHaveBeenCalledTimes(1)
  })

  it('does not send when the confirmation does not match', async () => {
    const api = mockApi(() => undefined)
    const toastError = vi.spyOn(toast, 'error').mockImplementation(() => '')
    renderReset()

    await fillPasswords('novaSenha123', 'outraSenha123')

    expect(toastError).toHaveBeenCalledWith("Passwords don't match.")
    expect(api.calls).toHaveLength(0)
    expect(clearSession).not.toHaveBeenCalled()
  })

  it('explains a password the API refuses', async () => {
    mockApi(({ path }) => (path === '/v1/auth/password/reset' ? problem(422, 'PASSWORD_INVALID') : undefined))
    const toastError = vi.spyOn(toast, 'error').mockImplementation(() => '')
    renderReset()

    await fillPasswords('novaSenha123')

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Weak password. Use at least 8 characters.'))
    expect(screen.getByLabelText(/^new password$/i)).toBeInTheDocument()
  })

  it('explains when the new password equals the current one (422 PASSWORD_UNCHANGED), keeping the form', async () => {
    mockApi(({ path }) => (path === '/v1/auth/password/reset' ? problem(422, 'PASSWORD_UNCHANGED') : undefined))
    const toastError = vi.spyOn(toast, 'error').mockImplementation(() => '')
    renderReset()

    await fillPasswords('mesmaSenha123')

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('The new password must be different from the current one.'))
    // The token is still valid: the user can try another password.
    expect(screen.getByLabelText(/^new password$/i)).toBeInTheDocument()
    expect(clearSession).not.toHaveBeenCalled()
  })

  it('an expired or used link (TOKEN_INVALID) swaps the form for a new-link offer', async () => {
    mockApi(({ path }) => (path === '/v1/auth/password/reset' ? problem(400, 'TOKEN_INVALID') : undefined))
    renderReset()

    await fillPasswords('novaSenha123')

    expect(await screen.findByText('This reset link has expired or was already used.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Request a new link' })).toHaveAttribute('href', '/forgot-password')
  })

  it('a link without a token: says so and offers a new link instead of the form', () => {
    renderReset('/reset-password')

    expect(screen.getByText('This reset link has expired or was already used.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Request a new link' })).toHaveAttribute('href', '/forgot-password')
    expect(screen.queryByLabelText(/^new password$/i)).not.toBeInTheDocument()
  })
})
