import { createSignal } from 'solid-js'
import { Route } from '@solidjs/router'
import { screen, waitFor } from '@solidjs/testing-library'
import userEvent from '@testing-library/user-event'
import { toast } from 'solid-sonner'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { SessionBody } from '@/api/session'
import { i18n } from '@/i18n/config'
import { resetGoogleIdentity } from '@/lib/google-identity'
import { json, mockApi, problem } from '@/test/api'
import { renderPage } from '@/test/page'
import LoginPage from './LoginPage'

const mockUseAuth = vi.fn()
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

const me = (status: string) => ({
  id: 'u1', name: 'Ana', email: 'ana@example.com', emailVerified: true, phone: null, locale: 'en', role: 'OWNER',
  establishment: { id: 'e1', tradeName: 'Bar da Ana', status, plan: 'FREE', category: null, businessProfiles: null, visibleModules: null, preferencesRevision: 0 },
})
const session = (status = 'ACTIVE'): SessionBody =>
  ({ accessToken: 'token-1', accessTokenExpiresAt: '2026-10-01T18:15:00Z', user: me(status) }) as SessionBody

// A fake auth context whose session the page can open, like the real one.
function fakeAuth() {
  const [authenticated, setAuthenticated] = createSignal(false)
  const [user, setUser] = createSignal<unknown>(null)
  const establishSession = vi.fn((body: SessionBody) => {
    setUser(body.user)
    setAuthenticated(true)
  })
  mockUseAuth.mockReturnValue({
    isAuthenticated: authenticated,
    user,
    isLoading: () => false,
    establishSession,
    refreshUserProfile: vi.fn(),
    logout: vi.fn(),
  })
  return { establishSession }
}

function renderLogin(path = '/login') {
  return renderPage(path, () => (
    <>
      <Route path="/login" component={() => <LoginPage />} />
      <Route path="/register" component={() => <LoginPage initialTab="register" />} />
      <Route path="/dashboard" component={() => <div>Dashboard home</div>} />
      <Route path="/plan" component={() => <div>Plan selection</div>} />
    </>
  ))
}

const tab = (name: string) => screen.getByRole('tab', { name })

async function fillRegisterForm(
  user: ReturnType<typeof userEvent.setup>,
  fields: { name?: string; establishment?: string; email?: string; password?: string; key?: string } = {},
) {
  await user.click(tab('Register'))
  await user.type(screen.getByLabelText('Manager name'), fields.name ?? 'Ana')
  await user.type(screen.getByLabelText('Establishment name'), fields.establishment ?? 'Bar da Ana')
  await user.type(screen.getByLabelText('Email'), fields.email ?? 'ana@example.com')
  await user.type(screen.getByLabelText('Password'), fields.password ?? 'senha1234')
  if (fields.key !== undefined) {
    await user.click(screen.getByRole('checkbox', { name: /free access/i }))
    await user.type(screen.getByLabelText('Registration key'), fields.key)
  }
  await user.click(screen.getByRole('checkbox', { name: /I have read and accept/i }))
  await user.click(screen.getByRole('button', { name: /Create/i }))
}

let auth: ReturnType<typeof fakeAuth>

beforeEach(async () => {
  mockUseAuth.mockReset()
  auth = fakeAuth()
  resetGoogleIdentity()
  // GSI is always mocked (the real script never loads in tests). This one
  // never draws its button, so the stand-in stays, as when GSI is blocked.
  window.google = { accounts: { id: { initialize: vi.fn(), renderButton: vi.fn(), prompt: vi.fn() } } }
  await i18n.changeLanguage('en')
})

afterEach(() => {
  vi.unstubAllGlobals()
  delete window.google
})

describe('LoginPage register form', () => {
  it('keeps the submit button disabled until the terms checkbox is checked', async () => {
    const user = userEvent.setup()
    renderLogin()

    await user.click(tab('Register'))
    expect(screen.getByRole('button', { name: /Create/i })).toBeDisabled()

    await user.click(screen.getByRole('checkbox', { name: /I have read and accept/i }))
    expect(screen.getByRole('button', { name: /Create/i })).not.toBeDisabled()
  })

  it('links the privacy policy and the terms inside the checkbox label', async () => {
    const user = userEvent.setup()
    renderLogin()
    await user.click(tab('Register'))

    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacidade')
    expect(screen.getByRole('link', { name: 'Terms of Use' })).toHaveAttribute('href', '/termos')
  })

  it('signs up through POST /v1/auth/register and asks to confirm the email (the /v1 never opens a session here)', async () => {
    const user = userEvent.setup()
    const toastSuccess = vi.spyOn(toast, 'success').mockImplementation(() => '')
    const api = mockApi(({ path }) => (path === '/v1/auth/register' ? json(202, {}) : undefined))
    renderLogin()

    await fillRegisterForm(user)

    await waitFor(() => expect(api.to('/v1/auth/register')).toHaveLength(1))
    expect(api.to('/v1/auth/register')[0].body).toEqual({
      email: 'ana@example.com',
      password: 'senha1234',
      name: 'Ana',
      tradeName: 'Bar da Ana',
      termsAccepted: true,
      locale: 'en',
      client: 'web',
    })
    expect(await screen.findByText('Confirm your email')).toBeInTheDocument()
    expect(screen.getByText(/We sent a confirmation link to ana@example\.com/)).toBeInTheDocument()
    expect(toastSuccess).toHaveBeenCalledWith('Account created! We sent a confirmation link to ana@example.com.')
    expect(tab('Login')).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByLabelText('Email')).toHaveValue('ana@example.com')
    expect(screen.getByRole('button', { name: /Resend in \d+s/ })).toBeDisabled()
    expect(auth.establishSession).not.toHaveBeenCalled()
  })

  it('validates the registration key before signing up and sends it with the account', async () => {
    const user = userEvent.setup()
    const api = mockApi(({ path }) => {
      if (path === '/v1/auth/registration-key/validate') return json(200, { valid: true })
      if (path === '/v1/auth/register') return json(202, {})
      return undefined
    })
    renderLogin()

    await fillRegisterForm(user, { key: ' chave-secreta ' })

    await waitFor(() => expect(api.to('/v1/auth/register')).toHaveLength(1))
    expect(api.to('/v1/auth/registration-key/validate')[0].body).toEqual({ registrationKey: 'chave-secreta' })
    expect(api.calls.map((call) => call.path)).toEqual(['/v1/auth/registration-key/validate', '/v1/auth/register'])
    expect(api.to('/v1/auth/register')[0].body).toMatchObject({ registrationKey: 'chave-secreta', tradeName: 'Bar da Ana' })
  })

  it('blocks the signup when the registration key is wrong (it used to silently become a Free account)', async () => {
    const user = userEvent.setup()
    const toastError = vi.spyOn(toast, 'error').mockImplementation(() => '')
    const api = mockApi(({ path }) => (path === '/v1/auth/registration-key/validate' ? json(200, { valid: false }) : undefined))
    renderLogin()

    await fillRegisterForm(user, { key: 'chave-errada' })

    await waitFor(() => expect(toastError).toHaveBeenCalledWith(
      'Invalid registration key. Check the key or uncheck the option to create a Free account.',
    ))
    expect(api.to('/v1/auth/register')).toHaveLength(0)
    expect(tab('Register')).toHaveAttribute('aria-selected', 'true')
  })

  it('rejects whitespace-only required fields and normalizes the email', async () => {
    const user = userEvent.setup()
    const toastError = vi.spyOn(toast, 'error').mockImplementation(() => '')
    const api = mockApi(({ path }) => (path === '/v1/auth/register' ? json(202, {}) : undefined))
    renderLogin()

    await fillRegisterForm(user, { establishment: '   ' })
    expect(toastError).toHaveBeenCalledWith('Fill in all required fields.')
    expect(api.calls).toHaveLength(0)

    await user.clear(screen.getByLabelText('Establishment name'))
    await user.type(screen.getByLabelText('Establishment name'), '  Bar da Ana  ')
    await user.clear(screen.getByLabelText('Email'))
    await user.type(screen.getByLabelText('Email'), '  Ana@Example.COM ')
    await user.click(screen.getByRole('button', { name: /Create/i }))

    await waitFor(() => expect(api.to('/v1/auth/register')).toHaveLength(1))
    expect(api.to('/v1/auth/register')[0].body).toMatchObject({ email: 'ana@example.com', tradeName: 'Bar da Ana' })
  })

  it('refuses a password shorter than the /v1 minimum (8) without calling the API', async () => {
    const user = userEvent.setup()
    const api = mockApi(() => undefined)
    renderLogin()

    await fillRegisterForm(user, { password: 'senha12' })

    // The browser's minlength stops the submit; the handler checks it again.
    expect(api.calls).toHaveLength(0)
    expect(screen.getByLabelText('Password')).toHaveAttribute('minlength', '8')
    expect(screen.getByText('At least 8 characters.')).toBeInTheDocument()
  })

  it('shows a rate-limit message instead of the generic failure on 429 RATE_LIMITED', async () => {
    const user = userEvent.setup()
    const toastError = vi.spyOn(toast, 'error').mockImplementation(() => '')
    mockApi(({ path }) => (path === '/v1/auth/register' ? problem(429, 'RATE_LIMITED') : undefined))
    renderLogin()

    await fillRegisterForm(user)

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Too many attempts in a row. Wait a minute and try again.'))
  })

  it('opens the registration tab when requested by the URL', () => {
    renderLogin('/login?tab=register')

    expect(tab('Register')).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Create account')).toBeInTheDocument()
  })

  it('/register opens the same page on the registration tab', () => {
    renderLogin('/register')

    expect(tab('Register')).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Create account')).toBeInTheDocument()
  })
})

describe('LoginPage login form', () => {
  it('signs in through POST /v1/auth/login with the cookie and goes to the dashboard', async () => {
    const user = userEvent.setup()
    const api = mockApi(({ path }) => (path === '/v1/auth/login' ? json(200, session('ACTIVE')) : undefined))
    renderLogin()

    await user.type(screen.getByLabelText('Email'), ' Ana@Example.com ')
    await user.type(screen.getByLabelText('Password'), 'senha1234')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('Dashboard home')).toBeInTheDocument()
    const [login] = api.to('/v1/auth/login')
    expect(login.body).toEqual({ email: 'ana@example.com', password: 'senha1234', client: 'web' })
    expect(login.credentials).toBe('include')
    expect(auth.establishSession).toHaveBeenCalledWith(session('ACTIVE'))
  })

  it('sends an establishment that is not active to plan selection', async () => {
    const user = userEvent.setup()
    mockApi(({ path }) => (path === '/v1/auth/login' ? json(200, session('PENDING_PAYMENT')) : undefined))
    renderLogin()

    await user.type(screen.getByLabelText('Email'), 'ana@example.com')
    await user.type(screen.getByLabelText('Password'), 'senha1234')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('Plan selection')).toBeInTheDocument()
  })

  it('explains wrong credentials and keeps the user on the form', async () => {
    const user = userEvent.setup()
    const toastError = vi.spyOn(toast, 'error').mockImplementation(() => '')
    mockApi(({ path }) => (path === '/v1/auth/login' ? problem(401, 'INVALID_CREDENTIALS') : undefined))
    renderLogin()

    await user.type(screen.getByLabelText('Email'), 'ana@example.com')
    await user.type(screen.getByLabelText('Password'), 'errada123')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() => expect(toastError).toHaveBeenCalledWith(
      'Incorrect email or password. If you signed up with Google, use "Sign in with Google" — or set a password via "Forgot my password".',
    ))
    expect(auth.establishSession).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Sign in' })).not.toBeDisabled()
    expect(screen.getByLabelText('Password')).toHaveValue('errada123')
  })

  it('offers to resend the confirmation when login is blocked by an unconfirmed email', async () => {
    const user = userEvent.setup()
    const toastError = vi.spyOn(toast, 'error').mockImplementation(() => '')
    const toastSuccess = vi.spyOn(toast, 'success').mockImplementation(() => '')
    const api = mockApi(({ path }) => {
      if (path === '/v1/auth/login') return problem(403, 'EMAIL_NOT_VERIFIED')
      if (path === '/v1/auth/resend-verification') return json(202, {})
      return undefined
    })
    renderLogin()

    await user.type(screen.getByLabelText('Email'), 'ana@example.com')
    await user.type(screen.getByLabelText('Password'), 'senha1234')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() => expect(toastError).toHaveBeenCalledWith(
      "Your email hasn't been confirmed yet. Click the link we sent or resend it below.",
    ))
    expect(screen.getByText('Confirm your email')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Resend confirmation email' }))

    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('We sent a new confirmation link to ana@example.com.'))
    expect(api.to('/v1/auth/resend-verification')[0].body).toEqual({ email: 'ana@example.com' })
    expect(screen.getByRole('button', { name: /Resend in \d+s/ })).toBeDisabled()
  })

  it('links to the forgot password page', () => {
    renderLogin()
    expect(screen.getByRole('link', { name: 'Forgot my password' })).toHaveAttribute('href', '/forgot-password')
  })

  it('keeps the React button in place until GSI draws its own, and it opens the GSI prompt', async () => {
    const user = userEvent.setup()
    renderLogin()

    await user.click(screen.getByRole('button', { name: 'Sign in with Google' }))

    expect(window.google!.accounts!.id!.prompt).toHaveBeenCalled()
  })
})

describe('LoginPage Google Sign-In', () => {
  // GSI is mocked: the real script never loads in tests.
  function mockGsi() {
    let callback: ((response: { credential: string }) => void) | undefined
    const gsi = {
      initialize: vi.fn((config: { callback: (response: { credential: string }) => void }) => { callback = config.callback }),
      renderButton: vi.fn((parent: HTMLElement) => {
        const button = document.createElement('div')
        button.setAttribute('role', 'button')
        button.textContent = 'Google button'
        parent.appendChild(button)
      }),
      prompt: vi.fn(),
    }
    window.google = { accounts: { id: gsi } }
    return { gsi, signIn: (credential: string) => callback!({ credential }) }
  }

  it('renders the GSI button and signs in with the ID token through POST /v1/auth/google', async () => {
    const { gsi, signIn } = mockGsi()
    const api = mockApi(({ path }) => (path === '/v1/auth/google' ? json(200, session('ACTIVE')) : undefined))
    renderLogin()

    expect(await screen.findByText('Google button')).toBeInTheDocument()
    expect(gsi.initialize).toHaveBeenCalledWith(expect.objectContaining({
      client_id: '344765290986-k2pdrbu5g90hi2b2bpr84olbe3q8nrak.apps.googleusercontent.com',
    }))
    expect(gsi.renderButton).toHaveBeenCalledWith(expect.any(HTMLElement), expect.objectContaining({ text: 'signin_with', locale: 'en' }))
    expect(document.querySelector('script[src*="accounts.google.com"]')).toBeNull()

    signIn('google-id-token')

    expect(await screen.findByText('Dashboard home')).toBeInTheDocument()
    const [google] = api.to('/v1/auth/google')
    expect(google.body).toEqual({ idToken: 'google-id-token', client: 'web', locale: 'en' })
    expect(google.credentials).toBe('include')
  })

  it('on the register tab, sends the terms acceptance and the form data along with the ID token', async () => {
    const user = userEvent.setup()
    const { signIn } = mockGsi()
    const api = mockApi(({ path }) => (path === '/v1/auth/google' ? json(201, session('ACTIVE')) : undefined))
    renderLogin()

    await user.click(tab('Register'))
    await user.type(screen.getByLabelText('Establishment name'), 'Bar da Ana')
    await user.click(screen.getByRole('checkbox', { name: /I have read and accept/i }))
    await screen.findByText('Google button')
    signIn('google-id-token')

    await waitFor(() => expect(api.to('/v1/auth/google')).toHaveLength(1))
    expect(api.to('/v1/auth/google')[0].body).toEqual({
      idToken: 'google-id-token', client: 'web', locale: 'en', termsAccepted: true, tradeName: 'Bar da Ana',
    })
  })

  it('shows the error when the API refuses the Google token', async () => {
    const toastError = vi.spyOn(toast, 'error').mockImplementation(() => '')
    const { signIn } = mockGsi()
    mockApi(({ path }) => (path === '/v1/auth/google' ? problem(401, 'GOOGLE_TOKEN_INVALID') : undefined))
    renderLogin()

    await screen.findByText('Google button')
    signIn('bad-token')

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Login failed. Check your credentials.'))
    expect(auth.establishSession).not.toHaveBeenCalled()
  })

  it('on the register tab, validates the registration key before sending it with the ID token', async () => {
    const user = userEvent.setup()
    const { signIn } = mockGsi()
    const api = mockApi(({ path }) => {
      if (path === '/v1/auth/registration-key/validate') return json(200, { valid: true })
      if (path === '/v1/auth/google') return json(201, session('ACTIVE'))
      return undefined
    })
    renderLogin()

    await user.click(tab('Register'))
    await user.click(screen.getByRole('checkbox', { name: /free access/i }))
    await user.type(screen.getByLabelText('Registration key'), ' chave-secreta ')
    await screen.findByText('Google button')
    signIn('google-id-token')

    await waitFor(() => expect(api.to('/v1/auth/google')).toHaveLength(1))
    expect(api.calls.map((call) => call.path)).toEqual(['/v1/auth/registration-key/validate', '/v1/auth/google'])
    expect(api.to('/v1/auth/registration-key/validate')[0].body).toEqual({ registrationKey: 'chave-secreta' })
    expect(api.to('/v1/auth/google')[0].body).toMatchObject({ registrationKey: 'chave-secreta' })
  })

  it('on the register tab, a wrong registration key stops the Google sign-up', async () => {
    const user = userEvent.setup()
    const toastError = vi.spyOn(toast, 'error').mockImplementation(() => '')
    const { signIn } = mockGsi()
    const api = mockApi(({ path }) => (path === '/v1/auth/registration-key/validate' ? json(200, { valid: false }) : undefined))
    renderLogin()

    await user.click(tab('Register'))
    await user.click(screen.getByRole('checkbox', { name: /free access/i }))
    await user.type(screen.getByLabelText('Registration key'), 'chave-errada')
    await screen.findByText('Google button')
    signIn('google-id-token')

    await waitFor(() => expect(toastError).toHaveBeenCalledWith(
      'Invalid registration key. Check the key or uncheck the option to create a Free account.',
    ))
    expect(api.to('/v1/auth/google')).toHaveLength(0)
    expect(auth.establishSession).not.toHaveBeenCalled()
  })

  it('a second credential while the first is in flight does not post twice', async () => {
    const { signIn } = mockGsi()
    let answer!: (response: Response) => void
    const api = mockApi(({ path }) => (path === '/v1/auth/google' ? new Promise<Response>((resolve) => { answer = resolve }) : undefined))
    renderLogin()

    await screen.findByText('Google button')
    signIn('google-id-token')
    await waitFor(() => expect(api.to('/v1/auth/google')).toHaveLength(1))
    signIn('google-id-token')
    answer(json(200, session('ACTIVE')))

    expect(await screen.findByText('Dashboard home')).toBeInTheDocument()
    expect(api.to('/v1/auth/google')).toHaveLength(1)
  })
})
