import { describe, it, expect, vi, beforeEach, afterEach } from 'bun:test'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { toast } from 'sonner'
import { I18nProvider } from '@/i18n/provider'
import { i18n } from '@/i18n/config'
import { authClient } from '@/lib/authClient'
import { replaceProperty } from '@/test/replace-property'
import ResetPasswordPage from './ResetPasswordPage'

function renderPage() {
  return render(
    <I18nProvider>
      <MemoryRouter initialEntries={['/reset-password']}>
        <Routes>
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/login" element={<div>login page</div>} />
        </Routes>
      </MemoryRouter>
    </I18nProvider>,
  )
}

function mockSession(session: unknown) {
  return replaceProperty(authClient, 'getSession', (async () => ({ data: { session }, error: null })) as typeof authClient.getSession)
}

describe('ResetPasswordPage', () => {
  beforeEach(async () => { await i18n.changeLanguage('en') })

  let restoreSession: () => void
  beforeEach(() => { restoreSession = mockSession({ access_token: 'recovery-token' }) })
  afterEach(() => { restoreSession() })

  async function fillPasswords(password: string, confirmation = password) {
    const user = userEvent.setup()
    await user.type(await screen.findByLabelText(/^new password$/i), password)
    await user.type(screen.getByLabelText(/confirm new password/i), confirmation)
    await user.click(screen.getByRole('button', { name: /reset password/i }))
  }

  it('chama updateUser com a nova senha e navega para o login', async () => {
    const updateMock = vi.fn().mockResolvedValue({ data: {}, error: null })
    const restore = replaceProperty(authClient, 'updateUser', updateMock as typeof authClient.updateUser)

    try {
      renderPage()
      await fillPasswords('novaSenha123')

      await waitFor(() => expect(updateMock).toHaveBeenCalledWith({ password: 'novaSenha123' }))
      expect(await screen.findByText('login page')).toBeInTheDocument()
    } finally {
      restore()
    }
  })

  it('não envia quando a confirmação não bate', async () => {
    const updateMock = vi.fn()
    const restore = replaceProperty(authClient, 'updateUser', updateMock as typeof authClient.updateUser)
    const toastError = vi.spyOn(toast, 'error').mockImplementation(() => '')

    try {
      renderPage()
      await fillPasswords('novaSenha123', 'outraSenha123')

      expect(toastError).toHaveBeenCalledWith("Passwords don't match.")
      expect(updateMock).not.toHaveBeenCalled()
    } finally {
      restore()
      toastError.mockRestore()
    }
  })

  it('explica quando a nova senha é igual à atual', async () => {
    const updateMock = vi.fn().mockResolvedValue({ data: {}, error: { code: 'same_password' } })
    const restore = replaceProperty(authClient, 'updateUser', updateMock as typeof authClient.updateUser)
    const toastError = vi.spyOn(toast, 'error').mockImplementation(() => '')

    try {
      renderPage()
      await fillPasswords('mesmaSenha123')

      await waitFor(() => expect(toastError).toHaveBeenCalledWith('The new password must be different from the current one.'))
    } finally {
      restore()
      toastError.mockRestore()
    }
  })

  it('link expirado ou sem sessão: avisa e oferece pedir outro link em vez do form', async () => {
    restoreSession()
    restoreSession = mockSession(null)

    renderPage()

    expect(await screen.findByText('This reset link has expired or was already used.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Request a new link' })).toHaveAttribute('href', '/forgot-password')
    expect(screen.queryByLabelText(/^new password$/i)).not.toBeInTheDocument()
  })
})
