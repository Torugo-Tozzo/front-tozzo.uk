// toV1(): the canonical dataset as the Go API serves it under /v1
// (English, integer cents, keyset cursor pages `{items, nextCursor}`).
// The Solid app (web/) is driven by this serializer in its visual and E2E tests.
import {
  canonical as defaultDataset,
  orderTotalCents,
  saleTotalCents,
  serviceOrderTotalCents,
  type CanonicalDataset,
  type CanonicalOrder,
  type CanonicalSale,
  type CanonicalServiceOrder,
  type CanonicalServiceOrderLine,
  type Role,
} from './canonical'
import { calendarView, type MockApi, type MockResponse } from './legacy'

const json = (body: unknown, status = 200): MockResponse => ({ status, body })

// The real cursor is opaque base64url JSON of the last sort key; an offset is
// enough for a fixed dataset and keeps the same opacity for the client.
const encodeCursor = (offset: number) => btoa(JSON.stringify({ o: offset })).replace(/=+$/, '')
const decodeCursor = (cursor: string | null) => (cursor ? (JSON.parse(atob(cursor)) as { o: number }).o : 0)
function cursorPage<T>(items: T[], query: URLSearchParams, defaultLimit: number) {
  const limit = Math.min(Number(query.get('limit') ?? defaultLimit), 100)
  const offset = decodeCursor(query.get('cursor'))
  const slice = items.slice(offset, offset + limit)
  // `total` counts the whole filtered list, as the /v1 pages do (API 5f6d153).
  return { items: slice, nextCursor: offset + limit < items.length ? encodeCursor(offset + limit) : null, total: items.length }
}
const matches = (text: string | null | undefined, search: string | null) =>
  !search || (text ?? '').toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'))

export interface V1Options { role?: Role }

export function toV1(data: CanonicalDataset = defaultDataset, options: V1Options = {}): MockApi {
  const role = options.role ?? 'OWNER'
  const est = data.establishment
  const me = data.users.find((user) => user.role === role)!
  const userById = (id: string | null) => data.users.find((user) => user.id === id)
  const typeById = (id: string) => data.productTypes.find((type) => type.id === id)!
  const productById = (id: string) => data.products.find((product) => product.id === id)!
  const person = (id: string) => ({ id, name: userById(id)!.name })

  const meBody = () => ({
    id: me.id, name: me.name, email: me.email, emailVerified: true, phone: me.phone, locale: 'pt-BR', role: me.role,
    establishment: {
      id: est.id, tradeName: est.tradeName, status: est.status, plan: est.plan, category: est.category,
      businessProfiles: est.businessProfiles, visibleModules: est.visibleModules, preferencesRevision: est.preferencesRevision,
    },
  })
  const establishmentView = () => ({
    id: est.id, tradeName: est.tradeName, status: est.status, plan: est.plan, isLifetime: false,
    subscriptionExpiresAt: '2026-11-01T03:00:00.000Z', category: est.category, cnpj: '12.345.678/0001-90', phone: est.phone, logoUrl: null,
    address: { street: 'Av. Paulista', number: '1000', complement: 'Loja 2', neighborhood: 'Bela Vista', city: 'São Paulo', state: 'SP', zipCode: '01310-100' },
    extraDevices: est.extraDevices, createdAt: est.createdAt,
    // The plan limits of the API (internal/plan): FREE counts prints and reports.
    limits: est.plan === 'FREE'
      ? { devices: 3, printsPerDay: 30, products: 60, reportsPerMonth: 5 }
      : { devices: 8, printsPerDay: null, products: null, reportsPerMonth: null },
    usage: { activeProducts: data.products.length, devices: data.devices.length, printsToday: 4, reportsThisMonth: 2 },
  })
  const product = (id: string) => {
    const item = productById(id)
    const type = typeById(item.productTypeId)
    return {
      id: item.id, name: item.name, ingredients: item.ingredients, priceCents: item.priceCents, imageUrl: item.imageUrl,
      productType: { id: type.id, description: type.description, color: type.color }, updatedAt: est.createdAt,
    }
  }
  const order = (value: CanonicalOrder) => {
    const driver = userById(value.driverId)
    return {
      id: value.id,
      customerName: value.customerName,
      status: value.status,
      isDelivery: value.isDelivery,
      deliveryAddress: value.deliveryAddress,
      delivery: value.isDelivery
        ? {
            stage: value.deliveryStartedAt ? 'DELIVERING' : 'WAITING',
            startedAt: value.deliveryStartedAt,
            driver: driver ? { id: driver.id, name: driver.name, phone: driver.phone } : null,
            externalDriverName: null,
            externalDriverPhone: null,
          }
        : null,
      seller: person(value.createdById),
      totalCents: orderTotalCents(value),
      openedAt: value.openedAt,
      updatedAt: value.updatedAt,
      items: value.items.map((item) => ({
        id: item.id, productId: item.productId, productName: productById(item.productId).name, quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
        // /v1 has no REQUESTED on output: a requested item is already in preparation.
        status: item.status === 'REQUESTED' ? 'IN_PREPARATION' : item.status,
        kitchenReadyAt: item.kitchenReadyAt,
      })),
    }
  }
  const sale = (value: CanonicalSale) => ({
    id: value.id,
    customerName: value.customerName,
    soldAt: value.soldAt,
    totalCents: saleTotalCents(value),
    isCancelled: value.isCancelled,
    paymentMethod: value.paymentMethod,
    orderId: null,
    serviceOrderId: data.serviceOrders.find((item) => item.saleId === value.id)?.id ?? null,
    seller: person(value.sellerId),
    items: value.items.map((item) => ({ id: item.id, productId: item.productId, description: productById(item.productId).name, quantity: item.quantity, unitPriceCents: item.unitPriceCents })),
    serviceItems: value.serviceItems.map((item) => ({ id: item.id, serviceId: item.serviceId, description: item.description, details: item.details, quantity: item.quantity, unitPriceCents: item.unitPriceCents })),
  })
  const line = ({ id, kind, serviceId, productId, description, details, quantity, unitPriceCents, isSupplement }: CanonicalServiceOrderLine, withId = true) => ({
    ...(withId ? { id } : {}), kind, serviceId, productId, description, details, quantity, unitPriceCents, isSupplement,
  })
  const serviceOrder = (value: CanonicalServiceOrder, withEvents: boolean) => {
    const linked = value.saleId ? data.sales.find((item) => item.id === value.saleId)! : null
    return {
      id: value.id, customerName: value.customerName, description: value.description, status: value.status,
      dueAt: value.dueAt, responsibleId: value.responsibleId, completedAt: value.completedAt,
      createdAt: value.createdAt, updatedAt: value.updatedAt, totalCents: serviceOrderTotalCents(value),
      items: value.items.map((item) => line(item)),
      acceptedQuote: value.acceptedQuote?.map((item) => line(item, false)) ?? null,
      pendingItems: value.pendingItems.map((item) => line(item, false)),
      sale: linked ? { id: linked.id, totalCents: saleTotalCents(linked), isCancelled: linked.isCancelled } : null,
      ...(withEvents ? { events: value.events.map(({ action, fromStatus, toStatus, userId, createdAt }) => ({ action: action.toUpperCase(), fromStatus, toStatus, userId, createdAt })) } : {}),
    }
  }

  const activeSales = () => data.sales.filter((item) => !item.isCancelled)
  const inRange = (soldAt: string, query: URLSearchParams) => {
    const from = query.get('from')
    const to = query.get('to')
    return (!from || soldAt >= new Date(from).toISOString()) && (!to || soldAt <= new Date(to).toISOString())
  }
  const productRows = (query: URLSearchParams) => {
    const typeId = query.get('productTypeId')
    const sales = activeSales().filter((item) => inRange(item.soldAt, query))
    const rows = new Map<string, { quantity: number; revenueCents: number }>()
    for (const value of sales) for (const item of value.items) {
      if (typeId && productById(item.productId).productTypeId !== typeId) continue
      const row = rows.get(item.productId) ?? { quantity: 0, revenueCents: 0 }
      row.quantity += item.quantity
      row.revenueCents += item.quantity * item.unitPriceCents
      rows.set(item.productId, row)
    }
    const sorted = [...rows].map(([id, row]) => ({ id, name: productById(id).name, ...row }))
      .sort((left, right) => right.revenueCents - left.revenueCents || left.name.localeCompare(right.name))
    return { sorted, salesCount: sales.length }
  }

  return ({ method, path, query, body }) => {
    if (!path.startsWith('/v1/')) return undefined
    if (method !== 'GET') {
      if (path === '/v1/events/ticket') return json({ ticket: 'visual-fixture', expiresAt: '2026-10-01T18:05:00.000Z' })
      // PUT /v1/orders/{id} needs the version the client saw (API 57568ec).
      const edited = method === 'PUT' ? /^\/v1\/orders\/([^/]+)$/.exec(path) : null
      if (edited) {
        const found = data.orders.find((item) => item.id === edited[1])
        if (!found) return problem(404, 'ORDER_NOT_FOUND')
        const expected = (body as { expectedUpdatedAt?: unknown } | undefined)?.expectedUpdatedAt
        if (typeof expected !== 'string' || Number.isNaN(Date.parse(expected))) return problem(422, 'ORDER_VERSION_INVALID')
        if (expected !== found.updatedAt) return problem(409, 'ORDER_CONFLICT')
        return json(order(found))
      }
      return json({})
    }

    if (path === '/v1/me') return json(meBody())
    if (path === '/v1/establishment') return json(establishmentView())
    if (path === '/v1/establishment/preferences') return json({ profiles: est.businessProfiles, visibleModules: est.visibleModules, revision: est.preferencesRevision })

    if (path === '/v1/orders') {
      const closed = query.get('status') === 'closed'
      const min = query.get('minTotalCents')
      const max = query.get('maxTotalCents')
      const list = data.orders
        .filter((item) => (item.status === 'CLOSED') === closed)
        // The list filters of the /v1 (S4): substrings, totals in cents.
        .filter((item) => matches(item.customerName, query.get('customerName')) && matches(userById(item.createdById)?.name, query.get('sellerName')))
        .filter((item) => (!min || orderTotalCents(item) >= Number(min)) && (!max || orderTotalCents(item) <= Number(max)))
        .sort((left, right) => right.openedAt.localeCompare(left.openedAt))
      const page = cursorPage(list, query, 50)
      return json({ items: page.items.map(order), nextCursor: page.nextCursor, total: page.total })
    }
    const orderMatch = /^\/v1\/orders\/([^/]+)$/.exec(path)
    if (orderMatch) {
      const found = data.orders.find((item) => item.id === orderMatch[1])
      return found ? json(order(found)) : problem(404, 'NOT_FOUND')
    }
    if (path === '/v1/kitchen/orders') {
      const list = data.orders
        .filter((item) => item.status === 'OPEN' && !item.deliveryStartedAt && item.items.some((entry) => entry.status !== 'DELIVERED'))
        .sort((left, right) => left.openedAt.localeCompare(right.openedAt))
        .map((item) => ({
          id: item.id, customerName: item.customerName, openedAt: item.openedAt, updatedAt: item.updatedAt,
          items: item.items.filter((entry) => entry.status !== 'DELIVERED').map((entry) => ({
            id: entry.id, productId: entry.productId, productName: productById(entry.productId).name, quantity: entry.quantity,
            stage: entry.status === 'READY' ? 'READY' : 'IN_PREPARATION', kitchenReadyAt: entry.kitchenReadyAt,
          })),
        }))
      return json(cursorPage(list, query, 50))
    }
    if (path === '/v1/delivery/orders') {
      const list = data.orders
        .filter((item) => item.isDelivery && item.status !== 'CLOSED')
        .sort((left, right) => left.openedAt.localeCompare(right.openedAt))
      const page = cursorPage(list, query, 50)
      const drivers = data.users.filter((user) => user.role === 'DRIVER').map((user) => ({
        id: user.id, name: user.name, phone: user.phone, available: !data.orders.some((item) => item.driverId === user.id && item.status === 'DELIVERING'),
      }))
      return json({ items: page.items.map(order), drivers, nextCursor: page.nextCursor, total: page.total })
    }

    if (path === '/v1/sales') {
      const customer = query.get('customerName')
      const seller = query.get('sellerId')
      const min = query.get('minTotalCents')
      const max = query.get('maxTotalCents')
      const list = activeSales()
        .filter((item) => inRange(item.soldAt, query) && matches(item.customerName, customer) && (!seller || item.sellerId === seller))
        .filter((item) => matches(userById(item.sellerId)?.name, query.get('sellerName')))
        .filter((item) => (!min || saleTotalCents(item) >= Number(min)) && (!max || saleTotalCents(item) <= Number(max)))
      const page = cursorPage(list, query, 50)
      return json({
        items: page.items.map(sale),
        nextCursor: page.nextCursor,
        total: page.total,
        summary: { count: list.length, totalCents: list.reduce((sum, item) => sum + saleTotalCents(item), 0) },
      })
    }

    if (path === '/v1/products') {
      const search = query.get('search')
      const typeId = query.get('productTypeId')
      const list = data.products
        .filter((item) => typeById(item.productTypeId).isActive && (!typeId || item.productTypeId === typeId))
        .filter((item) => matches(`${item.name} ${item.ingredients ?? ''}`, search))
        .sort((left, right) => left.name.localeCompare(right.name, 'pt-BR') || left.id.localeCompare(right.id))
      const page = cursorPage(list, query, 50)
      return json({ items: page.items.map((item) => product(item.id)), nextCursor: page.nextCursor, total: page.total })
    }
    if (path === '/v1/product-types') {
      const includeInactive = query.get('includeInactive') === 'true'
      const search = query.get('search')
      return json(data.productTypes
        .filter((type) => (includeInactive || type.isActive) && matches(type.description, search))
        .sort((left, right) => left.description.localeCompare(right.description, 'pt-BR'))
        .map((type) => ({ ...type, updatedAt: est.createdAt })))
    }
    if (path === '/v1/users') {
      const search = query.get('search')
      const list = data.users.filter((user) => matches(user.name, search))
      const page = cursorPage(list, query, 50)
      return json({ items: page.items.map(({ id, name, email, phone, role: userRole, createdAt }) => ({ id, name, email, phone, photoUrl: null, role: userRole, createdAt })), nextCursor: page.nextCursor, total: page.total })
    }
    if (path === '/v1/devices') {
      return json([...data.devices].sort((left, right) => right.createdAt.localeCompare(left.createdAt)).map((device) => ({
        id: device.id, info: { platform: device.platform, model: device.model }, lastSeen: device.lastSeenAt,
        lastUserId: device.lastUserId, lastUserName: userById(device.lastUserId)?.name ?? null, createdAt: device.createdAt,
      })))
    }

    if (path === '/v1/calendar') return json(calendarView(data))
    if (path === '/v1/business-hours') return json({ hours: data.businessHours })

    if (path === '/v1/reports/top-products') {
      const { sorted, salesCount } = productRows(query)
      const rest = sorted.slice(10)
      return json({
        products: sorted.slice(0, 10).map(({ id, name, quantity, revenueCents }) => ({ id, name, quantity, revenueCents })),
        others: { quantity: rest.reduce((sum, row) => sum + row.quantity, 0), revenueCents: rest.reduce((sum, row) => sum + row.revenueCents, 0) },
        totals: { revenueCents: sorted.reduce((sum, row) => sum + row.revenueCents, 0), salesCount, units: sorted.reduce((sum, row) => sum + row.quantity, 0) },
      })
    }
    if (path === '/v1/reports/products') {
      const { sorted } = productRows(query)
      const page = cursorPage(sorted, query, 50)
      return json({
        items: page.items.map((row) => {
          const item = productById(row.id)
          const type = typeById(item.productTypeId)
          return { ...row, productType: { id: type.id, description: type.description }, unitPriceCents: item.priceCents }
        }),
        nextCursor: page.nextCursor,
        total: page.total,
      })
    }
    if (path === '/v1/reports/sales-by-hour') {
      const date = query.get('date')
      if (!date) return problem(422, 'REPORT_QUERY_INVALID')
      const offset = Number(query.get('tzOffsetMinutes') ?? -180)
      const start = new Date(`${date}T00:00:00Z`).getTime() - offset * 60_000
      const sales = activeSales().filter((item) => {
        const time = new Date(item.soldAt).getTime()
        return time >= start && time < start + 86_400_000
      }).sort((left, right) => left.soldAt.localeCompare(right.soldAt))
      const hours = Array.from({ length: 24 }, (_, hour) => {
        const inHour = sales.filter((item) => Math.floor((new Date(item.soldAt).getTime() - start) / 3_600_000) === hour)
        return { hour, salesCount: inHour.length, revenueCents: inHour.reduce((sum, item) => sum + saleTotalCents(item), 0) }
      })
      return json({ hours, sales: sales.map((item) => ({ id: item.id, customerName: item.customerName, soldAt: item.soldAt, totalCents: saleTotalCents(item) })) })
    }

    if (path === '/v1/services') {
      const search = query.get('search')
      const list = data.services
        .filter((service) => service.isActive && matches(`${service.name} ${service.description ?? ''}`, search))
        .sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'))
      const page = cursorPage(list, query, 20)
      return json({ items: page.items.map(({ id, name, description, referencePriceCents, createdAt, updatedAt }) => ({ id, name, description, referencePriceCents, createdAt, updatedAt })), nextCursor: page.nextCursor, total: page.total })
    }
    if (path === '/v1/service-orders') {
      const stage = query.get('stage')
      const open = query.get('open')
      const status = query.get('status')
      const search = query.get('search')
      const dueBefore = query.get('dueBefore')
      const openStatuses = stage === 'estimates' ? ['OPEN', 'QUOTED'] : stage === 'services' ? ['APPROVED', 'IN_PROGRESS'] : ['OPEN', 'QUOTED', 'APPROVED', 'IN_PROGRESS']
      const list = data.serviceOrders
        .filter((item) => stage !== 'services' || item.acceptedQuote)
        .filter((item) => open === null || openStatuses.includes(item.status) === (open === 'true'))
        .filter((item) => !status || item.status === status)
        .filter((item) => !dueBefore || (!!item.dueAt && Date.parse(item.dueAt) <= Date.parse(dueBefore)))
        .filter((item) => matches(`${item.customerName} ${item.description}`, search))
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      const page = cursorPage(list, query, 20)
      return json({ items: page.items.map((item) => serviceOrder(item, false)), nextCursor: page.nextCursor, total: page.total })
    }
    const serviceOrderMatch = /^\/v1\/service-orders\/([^/]+)$/.exec(path)
    if (serviceOrderMatch) {
      const found = data.serviceOrders.find((item) => item.id === serviceOrderMatch[1])
      return found ? json(serviceOrder(found, true)) : problem(404, 'NOT_FOUND')
    }
    return undefined
  }
}

export function problem(status: number, code: string, detail?: string): MockResponse {
  return {
    status,
    contentType: 'application/problem+json',
    body: { title: code, status, code, ...(detail ? { detail } : {}) },
  }
}
