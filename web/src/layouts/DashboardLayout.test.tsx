import { screen, waitFor, within } from '@solidjs/testing-library'
import userEvent from '@testing-library/user-event'
import { Route } from '@solidjs/router'
import { QueryClient, QueryClientProvider } from '@tanstack/solid-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ConfirmProvider } from '@/contexts/ConfirmContext'
import { ThemeProvider } from '@/components/theme-provider'
import { I18nProvider } from '@/i18n/solid'
import { i18n } from '@/i18n/config'
import { EVENT_QUERY_KEYS, startRealtime } from '@/realtime'
import { renderAt } from '@/test/router'
import type { BusinessModule, BusinessProfile } from '@/domain/businessPreferences'
import DashboardLayout from './DashboardLayout'

const mockLogout = vi.fn()
const mockRefreshUserProfile = vi.fn().mockResolvedValue(undefined)
let mockUser: { name: string; role: string; establishment: { tradeName: string; category?: string; businessProfiles?: BusinessProfile[]; visibleModules?: BusinessModule[] } }

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: () => true,
    user: () => mockUser,
    logout: mockLogout,
    refreshUserProfile: mockRefreshUserProfile,
  }),
}))

vi.mock('@/realtime', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/realtime')>()),
  startRealtime: vi.fn(() => () => {}),
}))

let totals: Record<string, number>
const requests: string[] = []

function stubApi() {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(input instanceof Request ? input.url : String(input))
    requests.push(`${url.pathname}${url.search}`)
    return new Response(JSON.stringify({ items: [], nextCursor: null, total: totals[url.pathname] ?? 0 }), { headers: { 'Content-Type': 'application/json' } })
  }))
}

function renderLayout() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const result = renderAt('/dashboard/orders', () => <Route path="/dashboard/orders" component={DashboardLayout} />, (router) => (
    <I18nProvider>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <ConfirmProvider>{router()}</ConfirmProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </I18nProvider>
  ))
  return { ...result, queryClient }
}

describe('DashboardLayout', () => {
  beforeEach(async () => {
    localStorage.clear()
    requests.length = 0
    totals = {}
    mockLogout.mockReset()
    mockRefreshUserProfile.mockClear()
    vi.mocked(startRealtime).mockClear()
    mockUser = { name: 'Test user', role: 'MANAGER', establishment: { tradeName: 'Test establishment' } }
    stubApi()
    await i18n.changeLanguage('en')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders translated navigation and accessible collapse controls', async () => {
    const user = userEvent.setup()
    renderLayout()

    expect(screen.getByRole('link', { name: /Orders/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Sales/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Products/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Employees/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Schedule/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Reports/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Settings/ })).toBeInTheDocument()
    const toggle = screen.getByRole('button', { name: 'Collapse menu' })
    await user.click(toggle)
    expect(screen.getByRole('button', { name: 'Expand menu' })).toBeInTheDocument()
    expect(localStorage.getItem('sidebar-collapsed')).toBe('true')
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
    mockUser = { name: 'Owner user', role: 'OWNER', establishment: { tradeName: 'Test establishment', category: 'BURGER_SHOP' } }
    renderLayout()

    expect(screen.getByRole('link', { name: /Reports/ })).toBeInTheDocument()
  })

  it('shows the selected store modules without restaurant links', () => {
    mockUser = {
      name: 'Store owner', role: 'OWNER',
      establishment: {
        tradeName: 'Store', category: 'BURGER_SHOP', businessProfiles: ['STORE'],
        visibleModules: ['SALES', 'SETTINGS'],
      },
    }
    renderLayout()

    expect(screen.getByRole('link', { name: /Sales/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Products/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Employees/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Reports/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Devices/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Settings/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Orders/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Kitchen/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Deliveries/ })).not.toBeInTheDocument()
  })

  it('refreshes business preferences when the dashboard tab regains focus', () => {
    renderLayout()
    window.dispatchEvent(new Event('focus'))
    expect(mockRefreshUserProfile).toHaveBeenCalledTimes(1)
  })

  it('counts open orders, kitchen and deliveries from the /v1 totals', async () => {
    mockUser = { name: 'Owner', role: 'OWNER', establishment: { tradeName: 'Burger', businessProfiles: ['FOOD'], visibleModules: [] } }
    totals = { '/v1/orders': 6, '/v1/kitchen/orders': 5, '/v1/delivery/orders': 2 }
    renderLayout()

    await waitFor(() => expect(within(screen.getByRole('link', { name: /Orders/ })).getByText('6')).toBeInTheDocument())
    expect(within(screen.getByRole('link', { name: /Kitchen/ })).getByText('5')).toBeInTheDocument()
    expect(within(screen.getByRole('link', { name: /Deliveries/ })).getByText('2')).toBeInTheDocument()
    expect(requests).toContain('/v1/orders?limit=1')
  })

  it('shows a service execution count and refreshes it after a service event', async () => {
    mockUser = { name: 'Service owner', role: 'OWNER', establishment: {
      tradeName: 'Workshop', businessProfiles: ['SERVICES'],
      visibleModules: ['SERVICES', 'ESTIMATES', 'SERVICE_ORDERS'],
    } }
    totals = { '/v1/service-orders': 7 }
    const { queryClient } = renderLayout()

    const serviceLink = () => screen.getByRole('link', { name: /^Services/ })
    await waitFor(() => expect(within(serviceLink()).getByText('7')).toBeInTheDocument())
    expect(requests).toContain('/v1/service-orders?limit=1&stage=services&open=true')
    expect(screen.getByRole('link', { name: 'Service catalog' })).toHaveAttribute('href', '/dashboard/services')
    expect(startRealtime).toHaveBeenCalledWith(queryClient)

    totals['/v1/service-orders'] = 3
    for (const key of EVENT_QUERY_KEYS['service-order.changed']) void queryClient.invalidateQueries({ queryKey: [key] })
    await waitFor(() => expect(within(serviceLink()).getByText('3')).toBeInTheDocument())
  })

  it('localizes the sidebar logout confirmation and logs out on confirm', async () => {
    const user = userEvent.setup()
    renderLayout()

    await user.click(screen.getByRole('button', { name: 'Sign out' }))

    expect(await screen.findByRole('heading', { name: 'Log out?' })).toBeInTheDocument()
    expect(screen.getByText('Are you sure you want to log out?')).toBeInTheDocument()
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: i18n.t('logoutConfirmation.confirm', { ns: 'common' }) }))
    expect(mockLogout).toHaveBeenCalledTimes(1)
  })
})
