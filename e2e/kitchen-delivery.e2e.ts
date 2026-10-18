import { expect, test, type Page, type Route } from '@playwright/test'
import { canonical } from './visual/data/canonical'
import { toV1 } from './visual/data/v1'
import { mockV1Api } from './visual/support/mock-v1'

// Kitchen and delivery boards of the Solid app (plan S4 part C) against the
// toV1() dataset, with stateful writes: what each move sends to the /v1, the
// version it carries, and what the board shows after.

const API = 'api.visual.test'
const v1 = toV1(canonical)
const NEXT_VERSION = '2026-10-01T18:05:00.000Z'

type Reply = { status: number; body?: unknown }
type Call = { method: string; path: string; body: Record<string, unknown> }

/** Answers what `reply` handles before the toV1() mock; records the writes. */
async function backend(page: Page, reply: (call: Call) => Reply | undefined) {
  const calls: Call[] = []
  await page.route((url) => url.hostname === API, async (route: Route) => {
    const request = route.request()
    if (request.method() === 'OPTIONS') return route.fallback()
    const call = { method: request.method(), path: new URL(request.url()).pathname, body: (request.postDataJSON?.() ?? {}) as Record<string, unknown> }
    const answer = reply(call)
    if (!answer) return route.fallback()
    if (call.method !== 'GET') calls.push(call)
    return route.fulfill({
      status: answer.status,
      contentType: answer.status >= 400 ? 'application/problem+json' : 'application/json',
      headers: { 'Access-Control-Allow-Origin': request.headers().origin ?? '*', 'Access-Control-Allow-Credentials': 'true' },
      body: answer.body === undefined ? '' : JSON.stringify(answer.body),
    })
  })
  return calls
}
const problem = (status: number, code: string): Reply => ({ status, body: { title: code, status, code } })
const get = (path: string) => v1({ method: 'GET', path, query: new URLSearchParams('limit=100') })!.body as Record<string, unknown>
const main = (page: Page) => page.locator('main')
const dialog = (page: Page) => page.getByRole('dialog')

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('tozzo.locale', 'pt-BR'))
})

// Kitchen

type KitchenItem = { id: string; productId: string; productName: string; quantity: number; stage: 'IN_PREPARATION' | 'READY'; kitchenReadyAt: string | null }
type KitchenOrder = { id: string; customerName: string | null; updatedAt: string; items: KitchenItem[] }

async function kitchenBackend(page: Page, options: { conflict?: boolean } = {}) {
  let orders = structuredClone((get('/v1/kitchen/orders') as { items: KitchenOrder[] }).items)
  await mockV1Api(page, { role: 'OWNER' })
  return backend(page, ({ method, path, body }) => {
    if (method === 'GET' && path === '/v1/kitchen/orders') return { status: 200, body: { items: orders, nextCursor: null, total: orders.length } }
    const match = /^\/v1\/kitchen\/orders\/([^/]+)\/items$/.exec(path)
    if (method !== 'PATCH' || !match) return undefined
    const order = orders.find((item) => item.id === match[1])
    if (!order) return problem(404, 'ORDER_NOT_FOUND')
    if (options.conflict || body.expectedUpdatedAt !== order.updatedAt) return problem(409, 'KITCHEN_CONFLICT')
    const ids = body.itemIds as string[]
    const stage = body.targetStage as KitchenItem['stage']
    orders = orders.map((item) => item.id !== order.id ? item : {
      ...item, updatedAt: NEXT_VERSION,
      items: item.items.map((entry) => (ids.includes(entry.id) ? { ...entry, stage, kitchenReadyAt: stage === 'READY' ? NEXT_VERSION : null } : entry)),
    })
    return { status: 200, body: { orderId: order.id, updatedAt: NEXT_VERSION, items: orders.find((item) => item.id === order.id)!.items } }
  })
}

const column = (page: Page, name: string) => main(page).locator('div.min-h-\\[360px\\]').filter({ has: page.getByRole('heading', { name, exact: true }) })
const kitchenCard = (page: Page, text: string) => main(page).locator('[data-board-card]').filter({ hasText: text })
const handle = '[aria-roledescription="draggable"]'

test('kitchen: an item goes to Pronto by drag and drop', async ({ page }) => {
  const calls = await kitchenBackend(page)
  await page.goto('/dashboard/kitchen')
  const preparing = column(page, 'Em preparo')
  const ready = column(page, 'Pronto')
  const first = preparing.locator('[data-board-card]').first()
  await expect(first).toBeVisible({ timeout: 20_000 })
  const text = (await first.locator('p').first().textContent())!

  const from = (await first.boundingBox())!
  const to = (await ready.boundingBox())!
  await page.mouse.move(from.x + 40, from.y + from.height / 2)
  await page.mouse.down()
  // Past the sensor's 10 px activation distance, then over the other column.
  await page.mouse.move(from.x + 60, from.y + from.height / 2, { steps: 5 })
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 3, { steps: 15 })
  await page.mouse.up()

  await expect(ready.getByText(text)).toBeVisible()
  expect(calls).toHaveLength(1)
  expect(calls[0].body).toMatchObject({ action: 'MOVE', targetStage: 'READY' })
  expect(typeof calls[0].body.expectedUpdatedAt).toBe('string')
})

test('kitchen: an item goes to Pronto with the keyboard', async ({ page }) => {
  const calls = await kitchenBackend(page)
  await page.goto('/dashboard/kitchen')
  const preparing = column(page, 'Em preparo')
  const first = preparing.locator('[data-board-card]').first()
  await expect(first).toBeVisible({ timeout: 20_000 })
  const text = (await first.locator('p').first().textContent())!

  await first.locator(handle).focus()
  await page.keyboard.press('Space')
  await page.keyboard.press('ArrowRight')
  await expect(column(page, 'Pronto')).toHaveClass(/border-primary/)
  await page.keyboard.press('Space')

  await expect(column(page, 'Pronto').getByText(text)).toBeVisible()
  await expect(page.getByText('Item movido.')).toBeAttached()
  expect(calls.map((call) => call.body.targetStage)).toEqual(['READY'])
})

test('kitchen: a move the /v1 refuses as a conflict says so and keeps the item', async ({ page }) => {
  await kitchenBackend(page, { conflict: true })
  await page.goto('/dashboard/kitchen')
  const first = column(page, 'Em preparo').locator('[data-board-card]').first()
  await expect(first).toBeVisible({ timeout: 20_000 })
  const text = (await first.locator('p').first().textContent())!

  await first.locator(handle).focus()
  await page.keyboard.press('Space')
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Space')
  await expect(main(page).getByRole('alert')).toHaveText('A comanda mudou. A fila será atualizada em breve.')
  await expect(column(page, 'Em preparo').getByText(text).first()).toBeVisible()
  await expect(kitchenCard(page, text).first()).toBeVisible()
})

// Deliveries

type DeliveryOrder = {
  id: string; customerName: string | null; updatedAt: string
  items: { id: string; status: string }[]
  delivery: { stage: 'WAITING' | 'DELIVERING'; startedAt: string | null; driver: { id: string; name: string; phone: string | null } | null; externalDriverName: string | null; externalDriverPhone: string | null }
} & Record<string, unknown>

async function deliveryBackend(page: Page, prepare: (orders: DeliveryOrder[]) => DeliveryOrder[] = (orders) => orders, role: 'OWNER' | 'DRIVER' = 'OWNER') {
  const initial = get('/v1/delivery/orders') as { items: DeliveryOrder[]; drivers: { id: string; name: string; phone: string | null }[] }
  let orders = prepare(structuredClone(initial.items))
  const drivers = () => initial.drivers.map((driver) => ({ ...driver, available: !orders.some((order) => order.delivery.driver?.id === driver.id && order.delivery.stage === 'DELIVERING') }))
  await mockV1Api(page, { role })
  const calls = await backend(page, ({ method, path, body }) => {
    if (method === 'GET' && path === '/v1/delivery/orders') return { status: 200, body: { items: orders, drivers: drivers(), nextCursor: null, total: orders.length } }
    const match = /^\/v1\/delivery\/orders\/([^/]+)$/.exec(path)
    if (method !== 'PATCH' || !match) return undefined
    const order = orders.find((item) => item.id === match[1])!
    if (body.expectedUpdatedAt !== order.updatedAt) return problem(409, 'DELIVERY_CONFLICT')
    const next = structuredClone(order)
    next.updatedAt = NEXT_VERSION
    if (body.action === 'ASSIGN') {
      const driver = drivers().find((item) => item.id === body.driverId)
      if (body.driverId && !driver?.available) return problem(409, 'DRIVER_BUSY')
      next.delivery = { ...next.delivery, driver: driver ? { id: driver.id, name: driver.name, phone: driver.phone } : null, externalDriverName: (body.externalDriverName as string) ?? null, externalDriverPhone: (body.externalDriverPhone as string) ?? null }
    } else if (body.action === 'START') {
      const pending = next.items.some((item) => item.status !== 'READY' && item.status !== 'DELIVERED')
      if (pending && !body.confirmReady) return problem(409, 'ORDER_NOT_READY')
      next.items = next.items.map((item) => (item.status === 'READY' || item.status === 'DELIVERED' ? item : { ...item, status: 'READY' }))
      next.delivery = { ...next.delivery, stage: 'DELIVERING', startedAt: NEXT_VERSION }
      next.status = 'DELIVERING'
    } else if (body.action === 'UNASSIGN') {
      if (next.delivery.stage === 'DELIVERING') return problem(409, 'DELIVERY_ALREADY_STARTED')
      next.delivery = { ...next.delivery, driver: null, externalDriverName: null, externalDriverPhone: null }
    } else if (body.action === 'WAIT') {
      next.delivery = { ...next.delivery, stage: 'WAITING', startedAt: null }
      next.status = 'OPEN'
    }
    orders = orders.map((item) => (item.id === order.id ? next : item))
    return { status: 200, body: next }
  })
  /** Another device changes the order: a new version the page has not read. */
  const changeElsewhere = (id: string) => {
    orders = orders.map((order) => (order.id === id ? { ...order, updatedAt: '2026-10-01T18:09:00.000Z' } : order))
  }
  return Object.assign(calls, { changeElsewhere })
}

const deliveryCard = (page: Page, name: string) => main(page).locator('article').filter({ has: page.getByRole('heading', { name, exact: true }) })

test('deliveries: wait frees the driver, who is assigned to another order, which then starts', async ({ page }) => {
  const calls = await deliveryBackend(page)
  await page.goto('/dashboard/deliveries')
  const camila = deliveryCard(page, 'Camila Duarte')
  await expect(camila).toBeVisible({ timeout: 20_000 })

  // WAIT: back to waiting
  await camila.getByRole('button', { name: 'Voltar para aguardando' }).click()
  await expect(camila.getByRole('button', { name: 'Saiu para entrega' })).toBeVisible()

  // ASSIGN: Pedro is free again
  const bruno = deliveryCard(page, 'Bruno Ferreira')
  await bruno.getByRole('button', { name: 'Atribuir entregador' }).click()
  await dialog(page).getByRole('button', { name: /Pedro Martins.*Disponível/ }).click()
  await dialog(page).getByRole('button', { name: 'Salvar entregador' }).click()
  await expect(dialog(page)).toBeHidden()
  await expect(bruno).toContainText('Entregador: Pedro Martins')

  // START: every item is ready, no question
  await bruno.getByRole('button', { name: 'Saiu para entrega' }).click()
  await expect(bruno.getByRole('button', { name: 'Finalizar entrega' })).toBeVisible()

  expect(calls.map((call) => `${call.body.action} ${call.path}`)).toEqual([
    'WAIT /v1/delivery/orders/ord-005',
    'ASSIGN /v1/delivery/orders/ord-004',
    'START /v1/delivery/orders/ord-004',
  ])
  expect(calls[1].body).toEqual({ action: 'ASSIGN', driverId: 'usr-driver', expectedUpdatedAt: '2026-10-01T17:50:00.000Z' })
  // The start carried the version the assignment produced.
  expect(calls[2].body).toEqual({ action: 'START', expectedUpdatedAt: NEXT_VERSION })
})

test('deliveries: starting with items still in the kitchen asks first, then sends confirmReady', async ({ page }) => {
  const calls = await deliveryBackend(page, (orders) => orders.map((order) => (order.id === 'ord-004'
    ? { ...order, items: order.items.map((item, index) => (index === 0 ? { ...item, status: 'IN_PREPARATION' } : item)) }
    : order)))
  await page.goto('/dashboard/deliveries')
  const bruno = deliveryCard(page, 'Bruno Ferreira')
  await expect(bruno).toBeVisible({ timeout: 20_000 })

  await bruno.getByRole('button', { name: 'Saiu para entrega' }).click()
  await expect(dialog(page).getByRole('heading', { name: 'Itens ainda não estão prontos' })).toBeVisible()
  expect(calls).toHaveLength(0)
  await dialog(page).getByRole('button', { name: 'Confirmar e sair para entrega' }).click()
  await expect(dialog(page)).toBeHidden()
  await expect(bruno.getByRole('button', { name: 'Finalizar entrega' })).toBeVisible()
  expect(calls.map((call) => call.body)).toEqual([{ action: 'START', confirmReady: true, expectedUpdatedAt: '2026-10-01T17:50:00.000Z' }])
})

test('kitchen: Esc during a pointer drag cancels it, nothing is sent', async ({ page }) => {
  const calls = await kitchenBackend(page)
  await page.goto('/dashboard/kitchen')
  const first = column(page, 'Em preparo').locator('[data-board-card]').first()
  await expect(first).toBeVisible({ timeout: 20_000 })
  const text = (await first.locator('p').first().textContent())!

  const from = (await first.boundingBox())!
  const to = (await column(page, 'Pronto').boundingBox())!
  await page.mouse.move(from.x + 40, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(from.x + 60, from.y + from.height / 2, { steps: 5 })
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 3, { steps: 15 })
  await page.keyboard.press('Escape')
  // Moving on before the release must not start a new drag.
  await page.mouse.move(to.x + to.width / 2 + 20, to.y + to.height / 3, { steps: 5 })
  await page.mouse.up()

  await expect(column(page, 'Em preparo').getByText(text).first()).toBeVisible()
  // A real move after it: had the cancelled drag sent anything, it would be listed first.
  await first.locator(handle).focus()
  await page.keyboard.press('Space')
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Space')
  await expect(column(page, 'Pronto').getByText(text).first()).toBeVisible()
  expect(calls.map((call) => call.body.targetStage)).toEqual(['READY'])
})

/** Drags `source` (pointer) and releases at `x`, `y`. */
async function dragTo(page: Page, source: ReturnType<Page['locator']>, x: number, y: number) {
  const box = (await source.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 20, box.y + box.height / 2, { steps: 5 })
  await page.mouse.move(x, y, { steps: 20 })
  await page.mouse.up()
}
// Camila's delivery back to waiting: Pedro (her driver) is free to take another one.
const driverFree = (orders: DeliveryOrder[]) => orders.map((order) => (order.id === 'ord-005'
  ? { ...order, status: 'OPEN', delivery: { ...order.delivery, stage: 'WAITING' as const, startedAt: null } }
  : order))
const driverTile = (page: Page) => page.getByTitle('Arraste o entregador até um pedido aguardando').first()

test('deliveries: dragging a driver onto a waiting order assigns them', async ({ page }) => {
  // The roster and the board in one viewport: a pointer drag cannot scroll.
  await page.setViewportSize({ width: 1440, height: 1800 })
  const calls = await deliveryBackend(page, driverFree)
  await page.goto('/dashboard/deliveries')
  const bruno = deliveryCard(page, 'Bruno Ferreira')
  await expect(bruno).toBeVisible({ timeout: 20_000 })
  const target = (await bruno.boundingBox())!

  await dragTo(page, driverTile(page), target.x + target.width / 2, target.y + 20)

  await expect(bruno).toContainText('Entregador: Pedro Martins')
  expect(calls.map((call) => call.body)).toEqual([{ action: 'ASSIGN', driverId: 'usr-driver', expectedUpdatedAt: '2026-10-01T17:50:00.000Z' }])
})

test('deliveries: a driver released outside an order, or held and let go in place, assigns nothing', async ({ page }) => {
  // The roster and the board in one viewport: a pointer drag cannot scroll.
  await page.setViewportSize({ width: 1440, height: 1800 })
  const calls = await deliveryBackend(page, driverFree)
  await page.goto('/dashboard/deliveries')
  await expect(deliveryCard(page, 'Bruno Ferreira')).toBeVisible({ timeout: 20_000 })
  const title = (await page.getByText('Pedidos para entrega').boundingBox())!

  await dragTo(page, driverTile(page), title.x + 10, title.y + 5)
  // Hold past the 250 ms activation delay and let go where it started.
  const tile = (await driverTile(page).boundingBox())!
  await page.mouse.move(tile.x + 10, tile.y + 10)
  await page.mouse.down()
  // Held past the 250 ms activation delay: the tile is lifted.
  await expect(driverTile(page)).toHaveClass(/shadow-xl/)
  await page.mouse.up()

  const bruno = deliveryCard(page, 'Bruno Ferreira')
  await expect(bruno).toContainText('Entregador: Não informado')
  // A real assignment after them: had either gesture sent anything, it would be listed first.
  const target = (await bruno.boundingBox())!
  await dragTo(page, driverTile(page), target.x + target.width / 2, target.y + 20)
  await expect(bruno).toContainText('Entregador: Pedro Martins')
  expect(calls.map((call) => call.body.action)).toEqual(['ASSIGN'])
})

test('deliveries: a start on a version changed elsewhere is a conflict, said and reloaded', async ({ page }) => {
  const calls = await deliveryBackend(page)
  await page.goto('/dashboard/deliveries')
  const bruno = deliveryCard(page, 'Bruno Ferreira')
  await expect(bruno).toBeVisible({ timeout: 20_000 })

  calls.changeElsewhere('ord-004')
  await bruno.getByRole('button', { name: 'Saiu para entrega' }).click()
  await expect(main(page).getByRole('alert')).toHaveText('O pedido mudou. Confira os itens atualizados e tente novamente.')
  // Read again: the next start carries the new version and goes through.
  await bruno.getByRole('button', { name: 'Saiu para entrega' }).click()
  await expect(bruno.getByRole('button', { name: 'Finalizar entrega' })).toBeVisible()
  expect(calls.map((call) => call.body.expectedUpdatedAt)).toEqual(['2026-10-01T17:50:00.000Z', '2026-10-01T18:09:00.000Z'])
})

test('deliveries: a third-party driver is assigned, then removed', async ({ page }) => {
  const calls = await deliveryBackend(page)
  await page.goto('/dashboard/deliveries')
  const bruno = deliveryCard(page, 'Bruno Ferreira')
  await expect(bruno).toBeVisible({ timeout: 20_000 })

  await bruno.getByRole('button', { name: 'Atribuir entregador' }).click()
  await dialog(page).getByRole('radio', { name: 'Terceirizado' }).check()
  await dialog(page).getByLabel('Nome do entregador').fill('João iFood')
  await dialog(page).getByLabel('Contato do entregador (opcional)').fill('11 99999-0000')
  await dialog(page).getByRole('button', { name: 'Salvar entregador' }).click()
  await expect(dialog(page)).toBeHidden()
  await expect(bruno).toContainText('Entregador: João iFood · 11 99999-0000')

  await bruno.getByRole('button', { name: 'Editar entregador' }).click()
  await dialog(page).getByRole('button', { name: 'Remover entregador' }).click()
  await expect(dialog(page)).toBeHidden()
  await expect(bruno).toContainText('Entregador: Não informado')
  expect(calls.map((call) => call.body)).toEqual([
    { action: 'ASSIGN', externalDriverName: 'João iFood', externalDriverPhone: '11 99999-0000', expectedUpdatedAt: '2026-10-01T17:50:00.000Z' },
    { action: 'UNASSIGN', expectedUpdatedAt: NEXT_VERSION },
  ])
})

test('deliveries: a DRIVER only starts, with no roster and no driver or finish buttons', async ({ page }) => {
  const calls = await deliveryBackend(page, (orders) => orders, 'DRIVER')
  await page.goto('/dashboard/deliveries')
  const bruno = deliveryCard(page, 'Bruno Ferreira')
  await expect(bruno).toBeVisible({ timeout: 20_000 })

  await expect(page.getByText('Entregadores', { exact: true })).toHaveCount(0)
  await expect(main(page).getByRole('button', { name: 'Atribuir entregador' })).toHaveCount(0)
  await expect(main(page).getByRole('button', { name: 'Voltar para aguardando' })).toHaveCount(0)
  await expect(main(page).getByRole('button', { name: 'Finalizar entrega' })).toHaveCount(0)
  // Camila's delivery (out) cannot be dragged back.
  const camila = deliveryCard(page, 'Camila Duarte')
  const from = (await camila.boundingBox())!
  const waiting = (await main(page).getByRole('heading', { name: /Aguardando ficar pronto/ }).boundingBox())!
  await page.mouse.move(from.x + from.width / 2, from.y + 10)
  await page.mouse.down()
  await page.mouse.move(waiting.x + 50, waiting.y + 80, { steps: 15 })
  await page.mouse.up()

  await bruno.getByRole('button', { name: 'Saiu para entrega' }).click()
  await expect(bruno.getByRole('button', { name: 'Saiu para entrega' })).toHaveCount(0)
  expect(calls.map((call) => `${call.body.action} ${call.path}`)).toEqual(['START /v1/delivery/orders/ord-004'])
})
