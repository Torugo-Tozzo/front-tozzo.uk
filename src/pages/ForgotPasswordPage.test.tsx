import { Route } from '@solidjs/router'
import { screen, waitFor } from '@solidjs/testing-library'
import userEvent from '@testing-library/user-event'
import { toast } from 'solid-sonner'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n/config'
import { json, mockApi, problem } from '@/test/api'
import { renderPage } from '@/test/page'
import ForgotPasswordPage from './ForgotPasswordPage'

const renderForgot = () => renderPage('/forgot-password', () => <Route path="/forgot-password" component={ForgotPasswordPage} />)

describe('ForgotPasswordPage', () => {
  beforeEach(async () => { await i18n.changeLanguage('en') })
  afterEach(() => { vi.unstubAllGlobals() })

  it('sends the normalized email to POST /v1/auth/password/forgot', async () => {
    const api = mockApi(({ path }) => (path === '/v1/auth/password/forgot' ? json(202, {}) : undefined))
    const user = userEvent.setup()
    renderForgot()

    await user.type(screen.getByLabelText(/email/i), ' Ana@Example.com ')
    await user.click(screen.getByRole('button', { name: /send reset link/i }))

    // It does not say the account exists (the /v1 answers 202 for any email).
    expect(await screen.findByText(/If an account exists for ana@example\.com/)).toBeInTheDocument()
    expect(api.to('/v1/auth/password/forgot')[0].body).toEqual({ email: 'ana@example.com' })
    expect(screen.getByRole('link', { name: 'Back to sign in' })).toHaveAttribute('href', '/login')
  })

  it('shows an error when sending the reset link fails', async () => {
    mockApi(({ path }) => (path === '/v1/auth/password/forgot' ? problem(500, 'INTERNAL_ERROR') : undefined))
    const toastError = vi.spyOn(toast, 'error').mockImplementation(() => '')
    const user = userEvent.setup()
    renderForgot()

    await user.type(screen.getByLabelText(/email/i), 'ana@example.com')
    await user.click(screen.getByRole('button', { name: /send reset link/i }))

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Could not reset password.'))
    expect(screen.queryByText(/If an account exists/)).not.toBeInTheDocument()
  })

  it('explains the rate limit', async () => {
    mockApi(({ path }) => (path === '/v1/auth/password/forgot' ? problem(429, 'RATE_LIMITED') : undefined))
    const toastError = vi.spyOn(toast, 'error').mockImplementation(() => '')
    const user = userEvent.setup()
    renderForgot()

    await user.type(screen.getByLabelText(/email/i), 'ana@example.com')
    await user.click(screen.getByRole('button', { name: /send reset link/i }))

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Too many attempts in a row. Wait a minute and try again.'))
  })
})
