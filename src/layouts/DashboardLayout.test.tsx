import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'bun:test'
import { MemoryRouter } from 'react-router-dom'

import { ConfirmProvider } from '@/contexts/ConfirmContext'
import { ThemeProvider } from '@/components/theme-provider'
import { I18nProvider } from '@/i18n/provider'
import { i18n } from '@/i18n/config'
import api from '@/services/api'
import { replaceProperty } from '@/test/replace-property'
import DashboardLayout from './DashboardLayout'

const mockLogout = vi.fn()
let mockUser: { name: string; role: string; establishment: { tradeName: string; category?: string } } = { name: 'Test user', role: 'MANAGER', establishment: { tradeName: 'Test establishment' } }

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    user: mockUser,
    logout: mockLogout,
  }),
}))

vi.mock('@/hooks/useRealtimeEvents', () => ({
  useRealtimeEvents: vi.fn(),
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
  let restoreGet: (() => void) | undefined

  beforeEach(async () => {
    localStorage.clear()
    mockLogout.mockReset()
    mockUser = { name: 'Test user', role: 'MANAGER', establishment: { tradeName: 'Test establishment' } }
    restoreGet = replaceProperty(api, 'get', vi.fn().mockResolvedValue({ headers: {}, data: [] }) as typeof api.get)
    await act(async () => {
      await i18n.changeLanguage('en')
    })
  })

  afterEach(() => {
    restoreGet?.()
    restoreGet = undefined
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

  it('hides the Reports link from employees while keeping it visible to managers', () => {
    mockUser = { name: 'Employee user', role: 'EMPLOYEE', establishment: { tradeName: 'Test establishment' } }
    const { unmount } = renderLayout()

    expect(screen.queryByRole('link', { name: /Reports/ })).not.toBeInTheDocument()

    unmount()
    mockUser = { name: 'Manager user', role: 'MANAGER', establishment: { tradeName: 'Test establishment' } }
    renderLayout()

    expect(screen.getByRole('link', { name: /Reports/ })).toBeInTheDocument()
  })

  it('keeps the Reports link visible to owners', () => {
    mockUser = { name: 'Owner user', role: 'OWNER', establishment: { tradeName: 'Test establishment', category: 'HAMBURGUERIA' } }
    renderLayout()

    expect(screen.getByRole('link', { name: /Reports/ })).toBeInTheDocument()
  })

  it('localizes the sidebar logout confirmation', async () => {
    const user = userEvent.setup()
    renderLayout()

    await user.click(screen.getByRole('button', { name: 'Sign out' }))

    expect(screen.getByRole('heading', { name: 'Log out?' })).toBeInTheDocument()
    expect(screen.getByText('Are you sure you want to log out?')).toBeInTheDocument()
  })
})
