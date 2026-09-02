import { describe, it, expect, beforeEach, vi } from 'bun:test'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ThemeProvider } from '@/components/theme-provider'
import { I18nProvider } from '@/i18n/provider'
import { i18n } from '@/i18n/config'
import api from '@/services/api'
import { replaceProperty } from '@/test/replace-property'
import LoginPage from './LoginPage'

const mockLogin = vi.fn()
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
    mockLogin.mockReset()
    mockUseAuth.mockReset()
    mockUseAuth.mockReturnValue({ login: mockLogin, isAuthenticated: false, user: null })
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
    const postMock = vi.fn().mockResolvedValue({ data: { token: 'tok-123' } })
    const restore = replaceProperty(api, 'post', postMock as typeof api.post)
    mockLogin.mockImplementation(async () => {
      mockUseAuth.mockReturnValue({
        login: mockLogin,
        isAuthenticated: true,
        user: { establishment: { status: 'ACTIVE', plan: 'FREE' } },
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
      restore()
    }
  })
})
