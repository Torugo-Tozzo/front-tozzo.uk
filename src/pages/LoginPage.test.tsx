import { describe, it, expect, beforeEach, vi } from 'bun:test'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { toast } from 'sonner'
import { ThemeProvider } from '@/components/theme-provider'
import { I18nProvider } from '@/i18n/provider'
import { i18n } from '@/i18n/config'
import api from '@/services/api'
import { authClient } from '@/lib/authClient'
import { replaceProperty } from '@/test/replace-property'
import LoginPage from './LoginPage'

const mockRefreshUserProfile = vi.fn()
const mockUseAuth = vi.fn()

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

function DashboardHome() { return <div>Dashboard home</div> }
function PlanSelection() { return <div>Plan selection</div> }

function renderPage(path = '/login') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <I18nProvider>
        <ThemeProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/dashboard" element={<DashboardHome />} />
            <Route path="/plan" element={<PlanSelection />} />
          </Routes>
        </ThemeProvider>
      </I18nProvider>
    </MemoryRouter>,
  )
}

describe('LoginPage register form', () => {
  beforeEach(async () => {
    mockRefreshUserProfile.mockReset()
    mockUseAuth.mockReset()
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      user: null,
      isLoading: false,
      refreshUserProfile: mockRefreshUserProfile,
      logout: vi.fn(),
    })
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

      expect(signUpMock).toHaveBeenCalledWith({
        email: 'ana@example.com',
        password: 'senha123',
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
          data: { name: 'Ana', tradeName: 'Bar da Ana', termsAccepted: true },
        },
      })
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
    const signUpMock = vi.fn().mockResolvedValue({ data: { session: null, user: { identities: [{ id: '1' }] } }, error: null })
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
      // Antes caía num navigate('/login') silencioso (já estava no /login) — o
      // usuário clicava de novo e tomava 429 do GoTrue.
      expect(await screen.findByText('Confirm your email')).toBeInTheDocument()
      expect(screen.getByText(/We sent a confirmation link to ana@example\.com/)).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: 'Login' }).getAttribute('data-state')).toBe('active')
      expect(screen.getByLabelText('Email')).toHaveValue('ana@example.com')
      expect(screen.getByRole('button', { name: /Resend in \d+s/ })).toBeDisabled()
    } finally {
      restoreSignUp()
      restore()
    }
  })

  async function fillRegisterForm(
    user: ReturnType<typeof userEvent.setup>,
    fields: { name?: string; establishment?: string; email?: string; password?: string; key?: string } = {},
  ) {
    await user.click(screen.getByRole('tab', { name: 'Register' }))
    await user.type(screen.getByLabelText('Manager name'), fields.name ?? 'Ana')
    await user.type(screen.getByLabelText('Establishment name'), fields.establishment ?? 'Bar da Ana')
    await user.type(screen.getByLabelText('Email'), fields.email ?? 'ana@example.com')
    await user.type(screen.getByLabelText('Password'), fields.password ?? 'senha123')
    if (fields.key !== undefined) {
      await user.click(screen.getByRole('checkbox', { name: /free access/i }))
      await user.type(screen.getByLabelText('Registration key'), fields.key)
    }
    await user.click(screen.getByRole('checkbox', { name: /I have read and accept/i }))
    await user.click(screen.getByRole('button', { name: /Create/i }))
  }

  it('validates the registration key before signup and stores it in the metadata so it survives email confirmation', async () => {
    const user = userEvent.setup()
    const signUpMock = vi.fn().mockResolvedValue({ data: { session: null, user: { identities: [{ id: '1' }] } }, error: null })
    const restoreSignUp = replaceProperty(authClient, 'signUp', signUpMock as typeof authClient.signUp)
    const postMock = vi.fn().mockResolvedValue({ data: { valid: true } })
    const restorePost = replaceProperty(api, 'post', postMock as typeof api.post)

    try {
      renderPage()
      await fillRegisterForm(user, { key: ' chave-secreta ' })

      expect(postMock).toHaveBeenCalledWith('/auth/registration-key/validate', { registrationKey: 'chave-secreta' })
      expect(signUpMock).toHaveBeenCalledWith(expect.objectContaining({
        options: expect.objectContaining({
          data: { name: 'Ana', tradeName: 'Bar da Ana', termsAccepted: true, registrationKey: 'chave-secreta' },
        }),
      }))
    } finally {
      restoreSignUp()
      restorePost()
    }
  })

  it('blocks the signup when the registration key is wrong (it used to silently become a Free account)', async () => {
    const user = userEvent.setup()
    const signUpMock = vi.fn()
    const restoreSignUp = replaceProperty(authClient, 'signUp', signUpMock as typeof authClient.signUp)
    const postMock = vi.fn().mockResolvedValue({ data: { valid: false } })
    const restorePost = replaceProperty(api, 'post', postMock as typeof api.post)
    const toastError = vi.spyOn(toast, 'error').mockImplementation(() => '')

    try {
      renderPage()
      await fillRegisterForm(user, { key: 'chave-errada' })

      await waitFor(() => expect(toastError).toHaveBeenCalledWith(
        'Invalid registration key. Check the key or uncheck the option to create a Free account.',
      ))
      expect(signUpMock).not.toHaveBeenCalled()
      expect(screen.getByRole('tab', { name: 'Register' }).getAttribute('data-state')).toBe('active')
    } finally {
      restoreSignUp()
      restorePost()
      toastError.mockRestore()
    }
  })

  it('tells the user the email already has an account when GoTrue answers a repeated signup (identities: [])', async () => {
    // GoTrue responde 200 sem mandar email (anti-enumeração) — antes a tela
    // dizia "Conta criada! Enviamos um link", e o email nunca chegava.
    const user = userEvent.setup()
    const signUpMock = vi.fn().mockResolvedValue({ data: { session: null, user: { id: 'fake', identities: [] } }, error: null })
    const restoreSignUp = replaceProperty(authClient, 'signUp', signUpMock as typeof authClient.signUp)
    const toastError = vi.spyOn(toast, 'error').mockImplementation(() => '')
    const toastSuccess = vi.spyOn(toast, 'success').mockImplementation(() => '')

    try {
      renderPage()
      await fillRegisterForm(user)

      expect(await screen.findByText('This email already has an account')).toBeInTheDocument()
      expect(screen.getByText(/There is already an account for ana@example\.com/)).toBeInTheDocument()
      expect(screen.queryByText('Confirm your email')).not.toBeInTheDocument()
      expect(toastSuccess).not.toHaveBeenCalled()
      expect(toastError).toHaveBeenCalledWith('This email is already registered. Sign in or reset your password.')
      expect(screen.getByRole('tab', { name: 'Login' }).getAttribute('data-state')).toBe('active')
      expect(screen.getByLabelText('Email')).toHaveValue('ana@example.com')
    } finally {
      restoreSignUp()
      toastError.mockRestore()
      toastSuccess.mockRestore()
    }
  })

  it('rejects whitespace-only required fields and normalizes the email', async () => {
    const user = userEvent.setup()
    const signUpMock = vi.fn().mockResolvedValue({ data: { session: null, user: { identities: [{ id: '1' }] } }, error: null })
    const restoreSignUp = replaceProperty(authClient, 'signUp', signUpMock as typeof authClient.signUp)
    const toastError = vi.spyOn(toast, 'error').mockImplementation(() => '')

    try {
      renderPage()
      await fillRegisterForm(user, { establishment: '   ' })
      expect(toastError).toHaveBeenCalledWith('Fill in all required fields.')
      expect(signUpMock).not.toHaveBeenCalled()

      await user.clear(screen.getByLabelText('Establishment name'))
      await user.type(screen.getByLabelText('Establishment name'), '  Bar da Ana  ')
      await user.clear(screen.getByLabelText('Email'))
      await user.type(screen.getByLabelText('Email'), '  Ana@Example.COM ')
      await user.click(screen.getByRole('button', { name: /Create/i }))

      expect(signUpMock).toHaveBeenCalledWith(expect.objectContaining({
        email: 'ana@example.com',
        options: expect.objectContaining({ data: expect.objectContaining({ tradeName: 'Bar da Ana' }) }),
      }))
    } finally {
      restoreSignUp()
      toastError.mockRestore()
    }
  })

  it('shows a rate-limit message instead of the generic failure when GoTrue answers 429', async () => {
    const user = userEvent.setup()
    const signUpMock = vi.fn().mockResolvedValue({ data: { session: null, user: null }, error: { code: 'over_email_send_rate_limit' } })
    const restoreSignUp = replaceProperty(authClient, 'signUp', signUpMock as typeof authClient.signUp)
    const toastError = vi.spyOn(toast, 'error').mockImplementation(() => '')

    try {
      renderPage()
      await user.click(screen.getByRole('tab', { name: 'Register' }))
      await user.type(screen.getByLabelText('Manager name'), 'Ana')
      await user.type(screen.getByLabelText('Establishment name'), 'Bar da Ana')
      await user.type(screen.getByLabelText('Email'), 'ana@example.com')
      await user.type(screen.getByLabelText('Password'), 'senha123')
      await user.click(screen.getByRole('checkbox', { name: /I have read and accept/i }))
      await user.click(screen.getByRole('button', { name: /Create/i }))

      await waitFor(() => expect(toastError).toHaveBeenCalledWith('Too many attempts in a row. Wait a minute and try again.'))
    } finally {
      restoreSignUp()
      toastError.mockRestore()
    }
  })

  it('offers to resend the confirmation when login is blocked by an unconfirmed email', async () => {
    const user = userEvent.setup()
    const signInMock = vi.fn().mockResolvedValue({ data: { session: null, user: null }, error: { code: 'email_not_confirmed' } })
    const restoreSignIn = replaceProperty(authClient, 'signInWithPassword', signInMock as typeof authClient.signInWithPassword)
    const resendMock = vi.fn().mockResolvedValue({ data: {}, error: null })
    const restoreResend = replaceProperty(authClient, 'resend', resendMock as typeof authClient.resend)
    const toastError = vi.spyOn(toast, 'error').mockImplementation(() => '')
    const toastSuccess = vi.spyOn(toast, 'success').mockImplementation(() => '')

    try {
      renderPage()
      await user.type(screen.getByLabelText('Email'), 'ana@example.com')
      await user.type(screen.getByLabelText('Password'), 'senha123')
      await user.click(screen.getByRole('button', { name: 'Sign in' }))

      await waitFor(() => expect(toastError).toHaveBeenCalledWith(
        "Your email hasn't been confirmed yet. Click the link we sent or resend it below.",
      ))
      expect(screen.getByText('Confirm your email')).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Resend confirmation email' }))

      expect(resendMock).toHaveBeenCalledWith({
        type: 'signup',
        email: 'ana@example.com',
        options: { emailRedirectTo: `${window.location.origin}/login` },
      })
      expect(toastSuccess).toHaveBeenCalledWith('We sent a new confirmation link to ana@example.com.')
      expect(screen.getByRole('button', { name: /Resend in \d+s/ })).toBeDisabled()
    } finally {
      restoreSignIn()
      restoreResend()
      toastError.mockRestore()
      toastSuccess.mockRestore()
    }
  })

  it('opens the registration tab when requested by the URL', () => {
    renderPage('/login?tab=register')

    expect(screen.getByRole('tab', { name: 'Register' }).getAttribute('data-state')).toBe('active')
    expect(screen.getByText('Create account')).toBeInTheDocument()
  })

  it('goes straight to the dashboard after registering without an invite key (Free plan is active on signup)', async () => {
    // Regressão: handleRegister mandava explicitamente pra /plan sempre que
    // não tinha registrationKey, mesmo com a conta já ACTIVE no plano Free
    // (o backend nunca mais cria PENDING_PAYMENT sem chave — ver
    // auth.controller.ts). Achado durante QA visual: usuário criou conta e
    // caiu na tela de escolha de plano sem precisar.
    const user = userEvent.setup()
    const signUpMock = vi.fn().mockResolvedValue({ data: { session: { access_token: 'token' } }, error: null })
    const restoreSignUp = replaceProperty(authClient, 'signUp', signUpMock as typeof authClient.signUp)
    const postMock = vi.fn().mockResolvedValue({ data: {} })
    const restore = replaceProperty(api, 'post', postMock as typeof api.post)
    mockRefreshUserProfile.mockImplementation(async () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        user: { establishment: { status: 'ACTIVE', plan: 'FREE' } },
        isLoading: false,
        refreshUserProfile: mockRefreshUserProfile,
        logout: vi.fn(),
      })
    })

    try {
      renderPage()
      await user.click(screen.getByRole('tab', { name: 'Register' }))
      await user.type(screen.getByLabelText('Manager name'), 'Ana')
      await user.type(screen.getByLabelText('Establishment name'), 'Bar da Ana')
      await user.type(screen.getByLabelText('Email'), 'ana@example.com')
      await user.type(screen.getByLabelText('Password'), 'senha123')
      await user.click(screen.getByRole('checkbox', { name: /I have read and accept/i }))
      await user.click(screen.getByRole('button', { name: /Create/i }))

      await waitFor(() => expect(screen.getByText('Dashboard home')).toBeInTheDocument())
      expect(screen.queryByText('Plan selection')).not.toBeInTheDocument()
    } finally {
      restoreSignUp()
      restore()
    }
  })
})

describe('LoginPage login form — 2FA', () => {
  beforeEach(async () => {
    mockRefreshUserProfile.mockReset()
    mockUseAuth.mockReset()
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      user: null,
      isLoading: false,
      refreshUserProfile: mockRefreshUserProfile,
      logout: vi.fn(),
    })
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
      await user.click(screen.getByRole('button', { name: 'Sign in' }))

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
      await user.click(screen.getByRole('button', { name: 'Sign in' }))

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

describe('LoginPage Google Sign-In', () => {
  beforeEach(() => {
    mockUseAuth.mockReset()
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      user: null,
      isLoading: false,
      refreshUserProfile: mockRefreshUserProfile,
      logout: vi.fn(),
    })
  })

  it('sends the user back to /login after Google auth, not the bare index (GoTrue defaults to SITE_URL, which has no post-login redirect logic)', async () => {
    const user = userEvent.setup()
    const signInWithOAuthMock = vi.fn().mockResolvedValue({ data: {}, error: null })
    const restore = replaceProperty(authClient, 'signInWithOAuth', signInWithOAuthMock as typeof authClient.signInWithOAuth)

    try {
      renderPage()
      await user.click(screen.getByRole('button', { name: /Sign in with Google/i }))

      expect(signInWithOAuthMock).toHaveBeenCalledWith({
        provider: 'google',
        options: { redirectTo: expect.stringContaining('/login') },
      })
    } finally {
      restore()
    }
  })
})
