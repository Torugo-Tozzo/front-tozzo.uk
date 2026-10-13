// toLegacyApi(): the canonical dataset as the Bun API serves it today
// (Portuguese keys where the server's legacyWire renames them, Decimal money
// as strings, X-Total-Count headers). Only reads matter for screenshots;
// writes answer with a harmless echo.
import {
  canonical as defaultDataset,
  orderTotalCents,
  saleTotalCents,
  serviceOrderTotalCents,
  type CanonicalDataset,
  type CanonicalOrder,
  type CanonicalProduct,
  type CanonicalSale,
  type CanonicalServiceOrderLine,
  type Role,
  type ServiceOrderStatus,
} from './canonical'

export interface MockResponse { status: number; body?: unknown; headers?: Record<string, string>; contentType?: string }
export interface MockRequest { method: string; path: string; query: URLSearchParams; body?: unknown }
export type MockApi = (request: MockRequest) => MockResponse | undefined

const LEGACY_ROLE: Record<Role, string> = { OWNER: 'DONO', MANAGER: 'GERENTE', EMPLOYEE: 'FUNCIONARIO', COOK: 'COZINHEIRO', DRIVER: 'ENTREGADOR' }
const LEGACY_SO_STATUS: Record<ServiceOrderStatus, string> = { OPEN: 'ABERTA', QUOTED: 'ORCADA', APPROVED: 'APROVADA', IN_PROGRESS: 'EM_EXECUCAO', COMPLETED: 'CONCLUIDA', CANCELLED: 'CANCELADA' }
const LEGACY_ORDER_STATUS = { OPEN: 'ABERTO', DELIVERING: 'ENTREGANDO', CLOSED: 'FECHADO' } as const
const LEGACY_CATEGORY: Record<string, string> = { BURGER_SHOP: 'HAMBURGUERIA', PIZZERIA: 'PIZZARIA', ICE_CREAM_SHOP: 'SORVETERIA', COFFEE_SHOP: 'CAFETERIA', SNACK_BAR: 'LANCHONETE', OTHER: 'OUTRO' }
const LEGACY_PLAN: Record<string, string> = { FREE: 'FREE', PAID: 'PAGO', LEGACY_PAID: 'PAGO_LEGADO', ENTERPRISE: 'ENTERPRISE' }

/** Prisma Decimal#toJSON: "24.9", "0" — trailing zeros dropped. */
export const decimal = (cents: number) => String(cents / 100)

const json = (body: unknown, headers?: Record<string, string>): MockResponse => ({ status: 200, body, headers })
const paged = <T>(items: T[], query: URLSearchParams, defaultLimit: number) => {
  const limit = Number(query.get('limit') ?? defaultLimit)
  const page = Number(query.get('page') ?? 1)
  return items.slice((page - 1) * limit, page * limit)
}
const matches = (text: string | null | undefined, search: string | null) =>
  !search || (text ?? '').toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'))

export interface LegacyOptions {
  /** Role of the signed-in user (default OWNER). */
  role?: Role
}

export function toLegacyApi(data: CanonicalDataset = defaultDataset, options: LegacyOptions = {}): MockApi {
  const role = options.role ?? 'OWNER'
  const est = data.establishment
  const me = data.users.find((user) => user.role === role)!
  const userById = (id: string | null) => data.users.find((user) => user.id === id)
  const typeById = (id: string) => data.productTypes.find((type) => type.id === id)!
  const productById = (id: string) => data.products.find((product) => product.id === id)!

  const legacyType = (id: string) => {
    const type = typeById(id)
    return { id: type.id, descricao: type.description, ativo: type.isActive, cor: type.color, updated_at: est.createdAt, deleted_at: null, estabelecimentoId: est.id }
  }
  const legacyProduct = (product: CanonicalProduct, withType = false) => ({
    id: product.id,
    nome: product.name,
    preco: decimal(product.priceCents),
    ingredientes: product.ingredients,
    updated_at: est.createdAt,
    deleted_at: null,
    tipoProdutoId: product.productTypeId,
    origemProdutoId: null,
    estabelecimentoId: est.id,
    ...(withType ? { tipoProduto: legacyType(product.productTypeId) } : {}),
  })
  const legacySeller = (id: string) => ({ id, nome: userById(id)!.name, email: userById(id)!.email })
  const legacyEstablishment = () => ({
    id: est.id,
    nomeFantasia: est.tradeName,
    telefone: est.phone,
    zipCode: '01310-100',
    addressStreet: 'Av. Paulista',
    addressNumber: '1000',
    addressComplement: 'Loja 2',
    addressNeighborhood: 'Bela Vista',
    addressCity: 'São Paulo',
    addressState: 'SP',
    cnpj: '12.345.678/0001-90',
    status: est.status === 'ACTIVE' ? 'ATIVO' : 'PENDENTE_PAGAMENTO',
    plan: LEGACY_PLAN[est.plan],
    extraDevices: est.extraDevices,
    reportCount: 2,
    reportCountResetAt: '2026-10-01T03:00:00.000Z',
    category: est.category ? LEGACY_CATEGORY[est.category] : null,
    businessProfiles: est.businessProfiles,
    visibleModules: est.visibleModules,
    preferencesRevision: est.preferencesRevision,
    isLifetime: false,
    subscriptionExpiresAt: '2026-11-01T03:00:00.000Z',
    createdAt: est.createdAt,
    printCountToday: 4,
    deviceCount: data.devices.length,
  })
  const legacyOrder = (order: CanonicalOrder) => ({
    id: order.id,
    isOpen: order.status !== 'CLOSED',
    isDelivery: order.isDelivery,
    deliveryAddress: order.deliveryAddress,
    deliveryStartedAt: order.deliveryStartedAt,
    driverId: order.driverId,
    externalDriverName: null,
    externalDriverPhone: null,
    cliente: order.customerName,
    horario: order.openedAt,
    updated_at: order.updatedAt,
    deleted_at: null,
    total: decimal(orderTotalCents(order)),
    estabelecimentoId: est.id,
    usuarioVendedorId: order.createdById,
    vendedor: { id: order.createdById, nome: userById(order.createdById)!.name },
    status: LEGACY_ORDER_STATUS[order.status],
    paymentMethod: order.paymentMethod,
    itens: order.items.map((item) => ({
      id: item.id,
      quantidade: item.quantity,
      deleted_at: null,
      status: item.status,
      pedidoId: order.id,
      produtoId: item.productId,
      precoHistorico: decimal(item.unitPriceCents),
      kitchenReadyAt: item.kitchenReadyAt,
      produto: legacyProduct(productById(item.productId)),
    })),
  })
  const legacySale = (sale: CanonicalSale) => ({
    id: sale.id,
    total: decimal(saleTotalCents(sale)),
    horario: sale.soldAt,
    cliente: sale.customerName,
    excluida: sale.isCancelled,
    paymentMethod: sale.paymentMethod,
    updated_at: sale.soldAt,
    estabelecimentoId: est.id,
    usuarioVendedorId: sale.sellerId,
    pedidoId: null,
    serviceOrderId: data.serviceOrders.find((order) => order.saleId === sale.id)?.id ?? null,
    vendedor: legacySeller(sale.sellerId),
    itens: sale.items.map((item) => ({
      id: item.id,
      quantidade: item.quantity,
      deleted_at: null,
      vendaId: sale.id,
      produtoId: item.productId,
      precoHistorico: decimal(item.unitPriceCents),
      produto: legacyProduct(productById(item.productId)),
    })),
    serviceItems: sale.serviceItems.map((item) => ({
      id: item.id,
      vendaId: sale.id,
      serviceOfferingId: item.serviceId,
      description: item.description,
      details: item.details,
      quantity: item.quantity,
      unitPriceAtSale: decimal(item.unitPriceCents),
      createdAt: sale.soldAt,
    })),
  })
  const legacyLine = (orderId: string, line: CanonicalServiceOrderLine, updatedAt: string) => ({
    id: line.id,
    serviceOrderId: orderId,
    kind: line.kind,
    productId: line.productId,
    serviceOfferingId: line.serviceId,
    description: line.description,
    details: line.details,
    quantity: line.quantity,
    unitPrice: line.unitPriceCents / 100,
    isSupplement: line.isSupplement,
    createdAt: updatedAt,
    updatedAt,
  })
  const legacyServiceOrder = (id: string, withDetails: boolean) => {
    const order = data.serviceOrders.find((item) => item.id === id)!
    const sale = order.saleId ? data.sales.find((item) => item.id === order.saleId)! : null
    return {
      id: order.id,
      establishmentId: est.id,
      customerName: order.customerName,
      description: order.description,
      status: LEGACY_SO_STATUS[order.status],
      dueAt: order.dueAt,
      responsibleId: order.responsibleId,
      completedAt: order.completedAt,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      acceptedQuote: order.acceptedQuote?.map((line) => legacyLine(order.id, line, order.updatedAt)) ?? null,
      pendingItems: order.pendingItems.map((line) => legacyLine(order.id, line, order.updatedAt)),
      items: order.items.map((line) => legacyLine(order.id, line, order.updatedAt)),
      total: serviceOrderTotalCents(order) / 100,
      ...(withDetails ? {
        events: order.events.map((event) => ({
          id: event.id,
          serviceOrderId: order.id,
          fromStatus: event.fromStatus ? LEGACY_SO_STATUS[event.fromStatus] : null,
          toStatus: LEGACY_SO_STATUS[event.toStatus],
          action: event.action.toUpperCase(),
          createdAt: event.createdAt,
          userId: event.userId,
        })),
        sale: sale ? { id: sale.id, total: decimal(saleTotalCents(sale)), soldAt: sale.soldAt, isCancelled: sale.isCancelled } : null,
      } : {}),
    }
  }

  const activeSales = () => data.sales.filter((sale) => !sale.isCancelled)
  const inWindow = (sale: CanonicalSale, query: URLSearchParams) => {
    const from = query.get('dataInicial') ?? query.get('startDate')
    const to = query.get('dataFinal') ?? query.get('endDate')
    return (!from || sale.soldAt >= new Date(from).toISOString()) && (!to || sale.soldAt <= new Date(to).toISOString())
  }
  const productAggregates = (query: URLSearchParams) => {
    const typeId = query.get('tipoProdutoId')
    const sales = activeSales().filter((sale) => inWindow(sale, query))
    const byProduct = new Map<string, number>()
    for (const sale of sales) for (const item of sale.items) {
      if (typeId && productById(item.productId).productTypeId !== typeId) continue
      byProduct.set(item.productId, (byProduct.get(item.productId) ?? 0) + item.quantity)
    }
    // Bun computes revenue with the current price, not the price at sale.
    const rows = [...byProduct].map(([id, quantity]) => {
      const product = productById(id)
      return { id, nome: product.name, tipoProdutoId: product.productTypeId, quantidadeVendida: quantity, totalFaturado: quantity * product.priceCents / 100 }
    }).sort((left, right) => right.totalFaturado - left.totalFaturado || left.nome.localeCompare(right.nome))
    const units = rows.reduce((sum, row) => sum + row.quantidadeVendida, 0)
    const revenue = rows.reduce((sum, row) => sum + Math.round(row.totalFaturado * 100), 0) / 100
    return { rows, units, revenue, salesCount: sales.length }
  }

  return ({ method, path, query }) => {
    if (method !== 'GET') {
      if (path === '/auth/sse-token') return json({ token: 'visual-fixture' })
      return json({})
    }

    if (path === '/usuarios/me') {
      return json({ id: me.id, nome: me.name, email: me.email, role: LEGACY_ROLE[me.role], estabelecimentoId: est.id, estabelecimento: legacyEstablishment() })
    }
    // activeGuard: an establishment waiting for payment gets 402 everywhere but /usuarios/me.
    if (est.status !== 'ACTIVE') return { status: 402, body: { code: 'PAYMENT_REQUIRED', message: 'Pagamento pendente' } }
    if (path === '/estabelecimentos') return json(legacyEstablishment())
    if (path === '/establishments/preferences') return json({ profiles: est.businessProfiles, visibleModules: est.visibleModules, revision: est.preferencesRevision })

    if (path === '/pedidos') {
      const id = query.get('id')
      const open = query.get('isOpen') !== 'false'
      const list = data.orders
        .filter((order) => (id ? order.id === id : (order.status !== 'CLOSED') === open))
        .sort((left, right) => right.openedAt.localeCompare(left.openedAt))
      return json(paged(list, query, 10).map(legacyOrder), { 'X-Total-Count': String(list.length) })
    }
    if (path === '/cozinha/pedidos') {
      const list = data.orders
        .filter((order) => order.status === 'OPEN' && !order.deliveryStartedAt && order.items.some((item) => item.status !== 'DELIVERED'))
        .sort((left, right) => left.openedAt.localeCompare(right.openedAt))
        .map((order) => ({
          id: order.id,
          customerName: order.customerName,
          openedAt: order.openedAt,
          updatedAt: order.updatedAt,
          items: order.items.filter((item) => item.status !== 'DELIVERED').map((item) => ({
            id: item.id, productId: item.productId, productName: productById(item.productId).name, quantity: item.quantity,
            stage: item.status === 'READY' ? 'READY' : 'IN_PREPARATION', kitchenReadyAt: item.kitchenReadyAt,
          })),
        }))
      const limit = Number(query.get('limit') ?? 100)
      return json({ orders: paged(list, query, 100), total: list.length, page: Number(query.get('page') ?? 1), limit, totalPages: Math.ceil(list.length / limit) })
    }
    if (path === '/entregas/pedidos') {
      const list = data.orders
        .filter((order) => order.isDelivery && order.status !== 'CLOSED')
        .sort((left, right) => left.openedAt.localeCompare(right.openedAt))
        .map((order) => {
          const driver = userById(order.driverId)
          return {
            id: order.id, customerName: order.customerName, total: decimal(orderTotalCents(order)), address: order.deliveryAddress,
            openedAt: order.openedAt, updatedAt: order.updatedAt, stage: order.deliveryStartedAt ? 'DELIVERING' : 'WAITING',
            driverId: order.driverId, driverName: driver?.name ?? null, driverPhone: driver?.phone ?? null, externalDriverName: null, externalDriverPhone: null,
            items: order.items.map((item) => ({ id: item.id, productId: item.productId, unitPriceAtOrder: decimal(item.unitPriceCents), name: productById(item.productId).name, quantity: item.quantity, status: item.status })),
          }
        })
      const drivers = data.users.filter((user) => user.role === 'DRIVER').map((user) => ({
        id: user.id, name: user.name, phone: user.phone, available: !data.orders.some((order) => order.driverId === user.id && order.status === 'DELIVERING'),
      }))
      const limit = Number(query.get('limit') ?? 100)
      return json({ orders: paged(list, query, 100), drivers, total: list.length, page: Number(query.get('page') ?? 1), limit, totalPages: Math.ceil(list.length / limit) })
    }

    if (path === '/vendas') {
      const customer = query.get('cliente') ?? query.get('customerName')
      const seller = query.get('criadoPor') ?? query.get('sellerId')
      const min = query.get('totalMin')
      const max = query.get('totalMax')
      const list = activeSales()
        .filter((sale) => inWindow(sale, query) && matches(sale.customerName, customer) && (!seller || sale.sellerId === seller))
        .filter((sale) => (!min || saleTotalCents(sale) >= Number(min) * 100) && (!max || saleTotalCents(sale) <= Number(max) * 100))
      const limit = Number(query.get('limit') ?? 50)
      const page = Number(query.get('page') ?? 1)
      const closingCents = list.reduce((sum, sale) => sum + saleTotalCents(sale), 0)
      return json({
        vendas: paged(list, query, 50).map(legacySale),
        fechamento: list.length ? decimal(closingCents) : 0,
        pagination: { page, limit, total: list.length, totalPages: Math.ceil(list.length / limit), hasNextPage: page * limit < list.length },
      }, { 'X-Total-Count': String(list.length) })
    }

    if (path === '/produtos') {
      const search = query.get('search')
      const typeId = query.get('tipoProdutoId') ?? query.get('productTypeId')
      const list = data.products
        .filter((product) => typeById(product.productTypeId).isActive)
        .filter((product) => !typeId || product.productTypeId === typeId)
        .filter((product) => matches(`${product.name} ${product.ingredients ?? ''} ${typeById(product.productTypeId).description}`, search))
        .sort((left, right) => left.name.localeCompare(right.name, 'pt-BR') || left.id.localeCompare(right.id))
      return json(paged(list, query, 10).map((product) => legacyProduct(product, true)), { 'X-Total-Count': String(list.length) })
    }
    if (path === '/tipos') {
      const all = query.get('all') === 'true'
      const search = query.get('search')
      const list = data.productTypes
        .filter((type) => all || type.isActive)
        .filter((type) => matches(type.description, search))
        .sort((left, right) => left.id.localeCompare(right.id))
      const page = query.has('page') ? paged(list, query, 10) : list
      // Bun reports the page length here, not the total (known quirk).
      return json(page.map((type) => legacyType(type.id)), { 'X-Total-Count': String(page.length) })
    }
    if (path === '/usuarios') {
      const search = query.get('search')
      const list = data.users.filter((user) => matches(user.name, search))
      return json(paged(list, query, 10).map((user) => ({
        id: user.id, nome: user.name, email: user.email, telefone: user.phone, role: LEGACY_ROLE[user.role], createdAt: user.createdAt,
      })), { 'X-Total-Count': String(list.length) })
    }
    if (path === '/dispositivos') {
      return json([...data.devices].sort((left, right) => right.createdAt.localeCompare(left.createdAt)).map((device) => ({
        id: device.id,
        info: { platform: device.platform, model: device.model },
        lastSeen: device.lastSeenAt,
        lastUserId: device.lastUserId,
        createdAt: device.createdAt,
        estabelecimentoId: est.id,
        lastUserName: userById(device.lastUserId)?.name ?? null,
      })))
    }

    if (path === '/calendar') return json(calendarView(data))
    if (path === '/calendar/business-hours') return json({ hours: data.businessHours })

    if (path === '/graficos') {
      const { rows, units, revenue, salesCount } = productAggregates(query)
      const top = rows.slice(0, 10).map(({ tipoProdutoId: _type, ...row }) => row)
      const rest = rows.slice(10)
      const others = rest.length
        ? [{ id: 'outros', nome: 'Outros', quantidadeVendida: rest.reduce((sum, row) => sum + row.quantidadeVendida, 0), totalFaturado: rest.reduce((sum, row) => sum + Math.round(row.totalFaturado * 100), 0) / 100 }]
        : []
      return json({ produtos: [...top, ...others], fechamento: { totalUnidadesVendidas: units, totalFaturado: revenue, totalNumeroVendas: salesCount } })
    }
    if (path === '/graficos/lista') {
      const { rows, units, revenue } = productAggregates(query)
      return json({ produtos: paged(rows, query, 20), fechamento: { totalUnidadesVendidas: units, totalFaturado: revenue } }, { 'X-Total-Count': String(rows.length) })
    }
    if (path === '/graficos/vendas-por-horario') {
      const from = query.get('dataInicial')
      if (!from) return { status: 400, body: { code: 'VALIDATION_FAILED', message: 'dataInicial obrigatória' } }
      const dayOffset = Number(query.get('page') ?? 0)
      const start = new Date(new Date(from).getTime() + dayOffset * 86_400_000)
      const end = new Date(start.getTime() + 86_400_000)
      const last = query.get('dataFinal')
      if (last && start > new Date(last)) return json([])
      return json(activeSales()
        .filter((sale) => sale.soldAt >= start.toISOString() && sale.soldAt < end.toISOString())
        .sort((left, right) => left.soldAt.localeCompare(right.soldAt))
        .map((sale) => ({ id: sale.id, horario: sale.soldAt, total: decimal(saleTotalCents(sale)), cliente: sale.customerName })))
    }

    if (path === '/servicos') {
      const search = query.get('search')
      const list = data.services
        .filter((service) => service.isActive && matches(`${service.name} ${service.description ?? ''}`, search))
        .sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'))
      return json(paged(list, query, 20).map((service) => ({
        id: service.id, name: service.name, description: service.description,
        referencePrice: service.referencePriceCents === null ? null : service.referencePriceCents / 100,
        deletedAt: null, createdAt: service.createdAt, updatedAt: service.updatedAt, establishmentId: est.id,
      })), { 'X-Total-Count': String(list.length) })
    }
    if (path === '/ordens-servico') {
      const stage = query.get('stage')
      const open = query.get('open')
      const status = query.get('status')
      const search = query.get('search')
      const openStatuses: ServiceOrderStatus[] = stage === 'estimates' ? ['OPEN', 'QUOTED'] : stage === 'services' ? ['APPROVED', 'IN_PROGRESS'] : ['OPEN', 'QUOTED', 'APPROVED', 'IN_PROGRESS']
      const list = data.serviceOrders
        .filter((order) => stage !== 'services' || order.acceptedQuote)
        .filter((order) => open === null || openStatuses.includes(order.status) === (open === 'true'))
        .filter((order) => !status || LEGACY_SO_STATUS[order.status] === status)
        .filter((order) => matches(`${order.customerName} ${order.description}`, search))
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      return json(paged(list, query, 20).map((order) => legacyServiceOrder(order.id, false)), { 'X-Total-Count': String(list.length) })
    }
    const serviceOrder = /^\/ordens-servico\/([^/]+)$/.exec(path)
    if (serviceOrder) {
      return data.serviceOrders.some((order) => order.id === serviceOrder[1])
        ? json(legacyServiceOrder(serviceOrder[1]!, true))
        : { status: 404, body: { code: 'NOT_FOUND', message: 'Ordem de serviço não encontrada' } }
    }
    return undefined
  }
}

/** /calendar is English on both APIs (the front skips legacyWire for it). */
export function calendarView(data: CanonicalDataset) {
  const person = (id: string | null) => {
    const user = data.users.find((item) => item.id === id)
    return user ? { id: user.id, name: user.name } : null
  }
  return {
    employees: data.users.map((user) => ({ id: user.id, name: user.name, role: user.role })),
    events: data.calendarEvents.map((event) => ({ ...event, employee: person(event.employeeId) })),
    shifts: data.shifts.map((shift) => ({
      ...shift,
      assignments: shift.assignments.map((assignment) => ({ ...assignment, employee: person(assignment.employeeId) })),
    })),
  }
}
