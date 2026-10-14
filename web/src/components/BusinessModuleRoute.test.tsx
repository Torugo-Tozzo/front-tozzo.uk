import { describe, expect, it, vi } from 'vitest'
import { screen } from '@solidjs/testing-library'
import { Route } from '@solidjs/router'
import { BusinessModuleRoute, DashboardHome } from './BusinessModuleRoute'
import { renderAt } from '@/test/router'

let role = 'OWNER'
let establishment: { businessProfiles: string[]; visibleModules: string[] } | undefined
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: () => ({ role, establishment }) }) }))

function renderRoute() {
  renderAt('/dashboard/orders', () => (
    <>
      <Route path="/dashboard/orders" component={() => <BusinessModuleRoute module="ORDERS"><span>Order screen</span></BusinessModuleRoute>} />
      <Route path="/dashboard/kitchen" component={() => <span>Kitchen screen</span>} />
    </>
  ))
}

describe('BusinessModuleRoute', () => {
  it('allows an owner to open a module by URL even if it is hidden from the menu', () => {
    role = 'OWNER'
    renderRoute()
    expect(screen.getByText('Order screen')).toBeInTheDocument()
  })

  it('allows a role-authorized service URL even when the module is hidden from the menu', () => {
    role = 'OWNER'
    establishment = { businessProfiles: ['SERVICES'], visibleModules: [] }
    renderAt('/dashboard/services', () => (
      <Route path="/dashboard/services" component={() => <BusinessModuleRoute module="SERVICES"><span>Service screen</span></BusinessModuleRoute>} />
    ))
    expect(screen.getByText('Service screen')).toBeInTheDocument()
  })

  it.each(['COOK', 'DRIVER'])('blocks %s from the services URL', (specialRole) => {
    role = specialRole
    renderAt('/dashboard/services', () => (
      <>
        <Route path="/dashboard/services" component={() => <BusinessModuleRoute module="SERVICES"><span>Service screen</span></BusinessModuleRoute>} />
        <Route path="/dashboard/kitchen" component={() => <span>Kitchen screen</span>} />
        <Route path="/dashboard/deliveries" component={() => <span>Delivery screen</span>} />
      </>
    ))
    expect(screen.queryByText('Service screen')).not.toBeInTheDocument()
  })

  it.each(['COOK', 'DRIVER'])('blocks %s from the execution URL', (specialRole) => {
    role = specialRole
    renderAt('/dashboard/service-orders', () => (
      <>
        <Route path="/dashboard/service-orders" component={() => <BusinessModuleRoute module="SERVICE_ORDERS"><span>Execution screen</span></BusinessModuleRoute>} />
        <Route path="/dashboard/kitchen" component={() => <span>Kitchen screen</span>} />
        <Route path="/dashboard/deliveries" component={() => <span>Delivery screen</span>} />
      </>
    ))
    expect(screen.queryByText('Execution screen')).not.toBeInTheDocument()
  })

  it('redirects a cook away from an order URL to the kitchen', async () => {
    role = 'COOK'
    establishment = undefined
    renderRoute()
    expect(await screen.findByText('Kitchen screen')).toBeInTheDocument()
    expect(screen.queryByText('Order screen')).not.toBeInTheDocument()
  })

  it('opens a store dashboard on an enabled module instead of restaurant orders', async () => {
    role = 'OWNER'
    establishment = { businessProfiles: ['STORE'], visibleModules: ['SALES', 'SETTINGS', 'PRODUCTS'] }
    renderAt('/dashboard', () => (
      <>
        <Route path="/dashboard" component={DashboardHome} />
        <Route path="/dashboard/orders" component={() => <span>Order screen</span>} />
        <Route path="/dashboard/sales" component={() => <span>Sales screen</span>} />
      </>
    ))
    expect(await screen.findByText('Sales screen')).toBeInTheDocument()
    expect(screen.queryByText('Order screen')).not.toBeInTheDocument()
  })
})
