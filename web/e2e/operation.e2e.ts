import { expect, test, type Page, type Route } from '@playwright/test'
import { canonical, FIXED_NOW } from '../../e2e/visual/data/canonical'
import { toV1 } from '../../e2e/visual/data/v1'
import { mockV1Api } from './visual/support/mock-v1'

// Operation screens of the Solid app (plan S4) against the toV1() dataset:
// what each action sends to the /v1 and what the screen does with the answer.

const API = 'api.visual.test'

interface Call { method: string; path: string; query: URLSearchParams; body: unknown }
type Reply = { status: number; body?: unknown } | undefined

/**
 * Records every write (and answers it, or any GET, when `reply` does) before
 * the toV1() mock, which only reads; `reply` returning undefined hands the
 * request back to it (writes then get `{}`).
 */
async function writes(page: Page, reply: (call: Call) => Reply = () => undefined) {
  const calls: Call[] = []
  await page.route((url) => url.hostname === API, async (route: Route) => {
    const request = route.request()
    if (request.method() === 'OPTIONS') return route.fallback()
    const url = new URL(request.url())
    const call = { method: request.method(), path: url.pathname, query: url.searchParams, body: request.postDataJSON?.() ?? null }
    calls.push(call)
    const answer = reply(call)
    if (!answer) return route.fallback()
    const origin = request.headers().origin ?? '*'
    return route.fulfill({
      status: answer.status,
      contentType: answer.status >= 400 ? 'application/problem+json' : 'application/json',
      headers: { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Credentials': 'true' },
      body: answer.body === undefined ? '' : JSON.stringify(answer.body),
    })
  })
  const sent = (method: string, path: string | RegExp) => calls.filter((call) => call.method === method && (typeof path === 'string' ? call.path === path : path.test(call.path)))
  return { calls, sent }
}

const v1 = toV1(canonical)
const v1Get = (path: string, query = '') => v1({ method: 'GET', path, query: new URLSearchParams(query) })!.body as Record<string, unknown>
const main = (page: Page) => page.locator('main')
const dialog = (page: Page) => page.getByRole('dialog')
const product = (id: string) => canonical.products.find((item) => item.id === id)!

test.beforeEach(async ({ page }) => {
  // The dataset's "now": the sales tab opens on the last 24 hours before it.
  await page.clock.setFixedTime(new Date(FIXED_NOW))
  await page.addInitScript(() => localStorage.setItem('tozzo.locale', 'pt-BR'))
})

test('orders: a new order with items goes to the API with its client id and shows in the list', async ({ page }) => {
  await mockV1Api(page, { role: 'OWNER' })
  let created: Record<string, unknown> | null = null
  const api = await writes(page, ({ method, path, body }) => {
    if (method === 'POST' && path === '/v1/orders') {
      const input = body as { customerName: string; items: { productId: string; quantity: number }[] }
      created = {
        ...(v1Get('/v1/orders/ord-006')),
        id: 'ord-new', customerName: input.customerName, openedAt: FIXED_NOW, updatedAt: FIXED_NOW,
        items: input.items.map((item, index) => ({ id: `new-${index}`, productId: item.productId, productName: product(item.productId).name, quantity: item.quantity, unitPriceCents: product(item.productId).priceCents, status: 'IN_PREPARATION', kitchenReadyAt: null })),
        totalCents: input.items.reduce((sum, item) => sum + item.quantity * product(item.productId).priceCents, 0),
      }
      return { status: 201, body: created }
    }
    if (method === 'GET' && path === '/v1/orders' && created) {
      const list = v1Get('/v1/orders', 'limit=10') as { items: unknown[]; total: number }
      return { status: 200, body: { ...list, items: [created, ...list.items].slice(0, 10), total: list.total + 1 } }
    }
    return undefined
  })
  await page.goto('/dashboard/orders')
  await expect(main(page).getByText('Mesa 7')).toBeVisible()

  await page.getByRole('button', { name: 'Novo pedido' }).click()
  await dialog(page).getByLabel('Cliente / Mesa').fill('Mesa 12')
  // The catalog comes 20 at a time: search for what is not on the first page.
  const search = dialog(page).getByPlaceholder('Buscar produto...')
  await search.fill('X-Burger')
  await dialog(page).getByText('X-Burger', { exact: true }).click()
  await dialog(page).getByText('X-Burger', { exact: true }).first().click()
  await search.fill('Suco')
  await dialog(page).getByText('Suco Natural', { exact: true }).first().click()
  await dialog(page).getByRole('button', { name: 'Confirmar' }).click()
  await expect(dialog(page)).toBeHidden()

  await expect(main(page).getByText('Mesa 12')).toBeVisible()
  await expect(main(page).getByText('1x X-Burger, 1x X-Burger, 1x Suco Natural')).toBeVisible()
  const post = api.sent('POST', '/v1/orders')
  expect(post).toHaveLength(1)
  expect(post[0].body).toEqual({
    id: expect.stringMatching(/^[0-9a-f-]{36}$/),
    customerName: 'Mesa 12',
    isDelivery: false,
    items: [{ productId: 'prd-001', quantity: 1 }, { productId: 'prd-001', quantity: 1 }, { productId: 'prd-016', quantity: 1 }],
  })
})

test('orders: an item changes state, then the order closes into a sale with the payment method', async ({ page }) => {
  await mockV1Api(page, { role: 'OWNER' })
  const api = await writes(page)
  await page.goto('/dashboard/orders')

  await main(page).getByRole('row', { name: /Mesa 3/ }).getByRole('button', { name: 'Editar pedido' }).click()
  await expect(dialog(page).getByText('Batata Frita P').first()).toBeVisible()
  await dialog(page).getByRole('button', { name: /^Status do item: X-Burger/ }).click()
  await page.getByRole('option', { name: 'Pronto' }).click()
  await expect.poll(() => api.sent('PATCH', /\/items\//).length).toBe(1)
  expect(api.sent('PATCH', /\/items\//)[0]).toMatchObject({ path: '/v1/orders/ord-001/items/ori-001-1', body: { status: 'READY' } })

  await dialog(page).getByLabel('Método de pagamento').selectOption('PIX')
  await dialog(page).getByRole('button', { name: 'Fechar pedido' }).click()
  await page.getByRole('dialog').last().getByRole('button', { name: 'Sim' }).click()
  await expect.poll(() => api.sent('POST', '/v1/orders/ord-001/close').length).toBe(1)
  expect(api.sent('POST', '/v1/orders/ord-001/close')[0].body).toEqual({ paymentMethod: 'PIX' })
  await expect(dialog(page)).toHaveCount(0)
})

test('sales: the filters go to the API and the total and closing follow its summary', async ({ page }) => {
  await mockV1Api(page, { role: 'OWNER' })
  const api = await writes(page)
  await page.goto('/dashboard/sales')

  await expect.poll(() => api.sent('GET', '/v1/sales').length).toBeGreaterThan(0)
  const first = api.sent('GET', '/v1/sales')
  const initial = v1Get('/v1/sales', first[0].query.toString()) as { total: number }
  await expect(main(page).getByText(`Total de registros: ${initial.total}`)).toBeVisible()

  await expect(main(page).locator('.animate-pulse')).toHaveCount(0)
  const customer = (await main(page).locator('tbody tr').first().locator('td').nth(1).locator('div').first().textContent())!.trim()
  await main(page).getByLabel('Cliente / Mesa').fill(customer)
  await main(page).getByLabel('Valor mínimo').pressSequentially('1000')
  await page.getByRole('button', { name: 'Buscar' }).click()

  await expect.poll(() => api.sent('GET', '/v1/sales').length).toBe(2)
  const query = api.sent('GET', '/v1/sales')[1].query
  expect(query.get('customerName')).toBe(customer)
  expect(query.get('minTotalCents')).toBe('1000')
  expect(query.get('from')).toBe(first[0].query.get('from'))
  const filtered = v1Get('/v1/sales', query.toString()) as { total: number; summary: { totalCents: number } }
  await expect(main(page).getByText(`Total de registros: ${filtered.total}`)).toBeVisible()
  const closing = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(filtered.summary.totalCents / 100)
  await expect(main(page).locator('.text-green-600')).toHaveText(closing)
  await expect(main(page).locator('.animate-pulse')).toHaveCount(0)
  expect(filtered.total).toBeGreaterThan(0)
  await expect(main(page).locator('tbody tr')).toHaveCount(Math.min(filtered.total, 10))
  for (const row of await main(page).locator('tbody tr').all()) await expect(row).toContainText(customer)
})

test('kitchen: an item moves to the other column with the mouse and with the keyboard', async ({ page }) => {
  await mockV1Api(page, { role: 'COOK' })
  const api = await writes(page)
  await page.goto('/dashboard/kitchen')
  const board = v1Get('/v1/kitchen/orders', 'limit=100') as { items: { id: string; updatedAt: string; customerName: string; items: { id: string; productName: string; stage: string }[] }[] }
  const order = board.items.find((item) => item.customerName === 'Ana Paula')!
  const xTudo = order.items.find((item) => item.productName === 'X-Tudo')!
  const onion = order.items.find((item) => item.productName === 'Onion Rings')!

  // Mouse: press, move past the activation distance, drop on the "Ready" column.
  const card = main(page).locator('[role="button"]', { hasText: '1× X-Tudo' }).filter({ hasText: 'Ana Paula' })
  const ready = main(page).getByRole('heading', { name: 'Pronto', exact: true }).locator('..').locator('..')
  const from = (await card.boundingBox())!
  const to = (await ready.boundingBox())!
  await page.mouse.move(from.x + 40, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(from.x + 60, from.y + from.height / 2 + 10, { steps: 4 })
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 })
  await page.mouse.up()
  await expect.poll(() => api.sent('PATCH', /\/v1\/kitchen\//).length).toBe(1)
  expect(api.sent('PATCH', /\/v1\/kitchen\//)[0]).toMatchObject({
    path: `/v1/kitchen/orders/${order.id}/items`,
    body: { action: 'MOVE', itemIds: [xTudo.id], targetStage: 'READY', expectedUpdatedAt: order.updatedAt },
  })

  // Keyboard: Space picks it up, → chooses the column, Space drops it.
  const onionCard = main(page).locator('[role="button"]', { hasText: '1× Onion Rings' }).filter({ hasText: 'Ana Paula' })
  await onionCard.focus()
  await page.keyboard.press('Space')
  await expect(page.getByText('Item selecionado.')).toBeAttached()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Space')
  await expect.poll(() => api.sent('PATCH', /\/v1\/kitchen\//).length).toBe(2)
  expect(api.sent('PATCH', /\/v1\/kitchen\//)[1].body).toEqual({ action: 'MOVE', itemIds: [onion.id], targetStage: 'READY', expectedUpdatedAt: order.updatedAt })
})

test('deliveries: a third-party driver is assigned, the order goes out, and a delivered one is closed', async ({ page }) => {
  await mockV1Api(page, { role: 'OWNER' })
  const api = await writes(page)
  await page.goto('/dashboard/deliveries')
  const waiting = main(page).locator('article', { hasText: 'Bruno Ferreira' })

  await waiting.getByRole('button', { name: 'Atribuir entregador' }).click()
  await dialog(page).getByRole('radio', { name: 'Terceirizado' }).check()
  await dialog(page).getByLabel('Nome do entregador').fill('João iFood')
  await dialog(page).getByRole('button', { name: 'Salvar entregador' }).click()
  await expect.poll(() => api.sent('PATCH', '/v1/delivery/orders/ord-004').length).toBe(1)
  expect(api.sent('PATCH', '/v1/delivery/orders/ord-004')[0].body).toEqual({ action: 'ASSIGN', externalDriverName: 'João iFood', externalDriverPhone: '', expectedUpdatedAt: '2026-10-01T17:50:00.000Z' })
  await expect(dialog(page)).toHaveCount(0)

  // Every item is ready or delivered: it goes out without asking.
  await waiting.getByRole('button', { name: 'Saiu para entrega' }).click()
  await expect.poll(() => api.sent('PATCH', '/v1/delivery/orders/ord-004').length).toBe(2)
  expect(api.sent('PATCH', '/v1/delivery/orders/ord-004')[1].body).toEqual({ action: 'START', expectedUpdatedAt: '2026-10-01T17:50:00.000Z' })

  await main(page).locator('article', { hasText: 'Camila Duarte' }).getByRole('button', { name: 'Finalizar entrega' }).click()
  await dialog(page).getByLabel('Método de pagamento').selectOption('CREDIT_CARD')
  await dialog(page).getByRole('button', { name: 'Fechar pedido e gerar venda' }).click()
  await expect.poll(() => api.sent('POST', '/v1/orders/ord-005/close').length).toBe(1)
  expect(api.sent('POST', '/v1/orders/ord-005/close')[0].body).toEqual({ paymentMethod: 'CREDIT_CARD' })
  await expect(dialog(page)).toHaveCount(0)
})

test('receipt: printing an order and a sale renders the receipt for the browser print', async ({ page }) => {
  // No real print dialog: window.print keeps what would go to paper, then
  // fires afterprint like the browser does when the dialog closes.
  await page.addInitScript(() => {
    const printed: { text: string; width: string; pageSize: string }[] = []
    Object.assign(window, { __printed: printed })
    window.print = () => {
      const root = document.getElementById('receipt-print-root')!
      const receipt = root.querySelector('.receipt')!
      const pageSize = [...document.head.querySelectorAll('style')].map((style) => style.textContent ?? '').find((text) => text.startsWith('@page')) ?? ''
      printed.push({ text: [...receipt.children].map((child) => child.textContent).join('\n'), width: receipt.className, pageSize })
      window.dispatchEvent(new Event('afterprint'))
    }
    localStorage.setItem('tozzo.printerWidth', '58mm')
  })
  await mockV1Api(page, { role: 'OWNER' })
  await page.goto('/dashboard/orders')

  await main(page).getByRole('row', { name: /Mesa 3/ }).getByRole('button', { name: 'Imprimir pedido' }).click()
  await expect.poll(() => page.evaluate(() => (window as unknown as { __printed: unknown[] }).__printed.length)).toBe(1)
  const order = await page.evaluate(() => (window as unknown as { __printed: { text: string; width: string; pageSize: string }[] }).__printed[0])
  expect(order.width).toBe('receipt receipt--58mm')
  expect(order.pageSize).toBe('@page { size: 58mm auto; margin: 0; }')
  // Intl puts a no-break space after "R$".
  const lines = order.text.replace(/\u00a0/g, ' ').split('\n')
  expect(lines.slice(0, 4)).toEqual(['TOZZO BURGER', 'Pedido #ord-001', 'Mesa 3', expect.stringMatching(/^01\/10\/2026/)])
  expect(lines.slice(4)).toEqual(['', '2x X-BurgerR$ 49,80', '1x Batata Frita PR$ 12,90', '2x Refrigerante LataR$ 13,80', '', 'TotalR$ 76,50'])
  // The receipt leaves the page after printing.
  await expect(page.locator('#receipt-print-root')).toHaveCount(0)

  await page.goto('/dashboard/sales')
  const firstSale = (v1Get('/v1/sales', `from=2026-09-30T18:00:00.000Z&to=2026-10-01T18:00:59.000Z&limit=10`) as { items: { id: string; paymentMethod: string | null }[] }).items[0]
  await main(page).locator('tbody tr').first().getByRole('button', { name: 'Imprimir venda' }).click()
  await expect.poll(() => page.evaluate(() => (window as unknown as { __printed: unknown[] }).__printed.length)).toBe(1)
  const sale = await page.evaluate(() => (window as unknown as { __printed: { text: string }[] }).__printed[0])
  expect(sale.text).toContain(`Venda #${firstSale.id}`)
  const labels: Record<string, string> = { CASH: 'Dinheiro', PIX: 'Pix', CREDIT_CARD: 'Crédito', DEBIT_CARD: 'Débito', ON_ACCOUNT: 'Fiado' }
  expect(sale.text.split('\n').at(-1)).toBe(`Forma de pagamento: ${firstSale.paymentMethod ? labels[firstSale.paymentMethod] : 'Não informado'}`)
})
