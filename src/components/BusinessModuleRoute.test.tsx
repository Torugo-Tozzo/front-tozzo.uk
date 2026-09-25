import { describe, expect, it, vi } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { BusinessModuleRoute, DashboardHome } from './BusinessModuleRoute'

let role = 'OWNER'
let establishment: { businessProfiles: string[]; visibleModules: string[] } | undefined
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { role, establishment } }) }))

function renderRoute() {
  render(<MemoryRouter initialEntries={['/dashboard/orders']}><Routes>
    <Route path="/dashboard/orders" element={<BusinessModuleRoute module="ORDERS"><span>Order screen</span></BusinessModuleRoute>} />
    <Route path="/dashboard/kitchen" element={<span>Kitchen screen</span>} />
  </Routes></MemoryRouter>)
}

describe('BusinessModuleRoute', () => {
  it('allows an owner to open a module by URL even if it is hidden from the menu', () => {
    role = 'OWNER'
    renderRoute()
    expect(screen.getByText('Order screen')).toBeInTheDocument()
  })

  it('redirects a cook away from an order URL to the kitchen', () => {
    role = 'COOK'
    renderRoute()
    expect(screen.getByText('Kitchen screen')).toBeInTheDocument()
    expect(screen.queryByText('Order screen')).not.toBeInTheDocument()
  })

  it('opens a store dashboard on an enabled module instead of restaurant orders', () => {
    role = 'OWNER'
    establishment = { businessProfiles: ['STORE'], visibleModules: ['SALES', 'SETTINGS', 'PRODUCTS'] }
    render(<MemoryRouter initialEntries={['/dashboard']}><Routes>
      <Route path="/dashboard" element={<DashboardHome />} />
      <Route path="/dashboard/orders" element={<span>Order screen</span>} />
      <Route path="/dashboard/sales" element={<span>Sales screen</span>} />
    </Routes></MemoryRouter>)
    expect(screen.getByText('Sales screen')).toBeInTheDocument()
    expect(screen.queryByText('Order screen')).not.toBeInTheDocument()
  })
})
