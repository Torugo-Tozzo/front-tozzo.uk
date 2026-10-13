import { describe, expect, test } from 'bun:test'
import { canonical, FIXED_NOW, saleTotalCents } from './canonical'
import { toLegacyApi, type MockApi } from './legacy'
import { toV1 } from './v1'

const legacy = toLegacyApi()
const v1 = toV1()

function get(api: MockApi, path: string, params: Record<string, string> = {}) {
  const response = api({ method: 'GET', path, query: new URLSearchParams(params) })
  if (!response) throw new Error(`no mock for ${path}`)
  expect(response.status).toBe(200)
  return response as { status: number; body: any; headers?: Record<string, string> }
}

/** Walks a /v1 cursor list to the end. */
function all(api: MockApi, path: string, params: Record<string, string> = {}) {
  const items: any[] = []
  let cursor: string | null = null
  do {
    const { body } = get(api, path, { ...params, limit: '100', ...(cursor ? { cursor } : {}) })
    items.push(...body.items)
    cursor = body.nextCursor
  } while (cursor)
  return items
}

const cents = (value: string | number) => Math.round(Number(value) * 100)
const sorted = (values: string[]) => [...values].sort()

describe('canonical dataset', () => {
  test('has the size the plan asks for', () => {
    expect(canonical.products).toHaveLength(30)
    expect(canonical.sales).toHaveLength(200)
    expect(new Set(canonical.users.map((user) => user.role))).toEqual(new Set(['OWNER', 'MANAGER', 'EMPLOYEE', 'COOK', 'DRIVER']))
    expect(new Set(canonical.orders.map((order) => order.status))).toEqual(new Set(['OPEN', 'DELIVERING', 'CLOSED']))
    expect(new Set(canonical.orders.flatMap((order) => order.items.map((item) => item.status)))).toEqual(new Set(['REQUESTED', 'IN_PREPARATION', 'READY', 'DELIVERED']))
    expect(new Set(canonical.serviceOrders.map((order) => order.status))).toEqual(new Set(['OPEN', 'QUOTED', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']))
  })

  test('is deterministic and anchored to the fixed clock', async () => {
    const again = (await import(`./canonical?again=${Date.now()}`)).canonical
    expect(again.sales).toEqual(canonical.sales)
    expect(canonical.sales.every((sale) => sale.soldAt <= FIXED_NOW)).toBe(true)
    const dayAgo = new Date(new Date(FIXED_NOW).getTime() - 86_400_000).toISOString()
    expect(canonical.sales.filter((sale) => sale.soldAt >= dayAgo).length).toBeGreaterThanOrEqual(30)
  })
})

describe('toLegacyApi() and toV1() describe the same data', () => {
  test('signed-in user and establishment', () => {
    const legacyMe = get(legacy, '/usuarios/me').body
    const v1Me = get(v1, '/v1/me').body
    expect(legacyMe.nome).toBe(v1Me.name)
    expect(legacyMe.role).toBe('DONO')
    expect(v1Me.role).toBe('OWNER')
    const legacyEst = get(legacy, '/estabelecimentos').body
    const v1Est = get(v1, '/v1/establishment').body
    expect(legacyEst.nomeFantasia).toBe(v1Est.tradeName)
    expect(legacyEst.visibleModules).toEqual(v1Me.establishment.visibleModules)
    expect(legacyEst.plan).toBe('PAGO')
    expect(v1Est.plan).toBe('PAID')
  })

  test('open and closed orders', () => {
    for (const [isOpen, status] of [['true', 'open'], ['false', 'closed']] as const) {
      const legacyResponse = get(legacy, '/pedidos', { isOpen, limit: '100' })
      const v1Items = all(v1, '/v1/orders', { status })
      expect(Number(legacyResponse.headers!['X-Total-Count'])).toBe(v1Items.length)
      expect(legacyResponse.body.map((order: any) => order.cliente)).toEqual(v1Items.map((order) => order.customerName))
      expect(legacyResponse.body.map((order: any) => cents(order.total))).toEqual(v1Items.map((order) => order.totalCents))
    }
  })

  test('kitchen and delivery boards', () => {
    const legacyKitchen = get(legacy, '/cozinha/pedidos', { page: '1', limit: '100' }).body
    const v1Kitchen = all(v1, '/v1/kitchen/orders')
    expect(legacyKitchen.total).toBe(v1Kitchen.length)
    expect(legacyKitchen.orders).toEqual(v1Kitchen)

    const legacyDelivery = get(legacy, '/entregas/pedidos', { page: '1', limit: '100' }).body
    const v1Delivery = get(v1, '/v1/delivery/orders', { limit: '100' }).body
    expect(legacyDelivery.orders.map((order: any) => [order.id, order.stage, cents(order.total)]))
      .toEqual(v1Delivery.items.map((order: any) => [order.id, order.delivery.stage, order.totalCents]))
    expect(legacyDelivery.drivers).toEqual(v1Delivery.drivers)
  })

  test('sales: count, closing total and rows for the default 24 h window', () => {
    const to = FIXED_NOW
    const from = new Date(new Date(FIXED_NOW).getTime() - 86_400_000).toISOString()
    const legacyBody = get(legacy, '/vendas', { dataInicial: from, dataFinal: to, page: '1', limit: '100' }).body
    const v1Page = get(v1, '/v1/sales', { from, to, limit: '100' }).body
    expect(legacyBody.pagination.total).toBe(v1Page.summary.count)
    expect(cents(legacyBody.fechamento)).toBe(v1Page.summary.totalCents)
    expect(legacyBody.vendas.map((sale: any) => [sale.id, sale.cliente, cents(sale.total)]))
      .toEqual(v1Page.items.map((sale: any) => [sale.id, sale.customerName, sale.totalCents]))
  })

  test('sales: whole history', () => {
    const legacyTotal = get(legacy, '/vendas', { limit: '1' }).body.pagination.total
    const v1Items = all(v1, '/v1/sales')
    expect(legacyTotal).toBe(v1Items.length)
    expect(v1Items.reduce((sum, sale) => sum + sale.totalCents, 0))
      .toBe(canonical.sales.filter((sale) => !sale.isCancelled).reduce((sum, sale) => sum + saleTotalCents(sale), 0))
  })

  test('catalog: products, types, services', () => {
    const legacyProducts = get(legacy, '/produtos', { page: '1', limit: '100' }).body
    const v1Products = all(v1, '/v1/products')
    expect(legacyProducts.map((product: any) => [product.nome, cents(product.preco), product.tipoProduto.descricao]))
      .toEqual(v1Products.map((product) => [product.name, product.priceCents, product.productType.description]))

    const legacyTypes = get(legacy, '/tipos', { all: 'true' }).body
    const v1Types = get(v1, '/v1/product-types', { includeInactive: 'true' }).body
    expect(sorted(legacyTypes.map((type: any) => `${type.descricao}|${type.cor}|${type.ativo}`)))
      .toEqual(sorted(v1Types.map((type: any) => `${type.description}|${type.color}|${type.isActive}`)))

    const legacyServices = get(legacy, '/servicos', { limit: '100' }).body
    const v1Services = all(v1, '/v1/services')
    expect(legacyServices.map((service: any) => [service.name, service.referencePrice === null ? null : cents(service.referencePrice)]))
      .toEqual(v1Services.map((service) => [service.name, service.referencePriceCents]))
  })

  test('team, devices and calendar', () => {
    const legacyUsers = get(legacy, '/usuarios', { page: '1', limit: '100' }).body
    const v1Users = all(v1, '/v1/users')
    expect(legacyUsers.map((user: any) => user.nome)).toEqual(v1Users.map((user) => user.name))

    const legacyDevices = get(legacy, '/dispositivos').body
    const v1Devices = get(v1, '/v1/devices').body
    expect(legacyDevices.map((device: any) => [device.id, device.lastUserName])).toEqual(v1Devices.map((device: any) => [device.id, device.lastUserName]))

    expect(get(legacy, '/calendar', { from: '2026-09-27', to: '2026-10-04' }).body).toEqual(get(v1, '/v1/calendar', { from: '2026-09-27', to: '2026-10-04' }).body)
    expect(get(legacy, '/calendar/business-hours').body).toEqual(get(v1, '/v1/business-hours').body)
  })

  test('service orders: statuses map one to one and totals match', () => {
    const statusMap: Record<string, string> = { ABERTA: 'OPEN', ORCADA: 'QUOTED', APROVADA: 'APPROVED', EM_EXECUCAO: 'IN_PROGRESS', CONCLUIDA: 'COMPLETED', CANCELADA: 'CANCELLED' }
    for (const stage of ['estimates', 'services']) {
      const legacyList = get(legacy, '/ordens-servico', { stage, limit: '100' }).body
      const v1List = all(v1, '/v1/service-orders', { stage })
      expect(legacyList.map((order: any) => [order.id, statusMap[order.status], cents(order.total)]))
        .toEqual(v1List.map((order) => [order.id, order.status, order.totalCents]))
    }
    const legacyDetail = get(legacy, '/ordens-servico/so-005').body
    const v1Detail = get(v1, '/v1/service-orders/so-005').body
    expect(cents(legacyDetail.sale.total)).toBe(v1Detail.sale.totalCents)
    expect(legacyDetail.events).toHaveLength(v1Detail.events.length)
  })

  test('reports: period totals and top products', () => {
    const range = { from: '2026-09-01T03:00:00.000Z', to: FIXED_NOW }
    const legacyCharts = get(legacy, '/graficos', { dataInicial: range.from, dataFinal: range.to }).body
    const v1Top = get(v1, '/v1/reports/top-products', range).body
    expect(legacyCharts.fechamento.totalNumeroVendas).toBe(v1Top.totals.salesCount)
    expect(legacyCharts.fechamento.totalUnidadesVendidas).toBe(v1Top.totals.units)
    expect(cents(legacyCharts.fechamento.totalFaturado)).toBe(v1Top.totals.revenueCents)
    expect(legacyCharts.produtos.slice(0, 10).map((row: any) => row.nome)).toEqual(v1Top.products.map((row: any) => row.name))

    const day = { dataInicial: '2026-10-01T03:00:00.000Z', dataFinal: '2026-10-02T02:59:59.000Z' }
    const legacyHours = get(legacy, '/graficos/vendas-por-horario', day).body
    const v1Hours = get(v1, '/v1/reports/sales-by-hour', { date: '2026-10-01', tzOffsetMinutes: '-180' }).body
    expect(legacyHours.map((sale: any) => [sale.id, cents(sale.total)])).toEqual(v1Hours.sales.map((sale: any) => [sale.id, sale.totalCents]))
  })
})
