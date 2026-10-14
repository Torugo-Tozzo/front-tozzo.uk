import { Route } from '@solidjs/router'
import { screen, waitFor } from '@solidjs/testing-library'
import type { JSX } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n/config'
import { startRealtime, type RealtimeDeps } from '@/realtime'
import { json, mockApi } from '@/test/api'
import { resetAuthMocks, setMockUser } from '@/test/auth-mock'
import { renderDashboard } from '@/test/dashboard'
import DeliveriesPage from './DeliveriesPage'
import KitchenPage from './KitchenPage'
import OrdersPage from './OrdersPage'
import SalesPage from './SalesPage'

vi.mock('@/contexts/AuthContext', () => import('@/test/auth-mock'))

// The operation screens keep their queries under the keys realtime.ts
// invalidates (order.changed: orders, kitchen, delivery; sale.changed: sales),
// so an event from the API reloads what is on screen.

class FakeStream {
  onopen: (() => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: (() => void) | null = null
  close() {}
  emit(data: unknown) { this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(data) })) }
}

function listen(queryClient: Parameters<typeof startRealtime>[0]) {
  const streams: FakeStream[] = []
  const deps: Partial<RealtimeDeps> = {
    createTicket: async () => 'ticket',
    openStream: () => {
      const stream = new FakeStream()
      streams.push(stream)
      return stream as unknown as EventSource
    },
    document: { hidden: false, addEventListener: () => {}, removeEventListener: () => {} },
  }
  const stop = startRealtime(queryClient, deps)
  return { stop, emit: async (data: unknown) => { await waitFor(() => expect(streams).toHaveLength(1)); streams[0].emit(data) } }
}

const establishment = { id: 'est-1', tradeName: 'Bistro', status: 'ACTIVE' as const, plan: 'PAID' as const, category: null, preferencesRevision: 0 }
const order = (customerName: string) => ({
  id: 'order-1', customerName, status: 'OPEN', isDelivery: true, deliveryAddress: 'Rua A',
  delivery: { stage: 'WAITING', startedAt: null, driver: null, externalDriverName: null, externalDriverPhone: null },
  openedAt: '2026-09-23T12:00:00.000Z', updatedAt: '2026-09-23T12:00:00.000Z', totalCents: 2000, seller: { id: 'u1', name: 'Bia' },
  items: [{ id: 'item-1', productId: 'p1', productName: 'Burger', quantity: 1, unitPriceCents: 2000, status: 'IN_PREPARATION', kitchenReadyAt: null }],
})
const kitchenOrder = (customerName: string) => ({
  id: 'order-1', customerName, openedAt: '2026-09-23T12:00:00.000Z', updatedAt: '2026-09-23T12:00:00.000Z',
  items: [{ id: 'item-1', productId: 'p1', productName: 'Burger', quantity: 1, stage: 'IN_PREPARATION', kitchenReadyAt: null }],
})
const sale = (customerName: string) => ({
  id: 'sale-1', customerName, soldAt: '2026-09-23T12:00:00.000Z', totalCents: 2000, isCancelled: false, paymentMethod: null,
  orderId: null, serviceOrderId: null, seller: { id: 'u1', name: 'Bia' }, items: [], serviceItems: [],
})

const cases: { name: string; path: string; page: () => JSX.Element; event: string; endpoint: string; body: (customer: string) => unknown }[] = [
  { name: 'orders', path: '/dashboard/orders', page: OrdersPage, event: 'order.changed', endpoint: '/v1/orders', body: (customer) => ({ items: [order(customer)], nextCursor: null, total: 1 }) },
  { name: 'kitchen', path: '/dashboard/kitchen', page: KitchenPage, event: 'order.changed', endpoint: '/v1/kitchen/orders', body: (customer) => ({ items: [kitchenOrder(customer)], nextCursor: null, total: 1 }) },
  { name: 'deliveries', path: '/dashboard/deliveries', page: DeliveriesPage, event: 'order.changed', endpoint: '/v1/delivery/orders', body: (customer) => ({ items: [order(customer)], drivers: [], nextCursor: null, total: 1 }) },
  { name: 'sales', path: '/dashboard/sales', page: SalesPage, event: 'sale.changed', endpoint: '/v1/sales', body: (customer) => ({ items: [sale(customer)], nextCursor: null, total: 1, summary: { count: 1, totalCents: 2000 } }) },
]

describe('operation screens and realtime events', () => {
  beforeEach(async () => {
    resetAuthMocks()
    setMockUser({ role: 'OWNER', establishment })
    await i18n.changeLanguage('en')
  })
  afterEach(() => { vi.unstubAllGlobals() })

  for (const item of cases) {
    it(`${item.name}: ${item.event} reloads the screen`, async () => {
      let customer = 'Before'
      mockApi(({ path }) => (path === item.endpoint ? json(200, item.body(customer)) : undefined))
      const { queryClient } = renderDashboard(item.path, () => <Route path={item.path} component={item.page} />)
      const realtime = listen(queryClient)

      expect(await screen.findByText('Before')).toBeInTheDocument()
      customer = 'After'
      // An event of another kind leaves the screen alone.
      await realtime.emit({ type: item.event === 'sale.changed' ? 'service.changed' : 'sale.changed', id: 'x' })
      await new Promise((resolve) => setTimeout(resolve, 50))
      expect(screen.queryByText('After')).toBeNull()
      await realtime.emit({ type: item.event, id: 'x' })
      expect(await screen.findByText('After')).toBeInTheDocument()
      realtime.stop()
    })
  }
})
