import { Route } from '@solidjs/router'
import { screen, waitFor, within } from '@solidjs/testing-library'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n/config'
import { json, mockApi, noContent } from '@/test/api'
import { resetAuthMocks, setMockUser } from '@/test/auth-mock'
import { renderDashboard } from '@/test/dashboard'
import OrdersPage from '@/pages/dashboard/OrdersPage'
import SalesPage from '@/pages/dashboard/SalesPage'

vi.mock('@/contexts/AuthContext', () => import('@/test/auth-mock'))

const establishment = { id: 'est-1', tradeName: 'Café da Nina', status: 'ACTIVE' as const, plan: 'PAID' as const, category: null, preferencesRevision: 0 }
const emptySales = { items: [], nextCursor: null, total: 0, summary: { count: 0, totalCents: 0 } }
const sale = {
  id: 'sale-7',
  customerName: 'Table 7',
  soldAt: '2026-08-28T12:00:00Z',
  totalCents: 10500,
  isCancelled: false,
  paymentMethod: 'PIX',
  orderId: null,
  serviceOrderId: null,
  seller: { id: 'user-1', name: 'Ana' },
  items: [{ id: 'line-1', productId: 'product-3', description: 'Burger', quantity: 1, unitPriceCents: 2500 }],
  serviceItems: [{ id: 'line-2', serviceId: 'svc-1', description: 'Tune-up', details: null, quantity: 1, unitPriceCents: 8000 }],
}

const renderAt = (path: string, page: () => ReturnType<typeof OrdersPage>) => renderDashboard(path, () => <Route path={path} component={page} />)

describe('orders and sales chrome', () => {
  beforeEach(async () => {
    resetAuthMocks()
    setMockUser({ role: 'OWNER', establishment })
    await i18n.changeLanguage('en')
  })
  afterEach(() => { vi.unstubAllGlobals() })

  it('renders translated order chrome and preserves the establishment name', async () => {
    mockApi(({ path }) => (path === '/v1/orders' ? json(200, { items: [], nextCursor: null, total: 0 }) : undefined))
    renderAt('/dashboard/orders', OrdersPage)

    expect(screen.getByRole('heading', { name: 'Orders — Café da Nina' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'New order' })).toBeInTheDocument()
    expect(screen.getByText('Recent orders')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Customer / Table' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Created by' })).toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Status' })).not.toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Date' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Total' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Actions' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('No orders found.')).toBeInTheDocument())
    expect(screen.queryByText('Nenhum pedido encontrado.')).not.toBeInTheDocument()
  })

  it('renders translated sales chrome and period summary', async () => {
    mockApi(({ path }) => (path === '/v1/sales' ? json(200, emptySales) : undefined))
    renderAt('/dashboard/sales', SalesPage)

    expect(screen.getByRole('heading', { name: 'Sales — Café da Nina' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'New sale' })).toBeInTheDocument()
    expect(screen.getByText('Sales for the period')).toBeInTheDocument()
    expect(screen.getByText('Total records: 0')).toBeInTheDocument()
    expect(screen.getByText('Period closing')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Customer / Table' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Created by' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Date' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Payment' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Total' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Actions' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('No sales found for this period.')).toBeInTheDocument())
    expect(screen.queryByText('Nenhuma venda encontrada no período.')).not.toBeInTheDocument()
  })

  it('does not expose item status controls while viewing a sale', async () => {
    mockApi(({ path }) => (path === '/v1/sales' ? json(200, { items: [sale], nextCursor: null, total: 1, summary: { count: 1, totalCents: 10500 } }) : undefined))
    const user = userEvent.setup()
    renderAt('/dashboard/sales', SalesPage)

    expect((await screen.findByRole('row', { name: /Table 7/ })).textContent).toContain('Tune-up (service)')
    await user.click(screen.getByRole('button', { name: 'View details' }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByDisplayValue('Table 7')).toBeInTheDocument()
    expect(dialog.textContent).toContain('Tune-up')
    expect(within(dialog).queryByRole('button', { name: /status/i })).not.toBeInTheDocument()
    expect(screen.queryByText('Requested')).not.toBeInTheDocument()
    expect(screen.queryByText('Delivered')).not.toBeInTheDocument()
  })
})

describe('sales from the /v1', () => {
  beforeEach(async () => {
    resetAuthMocks()
    setMockUser({ role: 'OWNER', establishment })
    await i18n.changeLanguage('en')
  })
  afterEach(() => { vi.unstubAllGlobals() })

  it('shows the total and the closing from summary, and pages with the cursor', async () => {
    const api = mockApi(({ path, query }) => {
      if (path !== '/v1/sales') return undefined
      return query.get('cursor') === 'c2'
        ? json(200, { items: [{ ...sale, id: 'sale-8', customerName: 'Table 8' }], nextCursor: null, total: 11, summary: { count: 11, totalCents: 123456 } })
        : json(200, { items: [sale], nextCursor: 'c2', total: 11, summary: { count: 11, totalCents: 123456 } })
    })
    const user = userEvent.setup()
    renderAt('/dashboard/sales', SalesPage)

    expect(await screen.findByText('Table 7')).toBeInTheDocument()
    expect(screen.getByText('Total records: 11')).toBeInTheDocument()
    expect(screen.getByText('R$1,234.56')).toBeInTheDocument()
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument()
    expect(screen.getByRole('row', { name: /Table 7/ })).toHaveTextContent('Pix')

    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(await screen.findByText('Table 8')).toBeInTheDocument()
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument()
    expect(api.to('/v1/sales').at(-1)!.query.get('cursor')).toBe('c2')
    // Row numbers go on from the first page.
    expect(screen.getByRole('row', { name: /Table 8/ })).toHaveTextContent(/^11/)
  })

  it('sends the period as from/to instants and the other filters on Search', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-01T15:00:00-03:00'))
    const api = mockApi(({ path }) => (path === '/v1/sales' ? json(200, emptySales) : undefined))
    const user = userEvent.setup()
    renderAt('/dashboard/sales', SalesPage)
    vi.useRealTimers()

    await waitFor(() => expect(api.to('/v1/sales')).toHaveLength(1))
    const first = Object.fromEntries(api.to('/v1/sales')[0].query)
    // The last 24 hours, in local time, to the end of the minute.
    expect(new Date(first.from).getTime()).toBe(new Date('2026-09-30T15:00:00-03:00').getTime())
    expect(new Date(first.to).getTime()).toBe(new Date('2026-10-01T15:00:59-03:00').getTime())

    await user.type(screen.getByLabelText('Customer / Table'), 'mesa')
    await user.type(screen.getByLabelText('Maximum total'), '2000')
    await user.click(screen.getByRole('button', { name: 'Search' }))

    await waitFor(() => expect(api.to('/v1/sales')).toHaveLength(2))
    const second = Object.fromEntries(api.to('/v1/sales')[1].query)
    expect(second).toEqual({ from: first.from, to: first.to, customerName: 'mesa', maxTotalCents: '2000', limit: '10' })
  })

  it('creates a sale with a client id, and cancels one after confirming', async () => {
    const api = mockApi((call) => {
      if (call.method === 'GET' && call.path === '/v1/sales') return json(200, { items: [sale], nextCursor: null, total: 1, summary: { count: 1, totalCents: 10500 } })
      if (call.method === 'POST' && call.path === '/v1/sales') return json(201, sale)
      if (call.method === 'POST' && call.path === '/v1/sales/sale-7/cancel') return noContent()
      if (call.path === '/v1/product-types') return json(200, [])
      if (call.path === '/v1/products') return json(200, { items: [{ id: 'product-3', name: 'Soda', priceCents: 600, ingredients: null, imageUrl: null, updatedAt: '2026-01-01T00:00:00Z', productType: null }], nextCursor: null, total: 1 })
      return undefined
    })
    const user = userEvent.setup()
    renderAt('/dashboard/sales', SalesPage)

    await user.click(await screen.findByRole('button', { name: 'New sale' }))
    let dialog = await screen.findByRole('dialog')
    await user.click(await within(dialog).findByText('Soda'))
    await user.click(within(dialog).getAllByText('Soda')[0])
    await user.click(within(dialog).getByRole('button', { name: 'Confirm' }))
    await waitFor(() => expect(api.calls.filter((call) => call.method === 'POST' && call.path === '/v1/sales')).toHaveLength(1))
    // Same product twice: one line with quantity 2 (mergeSameProducts).
    expect(api.calls.find((call) => call.path === '/v1/sales' && call.method === 'POST')!.body).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      items: [{ productId: 'product-3', quantity: 2 }],
    })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    await user.click(await screen.findByRole('button', { name: 'View details' }))
    dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel sale' }))
    await waitFor(() => expect(screen.getAllByRole('dialog')).toHaveLength(2))
    await user.click(within(screen.getAllByRole('dialog').at(-1)!).getByRole('button', { name: 'Cancel sale' }))
    await waitFor(() => expect(api.to('/v1/sales/sale-7/cancel')).toHaveLength(1))
  })

  it('prints the sale receipt with the services and the payment method', async () => {
    mockApi(({ path }) => (path === '/v1/sales' ? json(200, { items: [sale], nextCursor: null, total: 1, summary: { count: 1, totalCents: 10500 } }) : undefined))
    window.print = vi.fn()
    const user = userEvent.setup()
    renderAt('/dashboard/sales', SalesPage)

    await user.click(await screen.findByRole('button', { name: 'Print sale' }))
    const root = document.getElementById('receipt-print-root')!
    expect(root.querySelector('.receipt__title')?.textContent).toBe('Sale #sale-7')
    expect([...root.querySelectorAll('.receipt__item')].map((item) => item.textContent)).toEqual(['1x BurgerR$25.00', '1x Tune-upR$80.00'])
    expect(root.querySelector('.receipt__total')?.textContent).toBe('TotalR$105.00')
    expect(root.textContent).toContain('Payment method: Pix')
    window.dispatchEvent(new Event('afterprint'))
  })
})
