import { describe, it, expect, vi } from 'bun:test'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { I18nProvider } from '@/i18n/provider'
import { authClient } from '@/lib/authClient'
import { replaceProperty } from '@/test/replace-property'
import ResetPasswordPage from './ResetPasswordPage'

describe('ResetPasswordPage', () => {
  it('chama updateUser com a nova senha e navega para o login', async () => {
    const updateMock = vi.fn().mockResolvedValue({ data: {}, error: null })
    const restore = replaceProperty(authClient, 'updateUser', updateMock as typeof authClient.updateUser)

    try {
      const user = userEvent.setup()
      render(
        <I18nProvider>
          <MemoryRouter initialEntries={['/reset-password']}>
            <Routes>
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/login" element={<div>login page</div>} />
            </Routes>
          </MemoryRouter>
        </I18nProvider>,
      )

      await user.type(screen.getByLabelText(/new password|nova senha/i), 'novaSenha123')
      await user.click(screen.getByRole('button', { name: /reset password|redefinir senha/i }))

      await waitFor(() => expect(updateMock).toHaveBeenCalledWith({ password: 'novaSenha123' }))
      expect(await screen.findByText('login page')).toBeInTheDocument()
    } finally {
      restore()
    }
  })
})
