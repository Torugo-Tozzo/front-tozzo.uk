import { expect, test, type Page, type Route } from '@playwright/test'
import { canonical, FIXED_NOW } from '../../e2e/visual/data/canonical'
import { problem, toV1 } from '../../e2e/visual/data/v1'
import { mockV1Api } from './visual/support/mock-v1'

// Operation screens of the Solid app (plan S4) against the toV1() dataset:
// what each write sends to the /v1 and what the screen does with the answer.

const API = 'api.visual.test'

interface Call { method: string; path: string; query: URLSearchParams; body: unknown }
type Reply = { status: number; body?: unknown } | undefined
type V1Item = { id: string; productId: string; productName: string; quantity: number; unitPriceCents: number; status: string; kitchenReadyAt: string | null }
type V1Order = { id: string; customerName: string | null; status: string; isDelivery: boolean; deliveryAddress: string | null; totalCents: number; updatedAt: string; items: V1Item[] } & Record<string, unknown>

/**
 * Answers the writes (and any GET it wants) before the toV1() mock, which only
 * reads; `reply` returning undefined hands the request back to it.
 */
async function writes(page: Page, reply: (call: Call) => Reply) {
  const calls: Call[] = []
  await page.route((url) => url.hostname === API, async (route: Route) => {
    const request = route.request()
    if (request.method() === 'OPTIONS') return route.fallback()
    const url = new URL(request.url())
    const call = { method: request.method(), path: url.pathname, query: url.searchParams, body: request.postDataJSON?.() ?? null }
    const answer = reply(call)
    if (!answer) return route.fallback()
    if (call.method !== 'GET') calls.push(call)
    const origin = request.headers().origin ?? '*'
    const isProblem = answer.status >= 400
    return route.fulfill({
      status: answer.status,
      contentType: isProblem ? 'application/problem+json' : 'application/json',
      headers: { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Credentials': 'true' },
      body: answer.body === undefined ? '' : JSON.stringify(answer.body),
    })
  })
  return calls
}

const v1 = toV1(canonical)
const openOrderList = () => structuredClone((v1({ method: 'GET', path: '/v1/orders', query: new URLSearchParams() })!.body as { items: V1Order[] }).items)
const productById = (id: string) => canonical.products.find((item) => item.id === id)!
const withItems = (order: V1Order, items: { id?: string; productId: string; quantity: number }[], fresh: () => string): V1Order => {
  const next = items.map((entry) => {
    const existing = order.items.find((item) => item.id === entry.id)
    const product = productById(entry.productId)
    return existing
      ? { ...existing, quantity: entry.quantity, status: existing.quantity === entry.quantity ? existing.status : 'IN_PREPARATION' }
      : { id: fresh(), productId: product.id, productName: product.name, quantity: entry.quantity, unitPriceCents: product.priceCents, status: 'IN_PREPARATION', kitchenReadyAt: null }
  })
  return { ...order, items: next, totalCents: next.reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0), updatedAt: '2026-10-01T18:00:00.000Z' }
}

/** A stateful /v1 orders API: the list, one order, create, edit, close and delete. */
async function ordersBackend(page: Page, options: { closeError?: string; deleteError?: string } = {}) {
  let orders = openOrderList()
  let counter = 0
  const fresh = () => `ori-new-${++counter}`
  const page1 = () => ({ status: 200, body: { items: orders, nextCursor: null, total: orders.length } })
  await mockV1Api(page, { role: 'OWNER' })
  const calls = await writes(page, ({ method, path, body }) => {
    if (method === 'GET' && path === '/v1/orders') return page1()
    const match = /^\/v1\/orders\/([^/]+)(\/close)?$/.exec(path)
    const found = match ? orders.find((item) => item.id === match[1]) : undefined
    if (method === 'GET' && match && !match[2]) return found ? { status: 200, body: found } : problem(404, 'ORDER_NOT_FOUND')
    if (method === 'POST' && path === '/v1/orders') {
      const input = body as { id: string; customerName?: string; isDelivery: boolean; deliveryAddress?: string; items: { productId: string; quantity: number }[] }
      const base: V1Order = {
        ...orders[0], id: input.id, customerName: input.customerName ?? null, status: 'OPEN', isDelivery: input.isDelivery,
        deliveryAddress: input.deliveryAddress ?? null, delivery: null, seller: { id: 'usr-owner', name: 'Victor Tozzo' },
        openedAt: '2026-10-01T18:00:00.000Z', items: [],
      }
      orders = [withItems(base, input.items, fresh), ...orders]
      return { status: 201, body: orders[0] }
    }
    if (method === 'PUT' && found) {
      const input = body as { expectedUpdatedAt?: string; customerName: string; items: { id?: string; productId: string; quantity: number }[] }
      // The version the editor read (API 57568ec).
      if (!input.expectedUpdatedAt) return problem(422, 'ORDER_VERSION_INVALID')
      if (input.expectedUpdatedAt !== found.updatedAt) return problem(409, 'ORDER_CONFLICT')
      const updated = { ...withItems(found, input.items, fresh), customerName: input.customerName || null }
      orders = orders.map((item) => (item.id === found.id ? updated : item))
      return { status: 200, body: updated }
    }
    if (method === 'POST' && match?.[2] && found) {
      if (options.closeError) return problem(409, options.closeError)
      orders = orders.filter((item) => item.id !== found.id)
      const payment = (body as { paymentMethod?: string }).paymentMethod ?? null
      return { status: 200, body: { order: { ...found, status: 'CLOSED' }, sale: { id: 'sale-new', orderId: found.id, paymentMethod: payment, totalCents: found.totalCents } } }
    }
    if (method === 'DELETE' && found) {
      if (options.deleteError) return problem(409, options.deleteError)
      orders = orders.filter((item) => item.id !== found.id)
      return { status: 204 }
    }
    return undefined
  })
  /** Another device edits an order: new version, new items. */
  const changeElsewhere = (id: string, items: { id?: string; productId: string; quantity: number }[]) => {
    orders = orders.map((item) => (item.id === id ? { ...withItems(item, items, fresh), updatedAt: '2026-10-01T18:10:00.000Z' } : item))
  }
  return Object.assign(calls, { changeElsewhere })
}

const dialog = (page: Page) => page.getByRole('dialog')
const main = (page: Page) => page.locator('main')
const row = (page: Page, name: string | RegExp) => main(page).getByRole('row', { name })
// The first visit compiles the page chunk on a cold dev server: allow for it.
const openOrders = async (page: Page) => {
  await page.goto('/dashboard/orders')
  await expect(row(page, /Mesa 3/)).toBeVisible({ timeout: 20_000 })
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('tozzo.locale', 'pt-BR'))
})

test('orders: create, edit items and close with a payment method', async ({ page }) => {
  // Three dialogs in a row: more than the default 30 s on a loaded runner.
  test.setTimeout(60_000)
  const calls = await ordersBackend(page)
  await openOrders(page)

  // Create
  await page.getByRole('button', { name: 'Novo pedido' }).click()
  await dialog(page).getByLabel('Cliente / Mesa').fill('Mesa 12')
  // The catalog is paged on the server (20 a time): search for the product.
  await dialog(page).getByPlaceholder('Buscar produto...').fill('salada')
  await dialog(page).getByText('X-Salada', { exact: true }).click()
  await dialog(page).getByRole('button', { name: 'Confirmar' }).click()
  await expect(dialog(page)).toBeHidden()
  await expect(row(page, /Mesa 12/)).toContainText('1x X-Salada')
  const created = calls.find((call) => call.method === 'POST')!.body as { id: string }
  expect(created.id).toMatch(/^[0-9a-f-]{36}$/)
  expect(created).toEqual({ id: created.id, customerName: 'Mesa 12', isDelivery: false, items: [{ productId: 'prd-002', quantity: 1 }] })

  // Edit: one more X-Burger, the delivered item out
  await row(page, /Mesa 3/).getByRole('button', { name: 'Editar pedido' }).click()
  await expect(dialog(page).getByRole('heading', { name: 'Editar pedido (adicionar itens)' })).toBeVisible()
  await expect(dialog(page).getByLabel('Cliente / Mesa')).toHaveValue('Mesa 3')
  await dialog(page).getByRole('button', { name: 'Aumentar quantidade' }).first().click()
  await dialog(page).getByRole('button', { name: 'Remover item' }).nth(2).click()
  await dialog(page).getByRole('button', { name: 'Confirmar' }).click()
  await expect(dialog(page)).toBeHidden()
  const put = calls.find((call) => call.method === 'PUT')!
  expect(put.path).toBe('/v1/orders/ord-001')
  expect(put.body).toMatchObject({ customerName: 'Mesa 3', isDelivery: false, items: [{ id: 'ori-001-1', productId: 'prd-001', quantity: 3 }, { id: 'ori-001-2' }] })
  expect((put.body as { items: unknown[] }).items).toHaveLength(2)
  await expect(row(page, /Mesa 3/)).toContainText('3x X-Burger')

  // Close with Pix: the order leaves the open list
  await row(page, /Mesa 3/).getByRole('button', { name: 'Editar pedido' }).click()
  await dialog(page).getByLabel('Método de pagamento').selectOption('PIX')
  await dialog(page).getByRole('button', { name: 'Fechar pedido' }).click()
  await page.getByRole('button', { name: 'Sim' }).click()
  await expect(dialog(page)).toHaveCount(0)
  await expect(row(page, /Mesa 3/)).toHaveCount(0)
  expect(calls.filter((call) => call.path === '/v1/orders/ord-001/close').map((call) => call.body)).toEqual([{ paymentMethod: 'PIX' }])
})

test('orders: an edit that lost a version race reloads the order and saves on the new version', async ({ page }) => {
  const backend = await ordersBackend(page)
  await openOrders(page)
  await row(page, /Mesa 3/).getByRole('button', { name: 'Editar pedido' }).click()
  await expect(dialog(page).getByLabel('Cliente / Mesa')).toHaveValue('Mesa 3')

  // Someone else takes the delivered item out and adds a Suco.
  backend.changeElsewhere('ord-001', [{ id: 'ori-001-1', productId: 'prd-001', quantity: 2 }, { id: 'ori-001-2', productId: 'prd-009', quantity: 1 }, { productId: 'prd-021', quantity: 1 }])
  await dialog(page).getByRole('button', { name: 'Aumentar quantidade' }).first().click()
  await dialog(page).getByRole('button', { name: 'Confirmar' }).click()

  await expect(page.getByText('Este pedido foi alterado em outro lugar. Confira os itens atualizados e salve de novo.')).toBeVisible()
  await expect(dialog(page)).toBeVisible()
  const selected = dialog(page).locator('div.space-y-4', { has: page.getByRole('heading', { name: 'Itens selecionados' }) })
  // The order as it is now: three lines, the unsaved +1 gone.
  await expect(selected.getByRole('button', { name: 'Remover item' })).toHaveCount(3)
  await expect(selected.getByText(/^2 x /).first()).toBeVisible()

  await dialog(page).getByRole('button', { name: 'Confirmar' }).click()
  await expect(dialog(page)).toBeHidden()
  const puts = backend.filter((call) => call.method === 'PUT').map((call) => call.body as { expectedUpdatedAt: string; items: unknown[] })
  expect(puts).toHaveLength(2)
  expect(puts[1].expectedUpdatedAt).toBe('2026-10-01T18:10:00.000Z')
  expect(puts[1].items).toHaveLength(3)
})

test('orders: a close the /v1 refuses keeps the order and says why', async ({ page }) => {
  await ordersBackend(page, { closeError: 'ORDER_ALREADY_CLOSED' })
  await openOrders(page)
  await row(page, /Mesa 7/).getByRole('button', { name: 'Editar pedido' }).click()
  await dialog(page).getByRole('button', { name: 'Fechar pedido' }).click()
  await page.getByRole('button', { name: 'Sim' }).click()
  await expect(page.getByText('Este pedido já foi fechado.')).toBeVisible()
  await expect(dialog(page).getByRole('button', { name: 'Fechar pedido' })).toBeEnabled()
})

test('orders: delete after confirming, and a delivery out on the road cannot be touched', async ({ page }) => {
  const calls = await ordersBackend(page)
  await openOrders(page)

  const delivering = row(page, /Camila Duarte/)
  await expect(delivering).toContainText('Entregando: Av. Paulista')
  await expect(delivering.getByRole('button', { name: 'Editar pedido' })).toBeDisabled()
  await expect(delivering.getByRole('button', { name: 'Excluir pedido' })).toBeDisabled()

  await row(page, /Balcão/).getByRole('button', { name: 'Excluir pedido' }).click()
  await expect(page.getByText('Tem certeza que deseja excluir este pedido?')).toBeVisible()
  await dialog(page).getByRole('button', { name: 'Excluir' }).click()
  await expect(row(page, /Balcão/)).toHaveCount(0)
  expect(calls.map((call) => `${call.method} ${call.path}`)).toEqual(['DELETE /v1/orders/ord-003'])
})

test('orders: a delete the /v1 refuses says why', async ({ page }) => {
  await ordersBackend(page, { deleteError: 'ORDER_DELIVERING' })
  await openOrders(page)
  await row(page, /Balcão/).getByRole('button', { name: 'Excluir pedido' }).click()
  await dialog(page).getByRole('button', { name: 'Excluir' }).click()
  await expect(page.getByText('Este pedido saiu para entrega e não pode ser alterado.')).toBeVisible()
  await expect(row(page, /Balcão/)).toBeVisible()
})

test('orders: the receipt prints through the browser with the order lines', async ({ page }) => {
  await page.addInitScript(() => {
    const printed: string[] = []
    Object.assign(window, { __printed: printed })
    // Records what the print root shows, then ends the print like the browser.
    window.print = () => {
      printed.push(document.getElementById('receipt-print-root')?.textContent ?? '')
      window.dispatchEvent(new Event('afterprint'))
    }
  })
  await ordersBackend(page)
  await openOrders(page)
  await row(page, /Mesa 3/).getByRole('button', { name: 'Imprimir pedido' }).click()

  await expect.poll(() => page.evaluate(() => (window as unknown as { __printed: string[] }).__printed.length)).toBe(1)
  const text = (await page.evaluate(() => (window as unknown as { __printed: string[] }).__printed[0])).replace(/ /g, ' ')
  expect(text).toContain('TOZZO BURGER')
  expect(text).toContain('Pedido #ord-001')
  expect(text).toContain('Mesa 3')
  expect(text).toContain('2x X-Burger')
  expect(text).toContain('R$ 49,80')
  // afterprint removed the root.
  await expect(page.locator('#receipt-print-root')).toHaveCount(0)
})

test('orders: filters go to the /v1 on Search', async ({ page }) => {
  await mockV1Api(page, { role: 'OWNER' })
  const requests: URLSearchParams[] = []
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.hostname === API && url.pathname === '/v1/orders' && request.method() === 'GET' && url.searchParams.get('status')) requests.push(url.searchParams)
  })
  await openOrders(page)

  await page.getByLabel('Cliente / Mesa').fill('mesa')
  await page.getByLabel('Valor mínimo').pressSequentially('3000')
  await expect(page.getByLabel('Valor mínimo')).toHaveValue('30.00')
  await page.getByRole('button', { name: 'Buscar' }).click()
  await expect(row(page, /Balcão/)).toHaveCount(0)
  await expect(row(page, /Mesa/).first()).toBeVisible()
  const last = requests.at(-1)!
  expect(last.get('customerName')).toBe('mesa')
  expect(last.get('minTotalCents')).toBe('3000')
})

// Sales (S4 part B). The sales tab opens on the last 24 h: the clock is the
// dataset's, so its first 30 sales are in the window.

type V1Sale = { id: string; totalCents: number; paymentMethod: string | null }
type V1SalePage = { items: V1Sale[]; nextCursor: string | null; total: number; summary: { count: number; totalCents: number } }

/** toV1() sales, minus the ones cancelled here; the summary follows the cancels. */
async function salesBackend(page: Page, options: { failFirstPost?: boolean } = {}) {
  const cancelled = new Set<string>()
  // Sales created here (newest first), on top of the dataset's.
  const created: (V1Sale & Record<string, unknown>)[] = []
  let posts = 0
  const salePage = (query: URLSearchParams): V1SalePage => {
    const wide = new URLSearchParams(query)
    wide.set('limit', '100')
    wide.delete('cursor')
    const gone = (v1({ method: 'GET', path: '/v1/sales', query: wide })!.body as V1SalePage).items.filter((item) => cancelled.has(item.id))
    const body = v1({ method: 'GET', path: '/v1/sales', query })!.body as V1SalePage
    const extra = query.get('cursor') ? [] : created
    const extraCents = created.reduce((sum, item) => sum + item.totalCents, 0)
    return {
      ...body,
      items: [...extra, ...body.items.filter((item) => !cancelled.has(item.id))],
      total: body.total - gone.length + created.length,
      summary: { count: body.summary.count - gone.length + created.length, totalCents: body.summary.totalCents - gone.reduce((sum, item) => sum + item.totalCents, 0) + extraCents },
    }
  }
  await page.clock.setFixedTime(new Date(FIXED_NOW))
  await mockV1Api(page, { role: 'OWNER' })
  const calls = await writes(page, ({ method, path, query, body }) => {
    if (method === 'GET' && path === '/v1/sales') return { status: 200, body: salePage(query) }
    if (method === 'POST' && path === '/v1/sales') {
      posts += 1
      const input = body as { id: string; customerName?: string; items: { productId: string; quantity: number }[] }
      const existing = created.find((item) => item.id === input.id)
      // The first attempt is recorded, but its answer is lost.
      if (options.failFirstPost && posts === 1) {
        created.unshift(newSale(input))
        return problem(500, 'INTERNAL_ERROR')
      }
      if (existing) return { status: 200, body: existing }
      created.unshift(newSale(input))
      return { status: 201, body: created[0] }
    }
    const match = /^\/v1\/sales\/([^/]+)\/cancel$/.exec(path)
    if (method === 'POST' && match) {
      cancelled.add(match[1])
      return { status: 204 }
    }
    return undefined
  })
  return { calls, salePage }
}

function newSale(input: { id: string; customerName?: string; items: { productId: string; quantity: number }[] }) {
  const items = input.items.map((entry, index) => {
    const product = canonical.products.find((item) => item.id === entry.productId)!
    return { id: `si-new-${index}`, productId: product.id, description: product.name, quantity: entry.quantity, unitPriceCents: product.priceCents }
  })
  return {
    id: input.id, customerName: input.customerName ?? null, soldAt: FIXED_NOW, isCancelled: false, paymentMethod: null,
    orderId: null, serviceOrderId: null, seller: { id: 'usr-owner', name: 'Victor Tozzo' }, items, serviceItems: [],
    totalCents: items.reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0),
  }
}

const brl = (cents: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100).replace(/ /g, ' ')
const textOf = async (locator: ReturnType<Page['locator']>) => ((await locator.textContent()) ?? '').replace(/ /g, ' ')
const firstSalesRequest = (page: Page) =>
  page.waitForRequest((request) => new URL(request.url()).pathname === '/v1/sales').then((request) => new URL(request.url()).searchParams)
const closing = (page: Page) => main(page).locator('.text-green-600')

test('sales: the period closing and the count come from the /v1 summary of the whole filter', async ({ page }) => {
  const { salePage } = await salesBackend(page)
  const first = firstSalesRequest(page)
  await page.goto('/dashboard/sales')
  const expected = salePage(await first)
  expect(expected.summary.count).toBeGreaterThan(10)

  await expect(main(page).locator('tbody tr')).toHaveCount(10, { timeout: 20_000 })
  await expect(main(page).getByText(`Total de registros: ${expected.summary.count}`)).toBeVisible()
  await expect.poll(() => textOf(closing(page))).toBe(brl(expected.summary.totalCents))
  // The closing is not the sum of the visible page.
  expect(expected.items.reduce((sum, item) => sum + item.totalCents, 0)).toBeLessThan(expected.summary.totalCents)
  await expect(main(page).getByText(`Página 1 de ${Math.ceil(expected.summary.count / 10)}`)).toBeVisible()
})

test('sales: filters go to the /v1 on Search, and the summary follows', async ({ page }) => {
  await salesBackend(page)
  const requests: URLSearchParams[] = []
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.hostname === API && url.pathname === '/v1/sales') requests.push(url.searchParams)
  })
  await page.goto('/dashboard/sales')
  await expect(main(page).locator('tbody tr')).toHaveCount(10, { timeout: 20_000 })

  await page.getByLabel('Valor mínimo').pressSequentially('10000')
  await page.getByRole('button', { name: 'Buscar' }).click()
  await expect.poll(() => requests.length).toBe(2)
  const last = requests[1]
  expect(last.get('minTotalCents')).toBe('10000')
  expect(last.get('from')).toBe(requests[0].get('from'))
  const expected = v1({ method: 'GET', path: '/v1/sales', query: last })!.body as V1SalePage
  await expect(main(page).getByText(`Total de registros: ${expected.summary.count}`)).toBeVisible()
  await expect.poll(() => textOf(closing(page))).toBe(brl(expected.summary.totalCents))
})

test('sales: cancel from the details after confirming', async ({ page }) => {
  const { calls, salePage } = await salesBackend(page)
  const first = firstSalesRequest(page)
  await page.goto('/dashboard/sales')
  const opened = salePage(await first).items[0]
  const firstRow = main(page).locator('tbody tr').first()
  await expect(firstRow).toBeVisible({ timeout: 20_000 })
  const count = Number((await textOf(main(page).getByText(/^Total de registros:/))).replace(/\D/g, ''))

  await firstRow.getByRole('button', { name: 'Ver detalhes' }).click()
  await expect(dialog(page).getByRole('heading', { name: 'Detalhes da venda' })).toBeVisible()
  await dialog(page).getByRole('button', { name: 'Cancelar venda' }).click()
  const confirmation = page.getByRole('dialog').filter({ hasText: 'Tem certeza que deseja cancelar esta venda?' })
  await confirmation.getByRole('button', { name: 'Cancelar venda' }).click()
  await expect(dialog(page)).toHaveCount(0)

  // The sale of the row that was opened.
  expect(calls.map((call) => `${call.method} ${call.path}`)).toEqual([`POST /v1/sales/${opened.id}/cancel`])
  await expect(main(page).getByText(`Total de registros: ${count - 1}`)).toBeVisible()
})

test('sales: the receipt prints with the payment method', async ({ page }) => {
  await page.addInitScript(() => {
    const printed: string[] = []
    Object.assign(window, { __printed: printed })
    window.print = () => {
      printed.push(document.getElementById('receipt-print-root')?.textContent ?? '')
      window.dispatchEvent(new Event('afterprint'))
    }
  })
  const { salePage } = await salesBackend(page)
  const first = firstSalesRequest(page)
  await page.goto('/dashboard/sales')
  const sale = salePage(await first).items[0]
  const firstRow = main(page).locator('tbody tr').first()
  await expect(firstRow).toBeVisible({ timeout: 20_000 })
  await firstRow.getByRole('button', { name: 'Imprimir venda' }).click()

  await expect.poll(() => page.evaluate(() => (window as unknown as { __printed: string[] }).__printed.length)).toBe(1)
  const text = (await page.evaluate(() => (window as unknown as { __printed: string[] }).__printed[0])).replace(/ /g, ' ')
  const payments: Record<string, string> = { CASH: 'Dinheiro', PIX: 'Pix', CREDIT_CARD: 'Crédito', DEBIT_CARD: 'Débito', ON_ACCOUNT: 'Fiado' }
  expect(text).toContain(`Venda #${sale.id}`)
  expect(text).toContain(brl(sale.totalCents))
  expect(text).toContain(`Forma de pagamento: ${sale.paymentMethod ? payments[sale.paymentMethod] : 'Não informado'}`)
  await expect(page.locator('#receipt-print-root')).toHaveCount(0)
})

test('sales: a new sale sends a client id and only product and quantity, and shows in the list', async ({ page }) => {
  const { calls } = await salesBackend(page)
  await page.goto('/dashboard/sales')
  await expect(main(page).locator('tbody tr')).toHaveCount(10, { timeout: 20_000 })

  await page.getByRole('button', { name: 'Nova venda' }).click()
  await dialog(page).getByPlaceholder('Buscar produto...').fill('salada')
  await dialog(page).getByText('X-Salada', { exact: true }).click()
  // Same product twice: one line with quantity 2 (mergeSameProducts).
  await dialog(page).getByText('X-Salada', { exact: true }).first().click()
  const post = page.waitForRequest((request) => request.method() === 'POST' && new URL(request.url()).pathname === '/v1/sales')
  await dialog(page).getByRole('button', { name: 'Confirmar' }).click()
  const body = (await post).postDataJSON() as Record<string, unknown>
  await expect(dialog(page)).toBeHidden()

  expect(body.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
  // No customer typed: customerName is left out.
  expect(body).toEqual({ id: body.id, items: [{ productId: 'prd-002', quantity: 2 }] })
  expect(calls).toHaveLength(1)
  await expect(main(page).locator('tbody tr').first()).toContainText('2x X-Salada')
  await expect(main(page).locator('tbody tr').first()).toContainText('Não informado')
})

test('sales: a new sale whose answer was lost is retried with the same id', async ({ page }) => {
  const { calls } = await salesBackend(page, { failFirstPost: true })
  await page.goto('/dashboard/sales')
  await expect(main(page).locator('tbody tr')).toHaveCount(10, { timeout: 20_000 })

  await page.getByRole('button', { name: 'Nova venda' }).click()
  await dialog(page).getByLabel('Cliente / Mesa').fill('Mesa 20')
  await dialog(page).getByPlaceholder('Buscar produto...').fill('salada')
  await dialog(page).getByText('X-Salada', { exact: true }).click()
  await dialog(page).getByRole('button', { name: 'Confirmar' }).click()
  await expect(page.getByText('Erro ao criar venda.')).toBeVisible()
  await expect(dialog(page)).toBeVisible()

  await dialog(page).getByRole('button', { name: 'Confirmar' }).click()
  await expect(dialog(page)).toBeHidden()
  const posts = calls.filter((call) => call.method === 'POST').map((call) => call.body as { id: string })
  expect(posts).toHaveLength(2)
  expect(posts[1]).toEqual(posts[0])
  await expect(main(page).getByRole('row', { name: /Mesa 20/ })).toHaveCount(1)
})
