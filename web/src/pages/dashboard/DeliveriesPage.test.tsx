import { Route } from '@solidjs/router'
import { fireEvent, screen, waitFor, within } from '@solidjs/testing-library'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n/config'
import { json, mockApi, problem, type RecordedCall } from '@/test/api'
import { resetAuthMocks, setMockUser } from '@/test/auth-mock'
import { renderDashboard } from '@/test/dashboard'
import DeliveriesPage from './DeliveriesPage'

vi.mock('@/contexts/AuthContext', () => import('@/test/auth-mock'))

const establishment = { id: 'est-1', tradeName: 'Bistro', status: 'ACTIVE' as const, plan: 'PAID' as const, category: null, preferencesRevision: 0 }
type Item = { id: string; productId?: string; name: string; quantity: number; status: string; unitPriceCents?: number }

// A /v1 delivery order (GET /v1/delivery/orders) from the React test's fields.
function order(input: { stage?: 'WAITING' | 'DELIVERING'; driver?: { id: string; name: string; phone: string | null } | null; items: Item[] }) {
  return {
    id: 'order-1', customerName: 'Ana', status: input.stage === 'DELIVERING' ? 'DELIVERING' : 'OPEN', isDelivery: true, deliveryAddress: 'Rua A',
    delivery: { stage: input.stage ?? 'WAITING', startedAt: null, driver: input.driver ?? null, externalDriverName: null, externalDriverPhone: null },
    openedAt: '2026-09-23T12:00:00.000Z', updatedAt: '2026-09-23T12:00:00.000Z', totalCents: 2000, seller: { id: 'u1', name: 'Bia' },
    items: input.items.map((item, index) => ({ id: item.id, productId: item.productId ?? `product-${index}`, productName: item.name, quantity: item.quantity, unitPriceCents: item.unitPriceCents ?? 2000, status: item.status, kitchenReadyAt: null })),
  }
}
const boardOf = (orders: unknown[], drivers: unknown[] = []) => json(200, { items: orders, drivers, nextCursor: null, total: orders.length })
const burgerReady = [{ id: 'item-1', name: 'Burger', quantity: 1, status: 'READY' }]

function deliveryApi(board: () => Response, writes: (call: RecordedCall) => Response | undefined = () => json(200, {})) {
  return mockApi((call) => {
    if (call.method === 'GET' && call.path === '/v1/delivery/orders') return board()
    if (call.method !== 'GET') return writes(call)
    return undefined
  })
}
const renderDeliveries = () => renderDashboard('/dashboard/deliveries', () => <Route path="/dashboard/deliveries" component={DeliveriesPage} />)
const patches = (api: { calls: RecordedCall[] }) => api.calls.filter((call) => call.method === 'PATCH')

beforeEach(async () => {
  resetAuthMocks()
  setMockUser({ role: 'OWNER', establishment })
  await i18n.changeLanguage('pt-BR')
})
afterEach(() => { vi.unstubAllGlobals() })

it('assigns a fixed driver and starts only a ready order', async () => {
  const api = deliveryApi(() => boardOf([order({ items: burgerReady })], [{ id: 'driver-1', name: 'João', phone: '123', available: true }]))
  renderDeliveries()
  await waitFor(() => expect(screen.getByText('Ana')).toBeInTheDocument())
  fireEvent.click(screen.getByRole('button', { name: /atribuir/i }))
  const dialog = await screen.findByRole('dialog')
  expect(within(dialog).queryByRole('combobox', { name: /entregador fixo/i })).not.toBeInTheDocument()
  fireEvent.click(within(dialog).getByRole('button', { name: /João.*Disponível/i }))
  fireEvent.click(screen.getByRole('button', { name: /salvar entregador/i }))
  await waitFor(() => expect(patches(api)).toHaveLength(1))
  expect(patches(api)[0].path).toBe('/v1/delivery/orders/order-1')
  expect(patches(api)[0].body).toEqual({ action: 'ASSIGN', driverId: 'driver-1', expectedUpdatedAt: '2026-09-23T12:00:00.000Z' })
})

it('starts a ready order without a driver', async () => {
  const api = deliveryApi(() => boardOf([order({ items: burgerReady })]))
  renderDeliveries()
  const start = await screen.findByRole('button', { name: 'Saiu para entrega' })
  expect(start).toBeEnabled()
  fireEvent.click(start)
  await waitFor(() => expect(patches(api)).toHaveLength(1))
  expect(patches(api)[0].body).toEqual(expect.objectContaining({ action: 'START' }))
})

it('asks before marking pending items ready and starting delivery', async () => {
  const api = deliveryApi(() => boardOf([order({ items: [{ id: 'item-1', name: 'Burger', quantity: 1, status: 'IN_PREPARATION' }] })]))
  renderDeliveries()
  fireEvent.click(await screen.findByRole('button', { name: 'Saiu para entrega' }))
  let dialog = await screen.findByRole('dialog')
  expect(within(dialog).getByText(/Burger/)).toBeInTheDocument()
  expect(patches(api)).toHaveLength(0)
  fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(patches(api)).toHaveLength(0)
  fireEvent.click(screen.getByRole('button', { name: 'Saiu para entrega' }))
  dialog = await screen.findByRole('dialog')
  fireEvent.click(within(dialog).getByRole('button', { name: /confirmar/i }))
  await waitFor(() => expect(patches(api)).toHaveLength(1))
  expect(patches(api)[0].body).toEqual(expect.objectContaining({ action: 'START', confirmReady: true }))
})

it('explains a changed order after a failed start', async () => {
  deliveryApi(() => boardOf([order({ items: burgerReady })]), () => problem(409, 'DELIVERY_CONFLICT'))
  renderDeliveries()
  fireEvent.click(await screen.findByRole('button', { name: 'Saiu para entrega' }))
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('O pedido mudou'))
})

it('shows busy drivers as disabled in the assignment dialog', async () => {
  deliveryApi(() => boardOf([order({ items: [] })], [{ id: 'driver-1', name: 'João', phone: '123', available: false }]))
  renderDeliveries()
  fireEvent.click(await screen.findByRole('button', { name: 'Atribuir entregador' }))
  expect(within(await screen.findByRole('dialog')).getByRole('button', { name: /João.*Ocupado/i })).toBeDisabled()
})

it('keeps large orders compact and opens all items in the existing order modal', async () => {
  const items = Array.from({ length: 10 }, (_, index) => ({ id: `item-${index + 1}`, productId: `product-${index + 1}`, name: `Item ${index + 1}`, quantity: 1, unitPriceCents: 200, status: 'READY' }))
  deliveryApi(() => boardOf([order({ items })]))
  renderDeliveries()
  await waitFor(() => expect(screen.getByText(/Item 3/)).toBeInTheDocument())
  expect(screen.queryByText(/Item 4/)).not.toBeInTheDocument()
  expect(screen.getByText('…')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Ver pedido' }))
  const dialog = await screen.findByRole('dialog', { name: 'Detalhes do pedido' })
  expect(within(dialog).getByText('Item 10')).toBeInTheDocument()
  expect(within(dialog).getByText('Rua A')).toBeInTheDocument()
})

it('starting delivery does not close the order; finishing explicitly closes it with payment', async () => {
  let stage: 'WAITING' | 'DELIVERING' = 'WAITING'
  const api = deliveryApi(
    () => boardOf([order({ stage, driver: { id: 'driver-1', name: 'João', phone: null }, items: burgerReady })]),
    (call) => {
      if (call.method === 'PATCH') { stage = 'DELIVERING'; return json(200, {}) }
      return json(200, { order: {}, sale: {} })
    },
  )
  renderDeliveries()
  await waitFor(() => expect(screen.getByRole('button', { name: 'Saiu para entrega' })).toBeEnabled())
  expect(screen.getByRole('button', { name: 'Editar entregador' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Atribuir entregador' })).not.toBeInTheDocument()
  expect(screen.getByText('Entregadores')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Saiu para entrega' }))
  await waitFor(() => expect(patches(api)).toHaveLength(1))
  expect(patches(api)[0].body).toEqual(expect.objectContaining({ action: 'START' }))
  expect(api.calls.filter((call) => call.method === 'POST')).toHaveLength(0)
  fireEvent.click(await screen.findByRole('button', { name: 'Finalizar entrega' }))
  const dialog = await screen.findByRole('dialog')
  fireEvent.change(within(dialog).getByRole('combobox', { name: 'Método de pagamento' }), { target: { value: 'PIX' } })
  const confirmFinish = within(dialog).getByRole('button', { name: 'Fechar pedido e gerar venda' })
  await waitFor(() => expect(confirmFinish).toBeEnabled())
  fireEvent.click(confirmFinish)
  await waitFor(() => expect(api.to('/v1/orders/order-1/close')).toHaveLength(1))
  expect(api.to('/v1/orders/order-1/close')[0].body).toEqual({ paymentMethod: 'PIX' })
})

it('registers a temporary third-party driver on the order', async () => {
  const api = deliveryApi(() => boardOf([order({ items: burgerReady })]))
  renderDeliveries()
  fireEvent.click(await screen.findByRole('button', { name: 'Atribuir entregador' }))
  fireEvent.click(await screen.findByRole('radio', { name: 'Terceirizado' }))
  fireEvent.input(await screen.findByRole('textbox', { name: 'Nome do entregador' }), { target: { value: 'João iFood' } })
  fireEvent.input(screen.getByRole('textbox', { name: /Contato do entregador/ }), { target: { value: '999' } })
  fireEvent.click(screen.getByRole('button', { name: 'Salvar entregador' }))
  await waitFor(() => expect(patches(api)).toHaveLength(1))
  expect(patches(api)[0].body).toEqual(expect.objectContaining({ action: 'ASSIGN', externalDriverName: 'João iFood', externalDriverPhone: '999' }))
})

it('removes the driver with an ASSIGN without one, and a driver sees no driver controls', async () => {
  const api = deliveryApi(() => boardOf([order({ driver: { id: 'driver-1', name: 'João', phone: '123' }, items: burgerReady })], [{ id: 'driver-1', name: 'João', phone: '123', available: true }]))
  renderDeliveries()
  expect(await screen.findByText('Entregador: João · 123')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Editar entregador' }))
  fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Remover entregador' }))
  await waitFor(() => expect(patches(api)).toHaveLength(1))
  expect(patches(api)[0].body).toEqual({ action: 'ASSIGN', expectedUpdatedAt: '2026-09-23T12:00:00.000Z' })
})

it('a driver only starts the delivery: no assignment, no roster', async () => {
  setMockUser({ role: 'DRIVER', establishment })
  deliveryApi(() => boardOf([order({ items: burgerReady })], [{ id: 'driver-1', name: 'João', phone: '123', available: true }]))
  renderDeliveries()
  expect(await screen.findByRole('button', { name: 'Saiu para entrega' })).toBeEnabled()
  expect(screen.queryByRole('button', { name: 'Atribuir entregador' })).not.toBeInTheDocument()
  expect(screen.queryByText('Entregadores')).not.toBeInTheDocument()
})
