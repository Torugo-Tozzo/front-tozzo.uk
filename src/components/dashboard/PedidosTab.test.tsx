import { Route } from '@solidjs/router'
import { screen, waitFor, within } from '@solidjs/testing-library'
import userEvent from '@testing-library/user-event'
import { toast } from 'solid-sonner'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n/config'
import { json, mockApi, noContent, problem, type RecordedCall } from '@/test/api'
import { resetAuthMocks, setMockUser } from '@/test/auth-mock'
import { confirmDialog, dialogClosed, renderDashboard } from '@/test/dashboard'
import OrdersPage from '@/pages/dashboard/OrdersPage'

vi.mock('@/contexts/AuthContext', () => import('@/test/auth-mock'))

type Item = { id: string; productId: string; productName: string; quantity: number; unitPriceCents: number; status: 'IN_PREPARATION' | 'READY' | 'DELIVERED' }
const item = (id: string, productId: string, productName: string, unitPriceCents: number, status: Item['status'] = 'IN_PREPARATION', quantity = 1): Item =>
  ({ id, productId, productName, quantity, unitPriceCents, status })
const order = (id: string, extra: Record<string, unknown> = {}) => {
  const items = (extra.items as Item[] | undefined) ?? [item('item-1', 'product-1', 'Burger', 1800, 'READY'), item('item-2', 'product-2', 'Fries', 1200)]
  return {
    id,
    customerName: 'Table 1',
    status: 'OPEN',
    isDelivery: false,
    deliveryAddress: null,
    delivery: null,
    seller: { id: 'usr-1', name: 'Ana' },
    totalCents: items.reduce((sum, entry) => sum + entry.quantity * entry.unitPriceCents, 0),
    openedAt: '2026-10-01T12:00:00Z',
    updatedAt: '2026-10-01T12:30:00Z',
    ...extra,
    items,
  }
}
const page = (items: unknown[], nextCursor: string | null = null, total = items.length) => ({ items, nextCursor, total })
const catalogProduct = { id: 'product-3', name: 'Soda', priceCents: 600, ingredients: null, imageUrl: null, updatedAt: '2026-01-01T00:00:00Z', productType: null }

type Handler = (call: RecordedCall) => Response | undefined
/** The orders of `list` (a function, so a test can change them), the catalog, and `handler` for the writes. */
function ordersApi(list: () => unknown[], handler: Handler = () => undefined) {
  return mockApi((call) => {
    const answer = handler(call)
    if (answer) return answer
    if (call.method === 'GET' && call.path === '/v1/orders') return json(200, page(list()))
    const detail = /^\/v1\/orders\/([^/]+)$/.exec(call.path)
    if (call.method === 'GET' && detail) {
      const found = (list() as { id: string }[]).find((entry) => entry.id === detail[1])
      return found ? json(200, found) : problem(404, 'ORDER_NOT_FOUND')
    }
    if (call.path === '/v1/product-types') return json(200, [])
    if (call.path === '/v1/products') return json(200, page([catalogProduct]))
    return undefined
  })
}

const renderOrders = () => renderDashboard('/dashboard/orders', () => <Route path="/dashboard/orders" component={OrdersPage} />)
const orderGets = (calls: RecordedCall[]) => calls.filter((call) => call.method === 'GET' && call.path === '/v1/orders')
const writes = (calls: RecordedCall[]) => calls.filter((call) => call.method !== 'GET')

// happy-dom has no window.print.
const stubPrint = () => {
  const print = vi.fn()
  window.print = print
  return print
}

describe('OrdersPage', () => {
  beforeEach(async () => {
    resetAuthMocks()
    setMockUser({ role: 'OWNER', establishment: { tradeName: 'Café da Nina' } as never })
    localStorage.clear()
    await i18n.changeLanguage('en')
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('renders translated order chrome and preserves the establishment name', async () => {
    ordersApi(() => [])
    renderOrders()

    expect(screen.getByRole('heading', { name: 'Orders — Café da Nina' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'New order' })).toBeInTheDocument()
    expect(screen.getByText('Recent orders')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Customer / Table' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Created by' })).toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Status' })).not.toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Date' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Total' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Actions' })).toBeInTheDocument()
    // The skeleton stays at least 400 ms (createMinLoading).
    expect(await screen.findByText('No orders found.', {}, { timeout: 3000 })).toBeInTheDocument()
    expect(screen.queryByText('Nenhum pedido encontrado.')).not.toBeInTheDocument()
  })

  it('shows the plain title without an establishment', async () => {
    setMockUser({ role: 'OWNER' })
    ordersApi(() => [])
    renderOrders()
    expect(screen.getByRole('heading', { name: 'Orders' })).toBeInTheDocument()
  })

  it('loads the open orders of the /v1, without the removed order-status filter', async () => {
    const api = ordersApi(() => [order('ord-1')])
    renderOrders()

    const row = (await screen.findByText('Table 1')).closest('tr')!
    expect(orderGets(api.calls)[0].query.toString()).toBe('status=open&limit=10')
    expect(within(row).getByText('Ana')).toBeInTheDocument()
    expect(within(row).getByText('1x Burger, 1x Fries')).toBeInTheDocument()
    expect(within(row).getByText('R$30.00')).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Status' })).not.toBeInTheDocument()
  })

  it('shows deliveries, and an order out for delivery cannot be edited or deleted', async () => {
    ordersApi(() => [
      order('ord-1', { customerName: 'Ana Souza', isDelivery: true, deliveryAddress: 'Rua A, 10' }),
      order('ord-2', { customerName: 'Bruno', isDelivery: true, deliveryAddress: 'Rua B, 20', status: 'DELIVERING' }),
    ])
    renderOrders()

    const waiting = (await screen.findByText('Ana Souza')).closest('tr')!
    const delivering = screen.getByText('Bruno').closest('tr')!
    expect(within(waiting).getByText('Delivery order: Rua A, 10')).toBeInTheDocument()
    expect(within(delivering).getByText('Delivering: Rua B, 20')).toBeInTheDocument()
    expect(within(waiting).getByRole('button', { name: 'Edit order' })).toBeEnabled()
    expect(within(delivering).getByRole('button', { name: 'Edit order' })).toBeDisabled()
    expect(within(delivering).getByRole('button', { name: 'Delete order' })).toBeDisabled()
    expect(within(delivering).getByRole('button', { name: 'Print order' })).toBeEnabled()
  })

  it('shows mixed item statuses and PATCHes only the selected item', async () => {
    const api = ordersApi(() => [order('ord-1')], ({ method }) => (method === 'PATCH' ? json(200, order('ord-1')) : undefined))
    const user = userEvent.setup()
    renderOrders()

    await user.click(await screen.findByRole('button', { name: 'Edit order' }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(api.calls.some((call) => call.method === 'GET' && call.path === '/v1/orders/ord-1')).toBe(true)
    // Kobalte names the trigger by its label and its value.
    expect(await screen.findByRole('button', { name: /^Item status: Burger/ })).toHaveTextContent('Ready to serve')
    expect(screen.getByRole('button', { name: /^Item status: Fries/ })).toHaveTextContent('In preparation')

    await user.click(screen.getByRole('button', { name: /^Item status: Burger/ }))
    await user.click(await screen.findByRole('option', { name: 'Delivered' }))

    await waitFor(() => expect(writes(api.calls)).toHaveLength(1))
    expect(writes(api.calls)[0]).toMatchObject({ method: 'PATCH', path: '/v1/orders/ord-1/items/item-1', body: { status: 'DELIVERED' } })
    await waitFor(() => expect(orderGets(api.calls).length).toBeGreaterThan(1))
  })

  it('creates an order with a client id, and a retry after a failure reuses it', async () => {
    let attempts = 0
    let orders: unknown[] = []
    const api = ordersApi(() => orders, ({ method, path, body }) => {
      if (method !== 'POST' || path !== '/v1/orders') return undefined
      attempts += 1
      if (attempts === 1) return problem(500, 'INTERNAL_ERROR')
      orders = [order((body as { id: string }).id, { customerName: 'Table 9', items: [item('item-9', 'product-3', 'Soda', 600)] })]
      return json(201, orders[0])
    })
    const error = vi.spyOn(toast, 'error')
    const user = userEvent.setup()
    renderOrders()

    await screen.findByText('No orders found.')
    await user.click(screen.getByRole('button', { name: 'New order' }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByRole('textbox', { name: 'Customer / Table' }), 'Table 9')
    await user.click(await within(dialog).findByText('Soda'))
    await user.click(within(dialog).getByRole('button', { name: 'Confirm' }))

    await waitFor(() => expect(error).toHaveBeenCalledWith('Error saving order.'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirm' }))
    await dialogClosed()

    const posts = writes(api.calls)
    expect(posts).toHaveLength(2)
    const first = posts[0].body as { id: string }
    expect(first.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(posts[1].body).toEqual(first)
    expect(first).toEqual({ id: first.id, customerName: 'Table 9', isDelivery: false, items: [{ productId: 'product-3', quantity: 1 }] })
    expect(await screen.findByText('Table 9')).toBeInTheDocument()
  })

  it('a retry with an edited form follows the idempotent POST with a PUT of the new body', async () => {
    let attempts = 0
    let orders: unknown[] = []
    const api = ordersApi(() => orders, ({ method, path, body }) => {
      if (method === 'POST' && path === '/v1/orders') {
        attempts += 1
        const id = (body as { id: string }).id
        // The first attempt reached the API, but its answer was lost.
        orders = [order(id, { customerName: 'Table 9', items: [item('item-9', 'product-3', 'Soda', 600)] })]
        return attempts === 1 ? problem(500, 'INTERNAL_ERROR') : json(200, orders[0])
      }
      if (method === 'PUT') {
        orders = [order((orders[0] as { id: string }).id, { customerName: 'Table 10', items: [item('item-10', 'product-3', 'Soda', 600)] })]
        return json(200, orders[0])
      }
      return undefined
    })
    const user = userEvent.setup()
    renderOrders()

    await screen.findByText('No orders found.', {}, { timeout: 3000 })
    await user.click(screen.getByRole('button', { name: 'New order' }))
    const dialog = await screen.findByRole('dialog')
    const name = within(dialog).getByRole('textbox', { name: 'Customer / Table' })
    await user.type(name, 'Table 9')
    await user.click(await within(dialog).findByText('Soda'))
    await user.click(within(dialog).getByRole('button', { name: 'Confirm' }))
    await waitFor(() => expect(writes(api.calls)).toHaveLength(1))
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Confirm' })).toBeEnabled())

    await user.clear(name)
    await user.type(name, 'Table 10')
    await user.click(within(dialog).getByRole('button', { name: 'Confirm' }))
    await dialogClosed()

    const [first, second, put] = writes(api.calls)
    expect(second.method).toBe('POST')
    expect((second.body as { id: string }).id).toBe((first.body as { id: string }).id)
    expect(put).toMatchObject({
      method: 'PUT',
      path: `/v1/orders/${(first.body as { id: string }).id}`,
      // The version of the order the POST answered.
      body: { expectedUpdatedAt: '2026-10-01T12:30:00Z', customerName: 'Table 10', isDelivery: false, items: [{ productId: 'product-3', quantity: 1 }] },
    })
    expect(await screen.findByText('Table 10')).toBeInTheDocument()
  })

  it('a refetch updates the rows in place, keeping the row and the focus', async () => {
    let orders = [order('ord-1'), order('ord-2', { customerName: 'Table 2' })]
    const api = ordersApi(() => orders)
    const { queryClient } = renderOrders()

    const row = (await screen.findByText('Table 1')).closest('tr')!
    const edit = within(row).getByRole('button', { name: 'Edit order' })
    edit.focus()
    expect(document.activeElement).toBe(edit)

    orders = [order('ord-1', { customerName: 'Table 1A' }), order('ord-2', { customerName: 'Table 2' })]
    const before = orderGets(api.calls).length
    await queryClient.invalidateQueries({ queryKey: ['orders'] })
    await waitFor(() => expect(orderGets(api.calls).length).toBeGreaterThan(before))

    expect(await within(row).findByText('Table 1A')).toBeInTheDocument()
    expect(row.isConnected).toBe(true)
    expect(screen.getByText('Table 1A').closest('tr')).toBe(row)
    expect(document.activeElement).toBe(edit)
  })

  it('creates a delivery order with its address', async () => {
    const api = ordersApi(() => [], ({ method }) => (method === 'POST' ? json(201, order('ord-new')) : undefined))
    const user = userEvent.setup()
    renderOrders()

    await screen.findByText('No orders found.')
    await user.click(screen.getByRole('button', { name: 'New order' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(await within(dialog).findByText('Soda'))
    await user.click(within(dialog).getByRole('checkbox', { name: 'Delivery order' }))
    await user.type(within(dialog).getByRole('textbox', { name: 'Delivery address' }), '  Rua C, 30 ')
    await user.click(within(dialog).getByRole('button', { name: 'Confirm' }))
    await dialogClosed()

    expect((writes(api.calls)[0].body as Record<string, unknown>)).toMatchObject({ isDelivery: true, deliveryAddress: 'Rua C, 30', items: [{ productId: 'product-3', quantity: 1 }] })
    expect(writes(api.calls)[0].body).not.toHaveProperty('customerName')
  })

  it('edits the items with PUT, keeping the ids of the existing ones', async () => {
    const api = ordersApi(() => [order('ord-1')], ({ method }) => (method === 'PUT' ? json(200, order('ord-1')) : undefined))
    const user = userEvent.setup()
    renderOrders()

    await user.click(await screen.findByRole('button', { name: 'Edit order' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Edit order (add items)')).toBeInTheDocument()
    expect(within(dialog).getByRole('textbox', { name: 'Customer / Table' })).toHaveValue('Table 1')
    await user.click(within(dialog).getAllByRole('button', { name: 'Increase quantity' })[0])
    await user.click(within(dialog).getAllByRole('button', { name: 'Remove item' })[1])
    await user.click(await within(dialog).findByText('Soda'))
    await user.click(within(dialog).getByRole('button', { name: 'Confirm' }))
    await dialogClosed()

    expect(writes(api.calls)).toEqual([expect.objectContaining({
      method: 'PUT',
      path: '/v1/orders/ord-1',
      body: {
        expectedUpdatedAt: '2026-10-01T12:30:00Z',
        customerName: 'Table 1',
        isDelivery: false,
        items: [{ id: 'item-1', productId: 'product-1', quantity: 2 }, { productId: 'product-3', quantity: 1 }],
      },
    })])
  })

  it('a version conflict keeps the editor open, reloads the order, and the next save carries the new version', async () => {
    let current = order('ord-1')
    let puts = 0
    const api = ordersApi(() => [current], ({ method, body }) => {
      if (method !== 'PUT') return undefined
      puts += 1
      if ((body as { expectedUpdatedAt: string }).expectedUpdatedAt !== current.updatedAt) return problem(409, 'ORDER_CONFLICT')
      return json(200, current)
    })
    const error = vi.spyOn(toast, 'error')
    const user = userEvent.setup()
    renderOrders()

    await user.click(await screen.findByRole('button', { name: 'Edit order' }))
    const dialog = await screen.findByRole('dialog')
    // Changed on another device after the editor read it: Fries is gone, a Soda came in.
    current = order('ord-1', { updatedAt: '2026-10-01T12:45:00Z', items: [item('item-1', 'product-1', 'Burger', 1800, 'READY'), item('item-3', 'product-3', 'Soda', 600)] })
    await user.click(within(dialog).getAllByRole('button', { name: 'Increase quantity' })[0])
    await user.click(within(dialog).getByRole('button', { name: 'Confirm' }))

    await waitFor(() => expect(error).toHaveBeenCalledWith('This order was changed elsewhere. Check the updated items and save again.'))
    expect(screen.getByRole('dialog')).toBe(dialog)
    // The editor shows the order as it is now (the unsaved +1 is gone).
    const selected = within(within(dialog).getByText('Selected items').parentElement!)
    await waitFor(() => expect(selected.getByText('Soda')).toBeInTheDocument())
    expect(selected.queryByText('Fries')).not.toBeInTheDocument()
    expect(selected.getByText('1 x R$18.00')).toBeInTheDocument()

    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Confirm' })).toBeEnabled())
    await user.click(within(dialog).getByRole('button', { name: 'Confirm' }))
    await dialogClosed()
    const sent = writes(api.calls).map((call) => call.body as { expectedUpdatedAt: string; items: unknown[] })
    expect(puts).toBe(2)
    expect(sent[0].expectedUpdatedAt).toBe('2026-10-01T12:30:00Z')
    expect(sent[1]).toEqual({
      expectedUpdatedAt: '2026-10-01T12:45:00Z',
      customerName: 'Table 1',
      isDelivery: false,
      items: [{ id: 'item-1', productId: 'product-1', quantity: 1 }, { id: 'item-3', productId: 'product-3', quantity: 1 }],
    })
  })

  it('an item status change keeps the editor on the version it produced', async () => {
    let current = order('ord-1')
    const api = ordersApi(() => [current], ({ method, body }) => {
      if (method === 'PATCH') {
        current = order('ord-1', { updatedAt: '2026-10-01T12:50:00Z', items: [item('item-1', 'product-1', 'Burger', 1800, 'DELIVERED'), item('item-2', 'product-2', 'Fries', 1200)] })
        return json(200, current)
      }
      if (method === 'PUT') {
        return (body as { expectedUpdatedAt: string }).expectedUpdatedAt === current.updatedAt ? json(200, current) : problem(409, 'ORDER_CONFLICT')
      }
      return undefined
    })
    const user = userEvent.setup()
    renderOrders()

    await user.click(await screen.findByRole('button', { name: 'Edit order' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(await within(dialog).findByRole('button', { name: /^Item status: Burger/ }))
    await user.click(await screen.findByRole('option', { name: 'Delivered' }))
    await waitFor(() => expect(writes(api.calls)).toHaveLength(1))
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Confirm' })).toBeEnabled())
    await user.click(within(dialog).getByRole('button', { name: 'Confirm' }))
    await dialogClosed()

    expect(writes(api.calls)[1]).toMatchObject({ method: 'PUT', body: { expectedUpdatedAt: '2026-10-01T12:50:00Z' } })
  })

  it('does not open the editor when the order cannot be read again', async () => {
    ordersApi(() => [order('ord-1')], ({ method, path }) => (method === 'GET' && path === '/v1/orders/ord-1' ? problem(500, 'INTERNAL_ERROR') : undefined))
    const error = vi.spyOn(toast, 'error')
    const user = userEvent.setup()
    renderOrders()

    await user.click(await screen.findByRole('button', { name: 'Edit order' }))
    await waitFor(() => expect(error).toHaveBeenCalledWith('Error loading orders.'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes an order into a sale with the payment method and refreshes orders and sales', async () => {
    let orders = [order('ord-1')]
    const api = ordersApi(() => orders, ({ method, path }) => {
      if (method !== 'POST' || path !== '/v1/orders/ord-1/close') return undefined
      orders = []
      return json(200, { order: order('ord-1', { status: 'CLOSED' }), sale: { id: 'sale-1' } })
    })
    const user = userEvent.setup()
    const { queryClient } = renderOrders()
    queryClient.setQueryData(['sales', 'list'], { items: [] })

    await user.click(await screen.findByRole('button', { name: 'Edit order' }))
    const dialog = await screen.findByRole('dialog')
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Payment method' }), 'PIX')
    await user.click(within(dialog).getByRole('button', { name: 'Close order' }))
    await user.click(await screen.findByRole('button', { name: 'Yes' }))
    await dialogClosed()

    expect(writes(api.calls)).toEqual([expect.objectContaining({ method: 'POST', path: '/v1/orders/ord-1/close', body: { paymentMethod: 'PIX' } })])
    expect(await screen.findByText('No orders found.')).toBeInTheDocument()
    expect(queryClient.getQueryState(['sales', 'list'])?.isInvalidated).toBe(true)
  })

  it('does not offer to close a delivery order (it closes on the deliveries board)', async () => {
    ordersApi(() => [order('ord-1', { isDelivery: true, deliveryAddress: 'Rua A, 10' })])
    const user = userEvent.setup()
    renderOrders()

    await user.click(await screen.findByRole('button', { name: 'Edit order' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).queryByRole('button', { name: 'Close order' })).not.toBeInTheDocument()
  })

  for (const [code, message] of [
    ['ORDER_ALREADY_CLOSED', 'This order has already been closed.'],
    ['DELIVERY_NOT_STARTED', 'Start the delivery before closing the order.'],
  ] as const) {
    it(`says why a close failed (${code}) and reloads the list`, async () => {
      const api = ordersApi(() => [order('ord-1')], ({ method }) => (method === 'POST' ? problem(409, code) : undefined))
      const error = vi.spyOn(toast, 'error')
      const user = userEvent.setup()
      renderOrders()

      await user.click(await screen.findByRole('button', { name: 'Edit order' }))
      const dialog = await screen.findByRole('dialog')
      const before = orderGets(api.calls).length
      await user.click(within(dialog).getByRole('button', { name: 'Close order' }))
      await user.click(await screen.findByRole('button', { name: 'Yes' }))

      await waitFor(() => expect(error).toHaveBeenCalledWith(message))
      await waitFor(() => expect(orderGets(api.calls).length).toBeGreaterThan(before))
      expect(writes(api.calls)[0].body).toEqual({})
    })
  }

  it('says why an item status change failed when the order is out for delivery', async () => {
    ordersApi(() => [order('ord-1')], ({ method }) => (method === 'PATCH' ? problem(409, 'ORDER_DELIVERING') : undefined))
    const error = vi.spyOn(toast, 'error')
    const user = userEvent.setup()
    renderOrders()

    await user.click(await screen.findByRole('button', { name: 'Edit order' }))
    await user.click(await screen.findByRole('button', { name: /^Item status: Fries/ }))
    await user.click(await screen.findByRole('option', { name: 'Ready to serve' }))
    await waitFor(() => expect(error).toHaveBeenCalledWith('This order is out for delivery and cannot be changed.'))
  })

  it('deletes an order after confirming', async () => {
    let orders = [order('ord-1')]
    const api = ordersApi(() => orders, ({ method, path }) => {
      if (method !== 'DELETE' || path !== '/v1/orders/ord-1') return undefined
      orders = []
      return noContent()
    })
    const user = userEvent.setup()
    renderOrders()

    await user.click(await screen.findByRole('button', { name: 'Delete order' }))
    expect(await screen.findByText('Are you sure you want to delete this order?')).toBeInTheDocument()
    await confirmDialog(user, 'Delete')

    expect(await screen.findByText('No orders found.')).toBeInTheDocument()
    expect(writes(api.calls).map((call) => `${call.method} ${call.path}`)).toEqual(['DELETE /v1/orders/ord-1'])
  })

  it('keeps the order when the delete is cancelled', async () => {
    const api = ordersApi(() => [order('ord-1')])
    const user = userEvent.setup()
    renderOrders()

    await user.click(await screen.findByRole('button', { name: 'Delete order' }))
    await confirmDialog(user, 'Cancel')
    await dialogClosed()
    expect(writes(api.calls)).toEqual([])
    expect(screen.getByText('Table 1')).toBeInTheDocument()
  })

  for (const [code, message] of [
    ['ORDER_NOT_OPEN', 'This order has already been closed.'],
    ['ORDER_DELIVERING', 'This order is out for delivery and cannot be changed.'],
    ['INTERNAL_ERROR', 'Error deleting order.'],
  ] as const) {
    it(`says why a delete failed (${code})`, async () => {
      ordersApi(() => [order('ord-1')], ({ method }) => (method === 'DELETE' ? problem(code === 'INTERNAL_ERROR' ? 500 : 409, code) : undefined))
      const error = vi.spyOn(toast, 'error')
      const user = userEvent.setup()
      renderOrders()

      await user.click(await screen.findByRole('button', { name: 'Delete order' }))
      await confirmDialog(user, 'Delete')
      await waitFor(() => expect(error).toHaveBeenCalledWith(message))
      await dialogClosed()
      await waitFor(() => expect(screen.getByRole('button', { name: 'Delete order' })).toBeEnabled())
    })
  }

  it('walks the /v1 cursor pages and numbers the rows across them', async () => {
    const first = Array.from({ length: 10 }, (_, index) => order(`ord-${index + 1}`, { customerName: `Table ${index + 1}` }))
    const api = mockApi((call) => {
      if (call.path !== '/v1/orders') return undefined
      return call.query.get('cursor') === 'c2'
        ? json(200, page([order('ord-11', { customerName: 'Table 11' })], null, 11))
        : json(200, page(first, 'c2', 11))
    })
    const user = userEvent.setup()
    renderOrders()

    expect(await screen.findByText('Page 1 of 2')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Next' }))
    const row = (await screen.findByText('Table 11')).closest('tr')!
    expect(within(row).getAllByRole('cell')[0]).toHaveTextContent('11')
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument()
    expect(orderGets(api.calls).at(-1)!.query.get('cursor')).toBe('c2')
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
  })

  it('applies the filters on Search only, with the totals in cents', async () => {
    const api = ordersApi(() => [order('ord-1')])
    const user = userEvent.setup()
    renderOrders()

    await screen.findByText('Table 1')
    await user.type(screen.getByLabelText('Customer / Table'), 'table')
    await user.type(screen.getByLabelText('Created by'), 'ana')
    await user.type(screen.getByLabelText('Minimum total'), '1250')
    expect(screen.getByLabelText('Minimum total')).toHaveValue('12.50')
    expect(orderGets(api.calls)).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: 'Search' }))
    await waitFor(() => expect(orderGets(api.calls)).toHaveLength(2))
    expect(Object.fromEntries(orderGets(api.calls)[1].query)).toEqual({
      status: 'open', customerName: 'table', sellerName: 'ana', minTotalCents: '1250', limit: '10',
    })

    // Search again with the same filters reloads the list.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Search' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'Search' }))
    await waitFor(() => expect(orderGets(api.calls)).toHaveLength(3))
  })

  it('clearing a total field removes that filter', async () => {
    const api = ordersApi(() => [order('ord-1')])
    const user = userEvent.setup()
    renderOrders()

    await screen.findByText('Table 1')
    const max = screen.getByLabelText('Maximum total')
    await user.type(max, '5000')
    expect(max).toHaveValue('50.00')
    await user.clear(max)
    expect(max).toHaveValue('')
    await user.type(screen.getByLabelText('Customer / Table'), 'table')
    await user.click(screen.getByRole('button', { name: 'Search' }))

    await waitFor(() => expect(orderGets(api.calls)).toHaveLength(2))
    expect(Object.fromEntries(orderGets(api.calls)[1].query)).toEqual({ status: 'open', customerName: 'table', limit: '10' })
  })

  it('a failed load after a filter change keeps the last rows; a failed Search warns', async () => {
    let fail = false
    mockApi((call) => {
      if (call.path !== '/v1/orders') return undefined
      return fail || call.query.get('customerName') ? problem(500, 'INTERNAL_ERROR') : json(200, page([order('ord-1')]))
    })
    const error = vi.spyOn(toast, 'error')
    const user = userEvent.setup()
    renderOrders()

    await screen.findByText('Table 1')
    fail = true
    await user.click(screen.getByRole('button', { name: 'Search' }))
    await waitFor(() => expect(error).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Search' })).toBeEnabled())
    fail = false
    await user.type(screen.getByLabelText('Customer / Table'), 'zz')
    await user.click(screen.getByRole('button', { name: 'Search' }))
    await waitFor(() => expect(error).toHaveBeenCalledTimes(2))
    expect(error).toHaveBeenLastCalledWith('Error loading orders.')
    expect(await screen.findByText('Table 1')).toBeInTheDocument()
    expect(screen.queryByText('No orders found.')).not.toBeInTheDocument()
  })

  it('warns once when the list cannot be loaded and shows the empty table', async () => {
    mockApi((call) => (call.path === '/v1/orders' ? problem(500, 'INTERNAL_ERROR') : undefined))
    const error = vi.spyOn(toast, 'error')
    renderOrders()

    expect(await screen.findByText('No orders found.')).toBeInTheDocument()
    await waitFor(() => expect(error).toHaveBeenCalledWith('Error loading orders.'))
    expect(error).toHaveBeenCalledTimes(1)
  })

  it('prints the order receipt from the row', async () => {
    ordersApi(() => [order('ord-1')])
    const print = stubPrint()
    const user = userEvent.setup()
    renderOrders()

    await user.click(await screen.findByRole('button', { name: 'Print order' }))
    const root = document.getElementById('receipt-print-root')!
    expect(root.textContent).toContain('Order #ord-1')
    expect(root.textContent).toContain('1x Burger')
    expect(root.textContent).toContain('R$30.00')
    await waitFor(() => expect(print).toHaveBeenCalledTimes(1))
    window.dispatchEvent(new Event('afterprint'))
    expect(document.getElementById('receipt-print-root')).toBeNull()
  })
})
