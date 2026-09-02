import { describe, it, expect, vi } from 'bun:test'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { I18nProvider } from '@/i18n/provider'
import { authClient } from '@/lib/authClient'
import { replaceProperty } from '@/test/replace-property'
import { toast } from 'sonner'
import ForgotPasswordPage from './ForgotPasswordPage'

describe('ForgotPasswordPage', () => {
  it('chama resetPasswordForEmail com o email digitado', async () => {
    const resetMock = vi.fn().mockResolvedValue({ data: {}, error: null })
    const restore = replaceProperty(authClient, 'resetPasswordForEmail', resetMock as typeof authClient.resetPasswordForEmail)

    try {
      const user = userEvent.setup()
      render(
        <I18nProvider>
          <MemoryRouter>
            <ForgotPasswordPage />
          </MemoryRouter>
        </I18nProvider>,
      )

      await user.type(screen.getByLabelText(/email/i), 'ana@example.com')
      await user.click(screen.getByRole('button', { name: /send reset link|enviar/i }))

      await waitFor(() => expect(resetMock).toHaveBeenCalledWith('ana@example.com', {
        redirectTo: `${window.location.origin}/reset-password`,
      }))
      expect(screen.getByText(/check your email|verifique seu email/i)).toBeInTheDocument()
    } finally {
      restore()
    }
  })

  it('exibe um erro quando o envio do link de redefinição falha', async () => {
    const resetMock = vi.fn().mockResolvedValue({ data: {}, error: { code: 'unexpected_failure' } })
    const restore = replaceProperty(authClient, 'resetPasswordForEmail', resetMock as typeof authClient.resetPasswordForEmail)
    const toastError = vi.spyOn(toast, 'error').mockImplementation(() => '')

    try {
      const user = userEvent.setup()
      render(
        <I18nProvider>
          <MemoryRouter>
            <ForgotPasswordPage />
          </MemoryRouter>
        </I18nProvider>,
      )

      await user.type(screen.getByLabelText(/email/i), 'ana@example.com')
      await user.click(screen.getByRole('button', { name: /send reset link|enviar/i }))

      await waitFor(() => expect(toastError).toHaveBeenCalledWith('Could not reset password.'))
      expect(screen.queryByText(/check your email|verifique seu email/i)).not.toBeInTheDocument()
    } finally {
      restore()
      toastError.mockRestore()
    }
  })
})
