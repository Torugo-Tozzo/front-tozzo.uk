import { Route } from '@solidjs/router'
import { screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n/config'
import { json, mockApi } from '@/test/api'
import { resetAuthMocks, setMockUser } from '@/test/auth-mock'
import { renderDashboard } from '@/test/dashboard'
import DashboardLayout from './DashboardLayout'

vi.mock('@/contexts/AuthContext', () => import('@/test/auth-mock'))
vi.mock('@/realtime', () => ({ startRealtime: vi.fn(() => () => {}) }))
vi.mock('@/components/dashboard/EstablishmentOnboardingModal', () => ({
  EstablishmentOnboardingModal: (props: { open: boolean }) => (props.open ? <div data-testid="establishment-onboarding" /> : null),
}))

const establishment = (patch: Record<string, unknown>) => ({ id: 'est-42', tradeName: 'Burger', status: 'ACTIVE', plan: 'PAID', category: null, preferencesRevision: 0, ...patch }) as never
const renderLayout = () => renderDashboard('/dashboard/orders', () => <Route path="/dashboard/orders" component={DashboardLayout} />)

describe('DashboardLayout establishment onboarding', () => {
  beforeEach(async () => {
    resetAuthMocks()
    mockApi(() => json(200, { items: [], nextCursor: null, total: 0 }))
    await i18n.changeLanguage('en')
  })
  afterEach(() => { vi.unstubAllGlobals() })

  it('opens for an owner whose establishment has no business profile', async () => {
    setMockUser({ role: 'OWNER', establishment: establishment({ businessProfiles: [] }) })
    renderLayout()
    expect(await screen.findByTestId('establishment-onboarding')).toBeInTheDocument()
  })

  it('opens for an owner of a legacy establishment (no profiles) without a category', async () => {
    setMockUser({ role: 'OWNER', establishment: establishment({}) })
    renderLayout()
    expect(await screen.findByTestId('establishment-onboarding')).toBeInTheDocument()
  })

  it('does not open after the profiles are set, for a legacy category, or for a non-owner', async () => {
    setMockUser({ role: 'OWNER', establishment: establishment({ businessProfiles: ['FOOD'] }) })
    const first = renderLayout()
    await screen.findByRole('navigation', { name: 'Dashboard' })
    expect(screen.queryByTestId('establishment-onboarding')).toBeNull()
    first.unmount()

    setMockUser({ role: 'OWNER', establishment: establishment({ category: 'BURGER_SHOP' }) })
    const second = renderLayout()
    await screen.findByRole('navigation', { name: 'Dashboard' })
    expect(screen.queryByTestId('establishment-onboarding')).toBeNull()
    second.unmount()

    setMockUser({ role: 'MANAGER', establishment: establishment({ businessProfiles: [] }) })
    renderLayout()
    await screen.findByRole('navigation', { name: 'Dashboard' })
    expect(screen.queryByTestId('establishment-onboarding')).toBeNull()
  })
})
