import { describe, it, expect, beforeEach, vi } from 'bun:test'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '@/components/theme-provider'
import { I18nProvider } from '@/i18n/provider'
import { i18n } from '@/i18n/config'
import api from '@/services/api'
import { authClient } from '@/lib/authClient'
import { replaceProperty } from '@/test/replace-property'
import LoginPage from './LoginPage'

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: false, user: null }),
}))

function renderPage() {
  return render(
    <MemoryRouter>
      <I18nProvider>
        <ThemeProvider>
          <LoginPage />
        </ThemeProvider>
      </I18nProvider>
    </MemoryRouter>,
  )
}

describe('LoginPage register form', () => {
  beforeEach(async () => {
    await act(async () => {
      await i18n.changeLanguage('en')
    })
  })

  it('keeps the submit button disabled until the terms checkbox is checked', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('tab', { name: 'Register' }))
    expect(screen.getByRole('button', { name: /Create/i })).toBeDisabled()

    await user.click(screen.getByRole('checkbox', { name: /I have read and accept/i }))
    expect(screen.getByRole('button', { name: /Create/i })).not.toBeDisabled()
  })

  it('sends signup and complete-signup through auth-js and API', async () => {
    const user = userEvent.setup()
    const signUpMock = vi.fn().mockResolvedValue({ data: { session: { access_token: 'token' } }, error: null })
    const restoreSignUp = replaceProperty(authClient, 'signUp', signUpMock as typeof authClient.signUp)
    const postMock = vi.fn().mockResolvedValue({ data: {} })
    const restore = replaceProperty(api, 'post', postMock as typeof api.post)

    try {
      renderPage()
      await user.click(screen.getByRole('tab', { name: 'Register' }))

      await user.type(screen.getByLabelText('Manager name'), 'Ana')
      await user.type(screen.getByLabelText('Establishment name'), 'Bar da Ana')
      await user.type(screen.getByLabelText('Email'), 'ana@example.com')
      await user.type(screen.getByLabelText('Password'), 'senha123')
      await user.click(screen.getByRole('checkbox', { name: /I have read and accept/i }))
      await user.click(screen.getByRole('button', { name: /Create/i }))

      expect(signUpMock).toHaveBeenCalledWith({ email: 'ana@example.com', password: 'senha123' })
      expect(postMock).toHaveBeenCalledWith('/auth/complete-signup', { tradeName: 'Bar da Ana', registrationKey: '' })
    } finally {
      restoreSignUp()
      restore()
    }
  })
})
