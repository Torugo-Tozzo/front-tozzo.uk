import { Route } from '@solidjs/router'
import { screen, waitFor, within } from '@solidjs/testing-library'
import userEvent from '@testing-library/user-event'
import { toast } from 'solid-sonner'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n/config'
import { json, mockApi, noContent, problem, type RecordedCall } from '@/test/api'
import { renderDashboard } from '@/test/dashboard'
import { PedidosTab } from './PedidosTab'

// The /v1 order of the React test: REQUESTED comes as IN_PREPARATION.
const order = {
  id: 'order-1',
  customerName: 'Table 1',
  status: 'OPEN',
  isDelivery: false,
  deliveryAddress: null,
  delivery: null,
  openedAt: '2026-08-28T12:00:00Z',
  updatedAt: '2026-08-28T12:05:00Z',
  totalCents: 3000,
  seller: { id: 'user-1', name: 'Ana' },
  items: [
    { id: 'item-1', productId: 'product-1', productName: 'Burger', quantity: 1, unitPriceCents: 1800, status: 'IN_PREPARATION', kitchenReadyAt: null },
    { id: 'item-2', productId: 'product-2', productName: 'Fries', quantity: 1, unitPriceCents: 1200, status: 'IN_PREPARATION', kitchenReadyAt: null },
  ],
}
const product = { id: 'product-3', name: 'Soda', priceCents: 600, ingredients: null, imageUrl: null, updatedAt: '2026-01-01T00:00:00Z', productType: null }
const page = (items: unknown[], total = items.length, nextCursor: string | null = null) => json(200, { items, nextCursor, total })

function ordersApi(extra: (call: RecordedCall) => Response | undefined = () => undefined, orders: () => unknown[] = () => [order]) {
  return mockApi((call) => {
    const answer = extra(call)
    if (answer) return answer
    if (call.method === 'GET' && call.path === '/v1/orders') return page(orders())
    if (call.method === 'GET' && call.path === '/v1/orders/order-1') return json(200, order)
    if (call.path === '/v1/product-types') return json(200, [])
    if (call.path === '/v1/products') return page([product])
    return undefined
  })
}

const renderOrders = () => renderDashboard('/', () => <Route path="/" component={PedidosTab} />)

describe('PedidosTab item status workflow', () => {
  beforeEach(async () => { await i18n.changeLanguage('en') })
  afterEach(() => { vi.unstubAllGlobals() })

  it('loads open orders without the removed order-status filter', async () => {
    const api = ordersApi()
    renderOrders()

    expect(await screen.findByText('Table 1')).toBeInTheDocument()
    const query = api.to('/v1/orders')[0].query
    expect(Object.fromEntries(query)).toEqual({ limit: '10' })
    expect(screen.queryByRole('columnheader', { name: 'Status' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Status' })).not.toBeInTheDocument()
  })

  it('shows mixed item statuses and PATCHes only the selected item', async () => {
    const api = ordersApi((call) => (call.method === 'PATCH' ? json(200, order) : undefined))
    const user = userEvent.setup()
    renderOrders()

    await user.click(await screen.findByRole('button', { name: 'Edit order' }))

    const statusTrigger = await screen.findByRole('button', { name: /^Item status: Burger/ })
    expect(within(screen.getByRole('dialog')).getAllByText('In preparation')).toHaveLength(2)

    await user.click(statusTrigger)
    await user.click(await screen.findByRole('option', { name: 'Delivered' }))

    await waitFor(() => expect(api.calls.filter((call) => call.method === 'PATCH')).toHaveLength(1))
    const patch = api.calls.find((call) => call.method === 'PATCH')!
    expect(patch.path).toBe('/v1/orders/order-1/items/item-1')
    expect(patch.body).toEqual({ status: 'DELIVERED' })
  })
})

describe('PedidosTab writes', () => {
  beforeEach(async () => { await i18n.changeLanguage('en') })
  afterEach(() => { vi.unstubAllGlobals() })

  it('creates an order with a client id, keeps it on a retry and reloads the list', async () => {
    let orders: unknown[] = []
    let failures = 1
    const api = ordersApi((call) => {
      if (call.method !== 'POST' || call.path !== '/v1/orders') return undefined
      if (failures-- > 0) return problem(503, 'INTERNAL_ERROR')
      orders = [{ ...order, id: 'order-new', customerName: 'Table 9', items: [] }]
      return json(201, orders[0])
    }, () => orders)
    const toastError = vi.spyOn(toast, 'error').mockImplementation(() => '')
    const user = userEvent.setup()
    renderOrders()

    expect(await screen.findByText('No orders found.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'New order' }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('Customer / Table'), 'Table 9')
    await user.click(await within(dialog).findByText('Soda'))
    await user.click(within(dialog).getByRole('button', { name: 'Confirm' }))

    // The failure keeps the dialog and what was typed; the retry sends the same id.
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Error saving order.'))
    expect(within(dialog).getByLabelText('Customer / Table')).toHaveValue('Table 9')
    await user.click(within(dialog).getByRole('button', { name: 'Confirm' }))

    expect(await screen.findByText('Table 9')).toBeInTheDocument()
    const posts = api.calls.filter((call) => call.method === 'POST' && call.path === '/v1/orders')
    expect(posts).toHaveLength(2)
    const body = posts[1].body as { id: string }
    expect(posts[0].body).toEqual(body)
    expect(body).toEqual({ id: expect.stringMatching(/^[0-9a-f-]{36}$/), customerName: 'Table 9', isDelivery: false, items: [{ productId: 'product-3', quantity: 1 }] })
  })

  it('edits an order with PUT, keeping the ids of the existing items', async () => {
    const api = ordersApi((call) => (call.method === 'PUT' ? json(200, order) : undefined))
    const user = userEvent.setup()
    renderOrders()

    await user.click(await screen.findByRole('button', { name: 'Edit order' }))
    const dialog = await screen.findByRole('dialog')
    expect(await within(dialog).findByText('Fries')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Confirm' }))

    await waitFor(() => expect(api.calls.filter((call) => call.method === 'PUT')).toHaveLength(1))
    const put = api.calls.find((call) => call.method === 'PUT')!
    expect(put.path).toBe('/v1/orders/order-1')
    expect(put.body).toEqual({
      customerName: 'Table 1',
      isDelivery: false,
      items: [{ id: 'item-1', productId: 'product-1', quantity: 1 }, { id: 'item-2', productId: 'product-2', quantity: 1 }],
    })
  })

  it('closes an order into a sale with the payment method', async () => {
    const api = ordersApi((call) => (call.method === 'POST' && call.path === '/v1/orders/order-1/close' ? json(200, { order, sale: {} }) : undefined))
    const user = userEvent.setup()
    renderOrders()

    await user.click(await screen.findByRole('button', { name: 'Edit order' }))
    const dialog = await screen.findByRole('dialog')
    await user.selectOptions(within(dialog).getByLabelText('Payment method'), 'PIX')
    await user.click(within(dialog).getByRole('button', { name: 'Close order' }))
    await waitFor(() => expect(screen.getAllByRole('dialog')).toHaveLength(2))
    const confirmation = screen.getAllByRole('dialog').at(-1)!
    expect(confirmation).toHaveTextContent('It will become a sale.')
    await user.click(within(confirmation).getByRole('button', { name: 'Yes' }))

    await waitFor(() => expect(api.to('/v1/orders/order-1/close')).toHaveLength(1))
    expect(api.to('/v1/orders/order-1/close')[0].body).toEqual({ paymentMethod: 'PIX' })
  })

  it('deletes an order after confirming, once', async () => {
    const api = ordersApi((call) => (call.method === 'DELETE' ? noContent() : undefined))
    const user = userEvent.setup()
    renderOrders()

    await user.click(await screen.findByRole('button', { name: 'Delete order' }))
    const confirmation = await screen.findByRole('dialog')
    expect(confirmation).toHaveTextContent('Are you sure you want to delete this order?')
    await user.click(within(confirmation).getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(api.calls.filter((call) => call.method === 'DELETE').map((call) => call.path)).toEqual(['/v1/orders/order-1']))
  })

  it('applies the filters on Search, in cents, from page 1', async () => {
    const api = ordersApi()
    const user = userEvent.setup()
    renderOrders()
    expect(await screen.findByText('Table 1')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Customer / Table'), 'tab')
    await user.type(screen.getByLabelText('Minimum total'), '1050')
    // Typing alone does not reload.
    expect(api.to('/v1/orders')).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: 'Search' }))

    await waitFor(() => expect(api.to('/v1/orders')).toHaveLength(2))
    expect(Object.fromEntries(api.to('/v1/orders')[1].query)).toEqual({ customerName: 'tab', minTotalCents: '1050', limit: '10' })
  })

  it('prints the order receipt with the cents as money', async () => {
    ordersApi()
    window.print = vi.fn()
    const user = userEvent.setup()
    renderOrders()

    await user.click(await screen.findByRole('button', { name: 'Print order' }))
    const root = document.getElementById('receipt-print-root')!
    expect(root.querySelector('.receipt__title')?.textContent).toBe('Order #order-1')
    expect(root.querySelector('.receipt__total')?.textContent).toBe('TotalR$30.00')
    expect([...root.querySelectorAll('.receipt__item')].map((item) => item.textContent)).toEqual(['1x BurgerR$18.00', '1x FriesR$12.00'])
    window.dispatchEvent(new Event('afterprint'))
  })
})
