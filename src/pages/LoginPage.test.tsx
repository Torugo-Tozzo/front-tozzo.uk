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
      expect(postMock).toHaveBeenCalledWith('/auth/complete-signup', {
        name: 'Ana',
        termsAccepted: true,
        tradeName: 'Bar da Ana',
        registrationKey: '',
      })
    } finally {
      restoreSignUp()
      restore()
    }
  })

  it('treats a signup awaiting email confirmation as successful without completing it', async () => {
    const user = userEvent.setup()
    const signUpMock = vi.fn().mockResolvedValue({ data: { session: null }, error: null })
    const restoreSignUp = replaceProperty(authClient, 'signUp', signUpMock as typeof authClient.signUp)
    const postMock = vi.fn()
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

      expect(postMock).not.toHaveBeenCalled()
    } finally {
      restoreSignUp()
      restore()
    }
  })
})

describe('LoginPage login form — 2FA', () => {
  beforeEach(async () => {
    await act(async () => {
      await i18n.changeLanguage('en')
    })
  })

  it('logs in directly when the account has no MFA factor (nextLevel stays aal1)', async () => {
    const user = userEvent.setup()
    const signInMock = vi.fn().mockResolvedValue({ data: { session: { access_token: 'tok' } }, error: null })
    const restoreSignIn = replaceProperty(authClient, 'signInWithPassword', signInMock as typeof authClient.signInWithPassword)
    const aalMock = vi.fn().mockResolvedValue({ data: { currentLevel: 'aal1', nextLevel: 'aal1' }, error: null })
    const restoreAal = replaceProperty(authClient.mfa, 'getAuthenticatorAssuranceLevel', aalMock as typeof authClient.mfa.getAuthenticatorAssuranceLevel)

    try {
      renderPage()
      await user.type(screen.getByLabelText('Email'), 'ana@example.com')
      await user.type(screen.getByLabelText('Password'), 'senha123')
      await user.click(screen.getByRole('button', { name: /Sign in/i }))

      expect(signInMock).toHaveBeenCalledWith({ email: 'ana@example.com', password: 'senha123' })
      expect(aalMock).toHaveBeenCalled()
      expect(screen.queryByLabelText(/authentication code/i)).not.toBeInTheDocument()
    } finally {
      restoreSignIn()
      restoreAal()
    }
  })

  it('shows the TOTP prompt and challenges the factor when nextLevel requires aal2', async () => {
    const user = userEvent.setup()
    const signInMock = vi.fn().mockResolvedValue({ data: { session: { access_token: 'tok' } }, error: null })
    const restoreSignIn = replaceProperty(authClient, 'signInWithPassword', signInMock as typeof authClient.signInWithPassword)
    const aalMock = vi.fn().mockResolvedValue({ data: { currentLevel: 'aal1', nextLevel: 'aal2' }, error: null })
    const restoreAal = replaceProperty(authClient.mfa, 'getAuthenticatorAssuranceLevel', aalMock as typeof authClient.mfa.getAuthenticatorAssuranceLevel)
    const listFactorsMock = vi.fn().mockResolvedValue({ data: { totp: [{ id: 'factor-1' }] }, error: null })
    const restoreListFactors = replaceProperty(authClient.mfa, 'listFactors', listFactorsMock as typeof authClient.mfa.listFactors)
    const challengeMock = vi.fn().mockResolvedValue({ data: { id: 'challenge-1' }, error: null })
    const restoreChallenge = replaceProperty(authClient.mfa, 'challenge', challengeMock as typeof authClient.mfa.challenge)
    const verifyMock = vi.fn().mockResolvedValue({ data: {}, error: null })
    const restoreVerify = replaceProperty(authClient.mfa, 'verify', verifyMock as typeof authClient.mfa.verify)

    try {
      renderPage()
      await user.type(screen.getByLabelText('Email'), 'ana@example.com')
      await user.type(screen.getByLabelText('Password'), 'senha123')
      await user.click(screen.getByRole('button', { name: /Sign in/i }))

      expect(challengeMock).toHaveBeenCalledWith({ factorId: 'factor-1' })
      const codeInput = await screen.findByLabelText(/authentication code/i)

      await user.type(codeInput, '654321')
      await user.click(screen.getByRole('button', { name: /Confirm/i }))

      expect(verifyMock).toHaveBeenCalledWith({ factorId: 'factor-1', challengeId: 'challenge-1', code: '654321' })
    } finally {
      restoreSignIn()
      restoreAal()
      restoreListFactors()
      restoreChallenge()
      restoreVerify()
    }
  })
})
