import { Route } from '@solidjs/router'
import { screen, waitFor, within } from '@solidjs/testing-library'
import userEvent from '@testing-library/user-event'
import { toast } from 'solid-sonner'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n/config'
import { json, mockApi, noContent, problem, type RecordedCall } from '@/test/api'
import { resetAuthMocks, setMockUser } from '@/test/auth-mock'
import { dialogClosed, renderDashboard } from '@/test/dashboard'
import SalesPage from '@/pages/dashboard/SalesPage'

vi.mock('@/contexts/AuthContext', () => import('@/test/auth-mock'))

const sale = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  customerName: 'Table 7',
  soldAt: '2026-10-01T12:00:00Z',
  totalCents: 2500,
  isCancelled: false,
  paymentMethod: 'PIX',
  orderId: null,
  serviceOrderId: null,
  seller: { id: 'usr-1', name: 'Ana' },
  items: [{ id: 'si-1', productId: 'product-3', description: 'Burger', quantity: 1, unitPriceCents: 2500 }],
  serviceItems: [],
  ...extra,
})
const page = (items: unknown[], extra: { nextCursor?: string | null; total?: number; summaryCents?: number } = {}) => ({
  items,
  nextCursor: extra.nextCursor ?? null,
  total: extra.total ?? items.length,
  summary: { count: extra.total ?? items.length, totalCents: extra.summaryCents ?? 0 },
})
const catalogProduct = { id: 'product-3', name: 'Soda', priceCents: 600, ingredients: null, imageUrl: null, updatedAt: '2026-01-01T00:00:00Z', productType: null }

type Handler = (call: RecordedCall) => Response | undefined
function salesApi(list: () => ReturnType<typeof page>, handler: Handler = () => undefined) {
  return mockApi((call) => {
    const answer = handler(call)
    if (answer) return answer
    if (call.method === 'GET' && call.path === '/v1/sales') return json(200, list())
    if (call.path === '/v1/product-types') return json(200, [])
    if (call.path === '/v1/products') return json(200, { items: [catalogProduct], nextCursor: null, total: 1 })
    return undefined
  })
}

const renderSales = () => renderDashboard('/dashboard/sales', () => <Route path="/dashboard/sales" component={SalesPage} />)
const saleGets = (calls: RecordedCall[]) => calls.filter((call) => call.method === 'GET' && call.path === '/v1/sales')
const writes = (calls: RecordedCall[]) => calls.filter((call) => call.method !== 'GET')

// happy-dom has no window.print.
const stubPrint = () => {
  const print = vi.fn()
  window.print = print
  return print
}

describe('SalesPage', () => {
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

  it('renders translated sales chrome and period summary', async () => {
    salesApi(() => page([]))
    renderSales()

    expect(screen.getByRole('heading', { name: 'Sales — Café da Nina' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'New sale' })).toBeInTheDocument()
    expect(screen.getByText('Sales for the period')).toBeInTheDocument()
    expect(screen.getByText('Period closing')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Customer / Table' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Created by' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Date' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Payment' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Total' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Actions' })).toBeInTheDocument()
    expect(await screen.findByText('No sales found for this period.', {}, { timeout: 3000 })).toBeInTheDocument()
    expect(screen.getByText('Total records: 0')).toBeInTheDocument()
    expect(screen.queryByText('Nenhuma venda encontrada no período.')).not.toBeInTheDocument()
  })

  it('loads the last 24 h and shows the closing of the whole filter from summary', async () => {
    const api = salesApi(() => page([sale('sale-1')], { nextCursor: 'c2', total: 31, summaryCents: 123456 }))
    renderSales()

    const row = (await screen.findByText('Table 7')).closest('tr')!
    // summary, not the sum of the page (R$25.00)
    expect(screen.getByText('R$1,234.56')).toBeInTheDocument()
    expect(screen.getByText('Total records: 31')).toBeInTheDocument()
    expect(screen.getByText('Page 1 of 4')).toBeInTheDocument()
    expect(within(row).getByText('Pix')).toBeInTheDocument()
    expect(within(row).getByText('Ana')).toBeInTheDocument()
    expect(within(row).getByText('R$25.00')).toBeInTheDocument()

    const query = saleGets(api.calls)[0].query
    const from = new Date(query.get('from')!).getTime()
    expect(Math.abs(Date.now() - 24 * 60 * 60 * 1000 - from)).toBeLessThan(2 * 60_000)
    // The untouched end is open: later sales (here or through SSE) still show.
    expect(query.has('to')).toBe(false)
    expect(screen.getByLabelText('End date')).not.toHaveValue('')
    expect(screen.getByLabelText('End time')).not.toHaveValue('')
    expect(query.get('limit')).toBe('10')
    expect(query.has('cursor')).toBe(false)
  })

  it('names services in the summary line and says when the payment is unknown', async () => {
    salesApi(() => page([sale('sale-1', {
      paymentMethod: null,
      serviceItems: [{ id: 'ssi-1', serviceId: 'svc-1', description: 'Tune-up', details: null, quantity: 1, unitPriceCents: 8000 }],
    })]))
    renderSales()

    const row = (await screen.findByText('Table 7')).closest('tr')!
    expect(within(row).getByText('1x Burger, 1x Tune-up (service)')).toBeInTheDocument()
    expect(within(row).getByText('Not informed')).toBeInTheDocument()
  })

  it('does not expose item status controls while viewing a sale', async () => {
    salesApi(() => page([sale('sale-1', {
      serviceItems: [{ id: 'ssi-1', serviceId: 'svc-1', description: 'Tune-up', details: null, quantity: 1, unitPriceCents: 8000 }],
    })]))
    const user = userEvent.setup()
    renderSales()

    await user.click(await screen.findByRole('button', { name: 'View details' }, { timeout: 3000 }))
    const dialog = await screen.findByRole('dialog', {}, { timeout: 3000 })
    expect(within(dialog).getByText('Sale details')).toBeInTheDocument()
    expect(within(dialog).getByRole('textbox', { name: 'Customer / Table' })).toHaveValue('Table 7')
    expect(dialog.textContent).toContain('Tune-up')
    expect(dialog.textContent).toContain('Burger')
    expect(within(dialog).queryByRole('button', { name: /^Item status/ })).not.toBeInTheDocument()
    expect(within(dialog).queryByText('Delivered')).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'Confirm' })).not.toBeInTheDocument()
  })

  it('cancels a sale after confirming and reloads the list', async () => {
    let sales = [sale('sale-1')]
    const api = salesApi(() => page(sales), ({ method, path }) => {
      if (method !== 'POST' || path !== '/v1/sales/sale-1/cancel') return undefined
      sales = []
      return noContent()
    })
    const user = userEvent.setup()
    renderSales()

    await user.click(await screen.findByRole('button', { name: 'View details' }, { timeout: 3000 }))
    await user.click(within(await screen.findByRole('dialog', {}, { timeout: 3000 })).getByRole('button', { name: 'Cancel sale' }))
    expect(await screen.findByText('Are you sure you want to cancel this sale?')).toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: 'Cancel sale' }))
    await dialogClosed()

    expect(writes(api.calls).map((call) => `${call.method} ${call.path}`)).toEqual(['POST /v1/sales/sale-1/cancel'])
    expect(await screen.findByText('No sales found for this period.')).toBeInTheDocument()
    // The dialog closed on the details: it never turned into a new sale.
    expect(api.calls.some((call) => call.path === '/v1/products')).toBe(false)
  })

  for (const [status, code] of [[404, 'SALE_NOT_FOUND'], [500, 'INTERNAL_ERROR']] as const) {
    it(`says a cancel failed (${code}) and keeps the details open`, async () => {
      salesApi(() => page([sale('sale-1')]), ({ method }) => (method === 'POST' ? problem(status, code) : undefined))
      const error = vi.spyOn(toast, 'error')
      const user = userEvent.setup()
      renderSales()

      await user.click(await screen.findByRole('button', { name: 'View details' }, { timeout: 3000 }))
      await user.click(within(await screen.findByRole('dialog', {}, { timeout: 3000 })).getByRole('button', { name: 'Cancel sale' }))
      const confirmDialog = (await screen.findByText('Are you sure you want to cancel this sale?')).closest('[role="dialog"]') as HTMLElement
      await user.click(within(confirmDialog).getByRole('button', { name: 'Cancel sale' }))

      await waitFor(() => expect(error).toHaveBeenCalledWith('Error cancelling sale.'))
      await waitFor(() => expect(screen.getByText('Sale details')).toBeInTheDocument())
    })
  }

  it('creates a sale with a client id and merged products', async () => {
    let sales: unknown[] = []
    const api = salesApi(() => page(sales), ({ method, path, body }) => {
      if (method !== 'POST' || path !== '/v1/sales') return undefined
      sales = [sale((body as { id: string }).id, { customerName: 'Table 9' })]
      return json(201, sales[0])
    })
    const user = userEvent.setup()
    renderSales()

    await screen.findByText('No sales found for this period.', {}, { timeout: 3000 })
    await user.click(screen.getByRole('button', { name: 'New sale' }))
    const dialog = await screen.findByRole('dialog', {}, { timeout: 3000 })
    await user.type(within(dialog).getByRole('textbox', { name: 'Customer / Table' }), 'Table 9')
    await user.click(await within(dialog).findByText('Soda'))
    await user.click(within(dialog).getAllByText('Soda')[0])
    await user.click(within(dialog).getByRole('button', { name: 'Confirm' }))
    await dialogClosed()

    const [post] = writes(api.calls)
    const id = (post.body as { id: string }).id
    expect(id).toMatch(/^[0-9a-f-]{36}$/)
    expect(post.body).toEqual({ id, customerName: 'Table 9', items: [{ productId: 'product-3', quantity: 2 }] })
    expect(await screen.findByText('Table 9')).toBeInTheDocument()
  })

  // The first POST reaches the API but its answer is lost (500 here); the
  // retry with the same id gets the recorded sale back (200).
  const retryApi = (recorded: () => unknown[]) => {
    let attempts = 0
    let sales: unknown[] = []
    const api = salesApi(() => page(sales), ({ method, path, body }) => {
      if (method !== 'POST' || path !== '/v1/sales') return undefined
      attempts += 1
      const id = (body as { id: string }).id
      sales = recorded().map((entry) => ({ ...(entry as object), id }))
      return attempts === 1 ? problem(500, 'INTERNAL_ERROR') : json(200, sales[0])
    })
    return api
  }
  const firstAttempt = async (user: ReturnType<typeof userEvent.setup>, api: { calls: RecordedCall[] }) => {
    await screen.findByText('No sales found for this period.', {}, { timeout: 3000 })
    await user.click(screen.getByRole('button', { name: 'New sale' }))
    const dialog = await screen.findByRole('dialog', {}, { timeout: 3000 })
    const name = within(dialog).getByRole('textbox', { name: 'Customer / Table' })
    await user.type(name, 'Table 9')
    await user.click(await within(dialog).findByText('Soda'))
    await user.click(within(dialog).getByRole('button', { name: 'Confirm' }))
    await waitFor(() => expect(writes(api.calls)).toHaveLength(1))
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Confirm' })).toBeEnabled())
    return { dialog, name }
  }

  it('a failed create keeps the form; the retry reuses the id and succeeds as usual', async () => {
    const api = retryApi(() => [sale('x', { customerName: 'Table 9' })])
    const error = vi.spyOn(toast, 'error')
    const warning = vi.spyOn(toast, 'warning')
    const user = userEvent.setup()
    renderSales()

    const { dialog } = await firstAttempt(user, api)
    expect(error).toHaveBeenCalledWith('Error creating sale.')
    await user.click(within(dialog).getByRole('button', { name: 'Confirm' }))
    await dialogClosed()

    const [first, second] = writes(api.calls)
    expect(second.body).toEqual(first.body)
    expect(warning).not.toHaveBeenCalled()
    expect(await screen.findByText('Table 9')).toBeInTheDocument()
  })

  it('a retry with an edited form keeps the recorded sale and warns that the change was not saved', async () => {
    const api = retryApi(() => [sale('x', { customerName: 'Table 9' })])
    const warning = vi.spyOn(toast, 'warning')
    const user = userEvent.setup()
    renderSales()

    const { dialog, name } = await firstAttempt(user, api)
    await user.clear(name)
    await user.type(name, 'Table 10')
    await user.click(within(dialog).getByRole('button', { name: 'Confirm' }))
    await dialogClosed()

    const calls = writes(api.calls)
    // Nothing cancelled, nothing created again.
    expect(calls.map((call) => `${call.method} ${call.path}`)).toEqual(['POST /v1/sales', 'POST /v1/sales'])
    expect((calls[1].body as { id: string }).id).toBe((calls[0].body as { id: string }).id)
    expect(warning).toHaveBeenCalledWith('This sale had already been registered; the change was not saved.')
    expect(await screen.findByText('Table 9')).toBeInTheDocument()
  })

  it('walks the /v1 cursor pages', async () => {
    const first = Array.from({ length: 10 }, (_, index) => sale(`sale-${index + 1}`, { customerName: `Table ${index + 1}` }))
    const api = mockApi((call) => {
      if (call.path !== '/v1/sales') return undefined
      return call.query.get('cursor') === 'c2'
        ? json(200, page([sale('sale-11', { customerName: 'Table 11' })], { total: 11, summaryCents: 27500 }))
        : json(200, page(first, { nextCursor: 'c2', total: 11, summaryCents: 27500 }))
    })
    const user = userEvent.setup()
    renderSales()

    expect(await screen.findByText('Page 1 of 2')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Next' }))
    const row = (await screen.findByText('Table 11')).closest('tr')!
    expect(within(row).getAllByRole('cell')[0]).toHaveTextContent('11')
    expect(saleGets(api.calls).at(-1)!.query.get('cursor')).toBe('c2')
    expect(screen.getByText('R$275.00')).toBeInTheDocument()
  })

  it('applies the filters on Search only: instants, seller name and cents', async () => {
    const api = salesApi(() => page([sale('sale-1')]))
    const user = userEvent.setup()
    renderSales()

    await screen.findByText('Table 7')
    const setInput = (label: string, value: string) => {
      const input = screen.getByLabelText(label) as HTMLInputElement
      input.value = value
      input.dispatchEvent(new InputEvent('input', { bubbles: true }))
    }
    setInput('Start date', '2026-10-01')
    setInput('Start time', '08:00')
    setInput('End date', '2026-10-01')
    setInput('End time', '18:30')
    await user.type(screen.getByLabelText('Customer / Table'), 'table')
    await user.type(screen.getByLabelText('Created by'), 'ana')
    await user.type(screen.getByLabelText('Maximum total'), '5000')
    expect(saleGets(api.calls)).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: 'Search' }))
    await waitFor(() => expect(saleGets(api.calls)).toHaveLength(2))
    expect(Object.fromEntries(saleGets(api.calls)[1].query)).toEqual({
      from: new Date('2026-10-01T08:00:00').toISOString(),
      to: new Date('2026-10-01T18:30:59.999').toISOString(),
      customerName: 'table',
      sellerName: 'ana',
      maxTotalCents: '5000',
      limit: '10',
    })
  })

  it('a failed load after a filter change keeps the last rows and summary, and warns', async () => {
    const api = mockApi((call) => {
      if (call.path !== '/v1/sales') return undefined
      return call.query.get('customerName') ? problem(500, 'INTERNAL_ERROR') : json(200, page([sale('sale-1')], { total: 31, summaryCents: 123456 }))
    })
    const error = vi.spyOn(toast, 'error')
    const user = userEvent.setup()
    renderSales()

    await screen.findByText('Table 7')
    await user.type(screen.getByLabelText('Customer / Table'), 'zz')
    await user.click(screen.getByRole('button', { name: 'Search' }))
    await waitFor(() => expect(error).toHaveBeenCalledWith('Error loading sales.'))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Search' })).toBeEnabled())
    expect(saleGets(api.calls).at(-1)!.query.get('customerName')).toBe('zz')
    // After the skeleton's minimum time, the last rows are back.
    expect(await screen.findByText('Table 7')).toBeInTheDocument()
    expect(screen.getByText('Total records: 31')).toBeInTheDocument()
    expect(screen.getByText('R$1,234.56')).toBeInTheDocument()
    expect(screen.queryByText('No sales found for this period.')).not.toBeInTheDocument()
  })

  it('Search with the same filters goes back to page 1 and asks the API again', async () => {
    const first = Array.from({ length: 10 }, (_, index) => sale(`sale-${index + 1}`, { customerName: `Table ${index + 1}` }))
    const api = mockApi((call) => {
      if (call.path !== '/v1/sales') return undefined
      return call.query.get('cursor') === 'c2'
        ? json(200, page([sale('sale-11', { customerName: 'Table 11' })], { total: 11 }))
        : json(200, page(first, { nextCursor: 'c2', total: 11 }))
    })
    const user = userEvent.setup()
    renderSales()

    await user.click(await screen.findByRole('button', { name: 'Next' }, { timeout: 3000 }))
    await screen.findByText('Table 11')
    const before = saleGets(api.calls).length
    await user.click(screen.getByRole('button', { name: 'Search' }))
    await waitFor(() => expect(saleGets(api.calls).length).toBeGreaterThan(before))
    expect(await screen.findByText('Page 1 of 2')).toBeInTheDocument()
    // One request: the reload joins the fetch the page change started.
    expect(saleGets(api.calls).length).toBe(before + 1)
    expect(saleGets(api.calls).at(-1)!.query.has('cursor')).toBe(false)
    expect(await screen.findByText('Page 1 of 2')).toBeInTheDocument()
  })

  it('a failed explicit Search with rows on screen still warns', async () => {
    let fail = false
    mockApi((call) => (call.path === '/v1/sales' ? (fail ? problem(500, 'INTERNAL_ERROR') : json(200, page([sale('sale-1')]))) : undefined))
    const error = vi.spyOn(toast, 'error')
    const user = userEvent.setup()
    renderSales()

    await screen.findByText('Table 7')
    fail = true
    await user.click(screen.getByRole('button', { name: 'Search' }))
    await waitFor(() => expect(error).toHaveBeenCalledWith('Error loading sales.'))
    expect(error).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('Table 7')).toBeInTheDocument()
  })

  it('warns once when the first load fails and shows the empty table', async () => {
    mockApi((call) => (call.path === '/v1/sales' ? problem(500, 'INTERNAL_ERROR') : undefined))
    const error = vi.spyOn(toast, 'error')
    renderSales()

    expect(await screen.findByText('No sales found for this period.', {}, { timeout: 3000 })).toBeInTheDocument()
    await waitFor(() => expect(error).toHaveBeenCalledWith('Error loading sales.'))
    expect(error).toHaveBeenCalledTimes(1)
  })

  it('prints the sale receipt with its services and the payment method', async () => {
    salesApi(() => page([sale('sale-1', {
      serviceItems: [{ id: 'ssi-1', serviceId: 'svc-1', description: 'Tune-up', details: null, quantity: 1, unitPriceCents: 8000 }],
      totalCents: 10500,
    })]))
    const print = stubPrint()
    const user = userEvent.setup()
    renderSales()

    await user.click(await screen.findByRole('button', { name: 'Print sale' }))
    const root = document.getElementById('receipt-print-root')!
    expect(root.textContent).toContain('Sale #sale-1')
    expect(root.textContent).toContain('1x Burger')
    expect(root.textContent).toContain('1x Tune-up')
    expect(root.textContent).toContain('R$105.00')
    expect(root.textContent).toContain('Payment method: Pix')
    await waitFor(() => expect(print).toHaveBeenCalledTimes(1))
    window.dispatchEvent(new Event('afterprint'))
    expect(document.getElementById('receipt-print-root')).toBeNull()
  })

  it('a refetch updates the rows in place', async () => {
    let sales = [sale('sale-1')]
    const api = salesApi(() => page(sales))
    const { queryClient } = renderSales()

    const row = (await screen.findByText('Table 7')).closest('tr')!
    sales = [sale('sale-1', { customerName: 'Table 7A' })]
    const before = saleGets(api.calls).length
    await queryClient.invalidateQueries({ queryKey: ['sales'] })
    await waitFor(() => expect(saleGets(api.calls).length).toBeGreaterThan(before))
    expect(await within(row).findByText('Table 7A')).toBeInTheDocument()
    expect(screen.getByText('Table 7A').closest('tr')).toBe(row)
  })
})
