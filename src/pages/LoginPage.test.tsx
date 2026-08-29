import { describe, it, expect, beforeEach, vi } from 'bun:test'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '@/components/theme-provider'
import { I18nProvider } from '@/i18n/provider'
import { i18n } from '@/i18n/config'
import api from '@/services/api'
import { replaceProperty } from '@/test/replace-property'
import LoginPage from './LoginPage'

const mockLogin = vi.fn()

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ login: mockLogin, isAuthenticated: false, user: null }),
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
    mockLogin.mockReset()
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

  it('sends termsAccepted: true in the register payload', async () => {
    const user = userEvent.setup()
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

      expect(postMock).toHaveBeenCalledWith(
        '/auth/register',
        expect.objectContaining({ termsAccepted: true }),
      )
    } finally {
      restore()
    }
  })
})
