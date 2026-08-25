import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'bun:test'
import { MemoryRouter } from 'react-router-dom'

import { ConfirmProvider } from '@/contexts/ConfirmContext'
import { ThemeProvider } from '@/components/theme-provider'
import { I18nProvider } from '@/i18n/provider'
import { i18n } from '@/i18n/config'
import DashboardLayout from './DashboardLayout'

const mockLogout = vi.fn()

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    user: { name: 'Test user', establishment: { tradeName: 'Test establishment' } },
    logout: mockLogout,
  }),
}))

vi.mock('@/hooks/useRealtimeEvents', () => ({
  useRealtimeEvents: vi.fn(),
}))

vi.mock('@/services/api', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ headers: {}, data: [] }),
  },
}))

function renderLayout() {
  return render(
    <I18nProvider>
      <ThemeProvider>
        <ConfirmProvider>
          <MemoryRouter initialEntries={['/dashboard/orders']}>
            <DashboardLayout />
          </MemoryRouter>
        </ConfirmProvider>
      </ThemeProvider>
    </I18nProvider>,
  )
}

describe('DashboardLayout', () => {
  beforeEach(async () => {
    localStorage.clear()
    mockLogout.mockReset()
    await act(async () => {
      await i18n.changeLanguage('en')
    })
  })

  it('renders translated navigation and accessible collapse controls', async () => {
    const user = userEvent.setup()
    renderLayout()

    expect(screen.getByRole('link', { name: /Orders/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Sales/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Products/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Employees/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Reports/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Settings/ })).toBeInTheDocument()
    const toggle = screen.getByRole('button', { name: 'Collapse menu' })
    expect(toggle).toBeInTheDocument()
    await user.click(toggle)
    expect(screen.getByRole('button', { name: 'Expand menu' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Log out' }).length).toBeGreaterThanOrEqual(1)
  })

  it('labels the mobile drawer close control in the active locale', async () => {
    const user = userEvent.setup()
    renderLayout()

    await user.click(screen.getByRole('button', { name: 'Open menu' }))
    expect(screen.getByRole('button', { name: 'Close menu' })).toBeInTheDocument()
  })

  it('localizes the sidebar logout confirmation', async () => {
    const user = userEvent.setup()
    renderLayout()

    await user.click(screen.getByRole('button', { name: 'Sign out' }))

    expect(screen.getByRole('heading', { name: 'Log out?' })).toBeInTheDocument()
    expect(screen.getByText('Are you sure you want to log out?')).toBeInTheDocument()
  })
})
