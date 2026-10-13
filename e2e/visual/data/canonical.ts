// Canonical dataset for the visual regression baseline (plan S0).
// One source of truth, serialized to the legacy Bun wire (legacy.ts) and to
// the /v1 contract (v1.ts). Everything is deterministic: fixed dates, seeded
// pseudo-random generation, money in integer cents.

export const FIXED_NOW = '2026-10-01T18:00:00.000Z' // Thursday, 15:00 in America/Sao_Paulo
export const TIMEZONE = 'America/Sao_Paulo'

export type Role = 'OWNER' | 'MANAGER' | 'EMPLOYEE' | 'COOK' | 'DRIVER'
export type PaymentMethod = 'CASH' | 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'ON_ACCOUNT'
export type OrderItemStatus = 'REQUESTED' | 'IN_PREPARATION' | 'READY' | 'DELIVERED'
export type OrderStatus = 'OPEN' | 'DELIVERING' | 'CLOSED'
export type ServiceOrderStatus = 'OPEN' | 'QUOTED' | 'APPROVED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'

export interface CanonicalEstablishment {
  id: string
  tradeName: string
  status: 'ACTIVE' | 'PENDING_PAYMENT'
  plan: 'FREE' | 'PAID'
  category: string | null
  businessProfiles: ('FOOD' | 'STORE' | 'SERVICES')[]
  visibleModules: string[]
  preferencesRevision: number
  extraDevices: number
  phone: string
  createdAt: string
}

export interface CanonicalUser { id: string; name: string; email: string; role: Role; phone: string | null; createdAt: string }
export interface CanonicalProductType { id: string; description: string; color: string; isActive: boolean }
export interface CanonicalProduct { id: string; name: string; priceCents: number; productTypeId: string; ingredients: string | null; imageUrl: string | null }
export interface CanonicalOrderItem { id: string; productId: string; quantity: number; status: OrderItemStatus; unitPriceCents: number; kitchenReadyAt: string | null }
export interface CanonicalOrder {
  id: string
  number: number
  customerName: string | null
  status: OrderStatus
  isDelivery: boolean
  deliveryAddress: string | null
  deliveryStartedAt: string | null
  driverId: string | null
  createdById: string
  openedAt: string
  updatedAt: string
  closedAt: string | null
  paymentMethod: PaymentMethod | null
  items: CanonicalOrderItem[]
}
export interface CanonicalSaleItem { id: string; productId: string; quantity: number; unitPriceCents: number }
export interface CanonicalSaleServiceItem { id: string; serviceId: string | null; description: string; details: string | null; quantity: number; unitPriceCents: number }
export interface CanonicalSale {
  id: string
  customerName: string | null
  soldAt: string
  sellerId: string
  paymentMethod: PaymentMethod
  isCancelled: boolean
  items: CanonicalSaleItem[]
  serviceItems: CanonicalSaleServiceItem[]
}
export interface CanonicalService { id: string; name: string; description: string | null; referencePriceCents: number | null; isActive: boolean; createdAt: string; updatedAt: string }
export interface CanonicalServiceOrderLine { id: string; kind: 'PRODUCT' | 'SERVICE'; productId: string | null; serviceId: string | null; description: string; details: string | null; quantity: number; unitPriceCents: number; isSupplement: boolean }
export interface CanonicalServiceOrderEvent { id: string; fromStatus: ServiceOrderStatus | null; toStatus: ServiceOrderStatus; action: string; createdAt: string; userId: string }
export interface CanonicalServiceOrder {
  id: string
  number: number
  customerName: string
  description: string
  status: ServiceOrderStatus
  dueAt: string | null
  responsibleId: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
  items: CanonicalServiceOrderLine[]
  acceptedQuote: CanonicalServiceOrderLine[] | null
  pendingItems: CanonicalServiceOrderLine[]
  events: CanonicalServiceOrderEvent[]
  saleId: string | null
}
export interface CanonicalDevice { id: string; platform: 'android' | 'ios'; model: string; lastUserId: string | null; lastSeenAt: string; createdAt: string }
// Calendar dates are local (America/Sao_Paulo) `YYYY-MM-DD` + `HH:mm`, as both APIs send them.
export interface CanonicalCalendarEvent { id: string; type: 'SHIFT' | 'SPECIAL'; title: string | null; employeeId: string | null; startDate: string; startTime: string; endDate: string; endTime: string; repeatWeekly: boolean; repeatUntil: string | null }
export interface CanonicalShiftAssignment { id: string; employeeId: string; startDate: string; startTime: string; endDate: string; endTime: string }
export interface CanonicalShift { id: string; title: string; startDate: string; startTime: string; endDate: string; endTime: string; repeatWeekly: boolean; repeatUntil: string | null; assignments: CanonicalShiftAssignment[] }
export interface CanonicalBusinessHours { daysOfWeek: number[]; startTime: string; endTime: string }

export interface CanonicalDataset {
  establishment: CanonicalEstablishment
  users: CanonicalUser[]
  productTypes: CanonicalProductType[]
  products: CanonicalProduct[]
  orders: CanonicalOrder[]
  sales: CanonicalSale[]
  services: CanonicalService[]
  serviceOrders: CanonicalServiceOrder[]
  devices: CanonicalDevice[]
  calendarEvents: CanonicalCalendarEvent[]
  shifts: CanonicalShift[]
  businessHours: CanonicalBusinessHours[]
}

// mulberry32: tiny seeded PRNG so the 200 sales are identical on every run.
function prng(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const iso = (value: string) => new Date(value).toISOString()
const pad = (value: number, size = 3) => String(value).padStart(size, '0')

const establishment: CanonicalEstablishment = {
  id: 'est-001',
  tradeName: 'Tozzo Burger & Oficina',
  status: 'ACTIVE',
  plan: 'PAID',
  category: 'BURGER_SHOP',
  businessProfiles: ['FOOD', 'SERVICES'],
  visibleModules: ['ORDERS', 'KITCHEN', 'DELIVERIES', 'SALES', 'PRODUCTS', 'SERVICES', 'ESTIMATES', 'SERVICE_ORDERS', 'EMPLOYEES', 'SCHEDULE', 'DEVICES', 'REPORTS', 'SETTINGS'],
  preferencesRevision: 3,
  extraDevices: 1,
  phone: '+55 11 98765-4321',
  createdAt: iso('2026-01-15T12:00:00Z'),
}

const users: CanonicalUser[] = [
  { id: 'usr-owner', name: 'Victor Tozzo', email: 'owner@example.invalid', role: 'OWNER', phone: '+55 11 90000-0001', createdAt: iso('2026-01-15T12:00:00Z') },
  { id: 'usr-manager', name: 'Mariana Alves', email: 'manager@example.invalid', role: 'MANAGER', phone: '+55 11 90000-0002', createdAt: iso('2026-02-01T12:00:00Z') },
  { id: 'usr-employee', name: 'Carlos Souza', email: 'employee@example.invalid', role: 'EMPLOYEE', phone: null, createdAt: iso('2026-02-10T12:00:00Z') },
  { id: 'usr-employee-2', name: 'Juliana Rocha', email: 'juliana@example.invalid', role: 'EMPLOYEE', phone: '+55 11 90000-0004', createdAt: iso('2026-03-05T12:00:00Z') },
  { id: 'usr-cook', name: 'Rafael Lima', email: 'cook@example.invalid', role: 'COOK', phone: null, createdAt: iso('2026-03-12T12:00:00Z') },
  { id: 'usr-driver', name: 'Pedro Martins', email: 'driver@example.invalid', role: 'DRIVER', phone: '+55 11 90000-0006', createdAt: iso('2026-04-20T12:00:00Z') },
]

const productTypes: CanonicalProductType[] = [
  { id: 'type-burgers', description: 'Hambúrgueres', color: '#ef4444', isActive: true },
  { id: 'type-sides', description: 'Acompanhamentos', color: '#f59e0b', isActive: true },
  { id: 'type-drinks', description: 'Bebidas', color: '#3b82f6', isActive: true },
  { id: 'type-desserts', description: 'Sobremesas', color: '#ec4899', isActive: true },
  { id: 'type-parts', description: 'Peças', color: '#64748b', isActive: true },
]

const productSeeds: [string, number, string, string | null][] = [
  ['X-Burger', 2490, 'type-burgers', 'Pão, carne 150 g, queijo'],
  ['X-Salada', 2690, 'type-burgers', 'Pão, carne 150 g, queijo, alface, tomate'],
  ['X-Bacon', 2990, 'type-burgers', 'Pão, carne 150 g, queijo, bacon'],
  ['X-Egg', 2790, 'type-burgers', 'Pão, carne 150 g, queijo, ovo'],
  ['X-Tudo', 3490, 'type-burgers', 'Pão, 2 carnes, queijo, bacon, ovo, salada'],
  ['Smash Duplo', 3290, 'type-burgers', 'Pão brioche, 2 smash 90 g, cheddar'],
  ['Veggie', 2890, 'type-burgers', 'Pão integral, grão-de-bico, rúcula'],
  ['Frango Crispy', 2790, 'type-burgers', 'Pão, frango empanado, maionese verde'],
  ['Batata Frita P', 1290, 'type-sides', null],
  ['Batata Frita G', 1890, 'type-sides', null],
  ['Onion Rings', 1690, 'type-sides', 'Cebola empanada'],
  ['Nuggets (10 un.)', 1990, 'type-sides', null],
  ['Batata com Cheddar e Bacon', 2490, 'type-sides', 'Batata, cheddar cremoso, bacon'],
  ['Refrigerante Lata', 690, 'type-drinks', null],
  ['Refrigerante 2 L', 1490, 'type-drinks', null],
  ['Suco Natural', 990, 'type-drinks', 'Laranja, limão ou maracujá'],
  ['Água Mineral', 450, 'type-drinks', null],
  ['Água com Gás', 550, 'type-drinks', null],
  ['Milkshake Chocolate', 1890, 'type-drinks', 'Sorvete, leite, calda de chocolate'],
  ['Milkshake Morango', 1890, 'type-drinks', 'Sorvete, leite, calda de morango'],
  ['Cerveja Long Neck', 1190, 'type-drinks', null],
  ['Brownie', 1390, 'type-desserts', 'Brownie com nozes'],
  ['Petit Gâteau', 2190, 'type-desserts', 'Bolo de chocolate, sorvete de creme'],
  ['Pudim', 990, 'type-desserts', null],
  ['Sundae', 1290, 'type-desserts', 'Sorvete, calda, amendoim'],
  ['Óleo de Motor 5W30', 4000, 'type-parts', 'Lubrificante sintético 1 L'],
  ['Filtro de Óleo', 3500, 'type-parts', null],
  ['Pastilha de Freio', 12900, 'type-parts', 'Jogo dianteiro'],
  ['Palheta Limpador', 5900, 'type-parts', 'Par'],
  ['Lâmpada H4', 2900, 'type-parts', null],
]

const products: CanonicalProduct[] = productSeeds.map(([name, priceCents, productTypeId, ingredients], index) => ({
  id: `prd-${pad(index + 1)}`,
  name,
  priceCents,
  productTypeId,
  ingredients,
  imageUrl: null,
}))

const priceOf = (productId: string) => products.find((product) => product.id === productId)!.priceCents

function orderItem(orderIndex: number, itemIndex: number, productIndex: number, quantity: number, status: OrderItemStatus, readyAt: string | null = null): CanonicalOrderItem {
  const productId = products[productIndex]!.id
  return { id: `ori-${pad(orderIndex)}-${itemIndex}`, productId, quantity, status, unitPriceCents: priceOf(productId), kitchenReadyAt: readyAt }
}

// Orders in every state: open with items in each kitchen status, open delivery,
// delivering, closed counter order and closed delivery order.
const orders: CanonicalOrder[] = [
  { id: 'ord-001', number: 101, customerName: 'Mesa 3', status: 'OPEN', isDelivery: false, deliveryAddress: null, deliveryStartedAt: null, driverId: null, createdById: 'usr-employee', openedAt: iso('2026-10-01T17:05:00Z'), updatedAt: iso('2026-10-01T17:20:00Z'), closedAt: null, paymentMethod: null,
    items: [orderItem(1, 1, 0, 2, 'REQUESTED'), orderItem(1, 2, 8, 1, 'REQUESTED'), orderItem(1, 3, 13, 2, 'DELIVERED')] },
  { id: 'ord-002', number: 102, customerName: 'Ana Paula', status: 'OPEN', isDelivery: false, deliveryAddress: null, deliveryStartedAt: null, driverId: null, createdById: 'usr-manager', openedAt: iso('2026-10-01T17:12:00Z'), updatedAt: iso('2026-10-01T17:30:00Z'), closedAt: null, paymentMethod: null,
    items: [orderItem(2, 1, 4, 1, 'IN_PREPARATION'), orderItem(2, 2, 10, 1, 'IN_PREPARATION'), orderItem(2, 3, 18, 1, 'REQUESTED')] },
  { id: 'ord-003', number: 103, customerName: 'Balcão', status: 'OPEN', isDelivery: false, deliveryAddress: null, deliveryStartedAt: null, driverId: null, createdById: 'usr-employee-2', openedAt: iso('2026-10-01T17:25:00Z'), updatedAt: iso('2026-10-01T17:48:00Z'), closedAt: null, paymentMethod: null,
    items: [orderItem(3, 1, 5, 2, 'READY', iso('2026-10-01T17:48:00Z')), orderItem(3, 2, 9, 1, 'READY', iso('2026-10-01T17:48:00Z'))] },
  { id: 'ord-004', number: 104, customerName: 'Bruno Ferreira', status: 'OPEN', isDelivery: true, deliveryAddress: 'Rua das Flores, 120 — Centro', deliveryStartedAt: null, driverId: null, createdById: 'usr-employee', openedAt: iso('2026-10-01T17:31:00Z'), updatedAt: iso('2026-10-01T17:50:00Z'), closedAt: null, paymentMethod: null,
    items: [orderItem(4, 1, 2, 2, 'READY', iso('2026-10-01T17:50:00Z')), orderItem(4, 2, 14, 1, 'DELIVERED')] },
  { id: 'ord-005', number: 105, customerName: 'Camila Duarte', status: 'DELIVERING', isDelivery: true, deliveryAddress: 'Av. Paulista, 1500 — ap. 42', deliveryStartedAt: iso('2026-10-01T17:40:00Z'), driverId: 'usr-driver', createdById: 'usr-manager', openedAt: iso('2026-10-01T17:02:00Z'), updatedAt: iso('2026-10-01T17:40:00Z'), closedAt: null, paymentMethod: null,
    items: [orderItem(5, 1, 6, 1, 'DELIVERED'), orderItem(5, 2, 15, 2, 'DELIVERED')] },
  { id: 'ord-006', number: 106, customerName: 'Mesa 7', status: 'OPEN', isDelivery: false, deliveryAddress: null, deliveryStartedAt: null, driverId: null, createdById: 'usr-owner', openedAt: iso('2026-10-01T17:44:00Z'), updatedAt: iso('2026-10-01T17:44:00Z'), closedAt: null, paymentMethod: null,
    items: [orderItem(6, 1, 7, 1, 'REQUESTED'), orderItem(6, 2, 11, 1, 'REQUESTED'), orderItem(6, 3, 21, 2, 'REQUESTED')] },
  { id: 'ord-007', number: 99, customerName: 'Mesa 1', status: 'CLOSED', isDelivery: false, deliveryAddress: null, deliveryStartedAt: null, driverId: null, createdById: 'usr-employee', openedAt: iso('2026-10-01T15:10:00Z'), updatedAt: iso('2026-10-01T16:00:00Z'), closedAt: iso('2026-10-01T16:00:00Z'), paymentMethod: 'PIX',
    items: [orderItem(7, 1, 1, 2, 'DELIVERED'), orderItem(7, 2, 13, 2, 'DELIVERED')] },
  { id: 'ord-008', number: 100, customerName: 'Diego Ramos', status: 'CLOSED', isDelivery: true, deliveryAddress: 'Rua Augusta, 300', deliveryStartedAt: iso('2026-10-01T16:10:00Z'), driverId: 'usr-driver', createdById: 'usr-manager', openedAt: iso('2026-10-01T15:40:00Z'), updatedAt: iso('2026-10-01T16:35:00Z'), closedAt: iso('2026-10-01T16:35:00Z'), paymentMethod: 'CREDIT_CARD',
    items: [orderItem(8, 1, 4, 1, 'DELIVERED'), orderItem(8, 2, 9, 1, 'DELIVERED')] },
]

const services: CanonicalService[] = [
  { id: 'svc-001', name: 'Troca de óleo', description: 'Drenagem, troca do filtro e reposição do óleo.', referencePriceCents: 8000, isActive: true, createdAt: iso('2026-05-01T12:00:00Z'), updatedAt: iso('2026-05-01T12:00:00Z') },
  { id: 'svc-002', name: 'Alinhamento e balanceamento', description: 'Quatro rodas, com relatório impresso.', referencePriceCents: 12000, isActive: true, createdAt: iso('2026-05-01T12:00:00Z'), updatedAt: iso('2026-05-01T12:00:00Z') },
  { id: 'svc-003', name: 'Revisão de freios', description: 'Inspeção de discos, pastilhas e fluido.', referencePriceCents: 15000, isActive: true, createdAt: iso('2026-05-02T12:00:00Z'), updatedAt: iso('2026-05-02T12:00:00Z') },
  { id: 'svc-004', name: 'Higienização completa', description: 'Aspiração, limpeza dos bancos e painel, polimento.', referencePriceCents: 25000, isActive: true, createdAt: iso('2026-05-03T12:00:00Z'), updatedAt: iso('2026-05-03T12:00:00Z') },
  { id: 'svc-005', name: 'Diagnóstico eletrônico', description: null, referencePriceCents: null, isActive: true, createdAt: iso('2026-05-04T12:00:00Z'), updatedAt: iso('2026-05-04T12:00:00Z') },
  { id: 'svc-006', name: 'Troca de palhetas', description: 'Mão de obra.', referencePriceCents: 3000, isActive: false, createdAt: iso('2026-05-05T12:00:00Z'), updatedAt: iso('2026-06-01T12:00:00Z') },
]

function line(orderNumber: number, index: number, source: { productIndex?: number; serviceIndex?: number; oneOff?: string }, quantity: number, isSupplement = false): CanonicalServiceOrderLine {
  if (source.productIndex !== undefined) {
    const product = products[source.productIndex]!
    return { id: `sol-${orderNumber}-${index}`, kind: 'PRODUCT', productId: product.id, serviceId: null, description: product.name, details: product.ingredients, quantity, unitPriceCents: product.priceCents, isSupplement }
  }
  if (source.serviceIndex !== undefined) {
    const service = services[source.serviceIndex]!
    return { id: `sol-${orderNumber}-${index}`, kind: 'SERVICE', productId: null, serviceId: service.id, description: service.name, details: service.description, quantity, unitPriceCents: service.referencePriceCents ?? 10000, isSupplement }
  }
  return { id: `sol-${orderNumber}-${index}`, kind: 'SERVICE', productId: null, serviceId: null, description: source.oneOff!, details: null, quantity, unitPriceCents: 6000, isSupplement }
}

function soEvents(number: number, path: ServiceOrderStatus[], start: string): CanonicalServiceOrderEvent[] {
  const actions: Record<ServiceOrderStatus, string> = { OPEN: 'create', QUOTED: 'quote', APPROVED: 'approve', IN_PROGRESS: 'start', COMPLETED: 'complete', CANCELLED: 'cancel' }
  return path.map((toStatus, index) => ({
    id: `soe-${number}-${index + 1}`,
    fromStatus: index === 0 ? null : path[index - 1]!,
    toStatus,
    action: actions[toStatus],
    createdAt: new Date(new Date(start).getTime() + index * 3_600_000).toISOString(),
    userId: 'usr-manager',
  }))
}

const quoted = (number: number) => [line(number, 1, { serviceIndex: 0 }, 1), line(number, 2, { productIndex: 25 }, 4), line(number, 3, { productIndex: 26 }, 1)]
const brakes = (number: number) => [line(number, 1, { serviceIndex: 2 }, 1), line(number, 2, { productIndex: 27 }, 1)]

// Service orders: one per status, plus a second approved one with pending supplements.
const serviceOrders: CanonicalServiceOrder[] = [
  { id: 'so-001', number: 1, customerName: 'Fernanda Lopes — Gol 2015', description: 'Barulho ao frear e luz do óleo acesa.', status: 'OPEN', dueAt: iso('2026-10-03T21:00:00Z'), responsibleId: null, completedAt: null, createdAt: iso('2026-10-01T13:00:00Z'), updatedAt: iso('2026-10-01T13:00:00Z'),
    items: [], acceptedQuote: null, pendingItems: [], events: soEvents(1, ['OPEN'], '2026-10-01T13:00:00Z'), saleId: null },
  { id: 'so-002', number: 2, customerName: 'Ricardo Nunes — Onix 2020', description: 'Revisão dos 40 mil km.', status: 'QUOTED', dueAt: iso('2026-10-04T21:00:00Z'), responsibleId: 'usr-employee', completedAt: null, createdAt: iso('2026-09-30T13:00:00Z'), updatedAt: iso('2026-09-30T15:00:00Z'),
    items: quoted(2), acceptedQuote: null, pendingItems: [], events: soEvents(2, ['OPEN', 'QUOTED'], '2026-09-30T13:00:00Z'), saleId: null },
  { id: 'so-003', number: 3, customerName: 'Patrícia Gomes — HB20 2019', description: 'Freios dianteiros rangendo.', status: 'APPROVED', dueAt: iso('2026-10-02T21:00:00Z'), responsibleId: 'usr-employee-2', completedAt: null, createdAt: iso('2026-09-29T13:00:00Z'), updatedAt: iso('2026-09-29T16:00:00Z'),
    items: brakes(3), acceptedQuote: brakes(3), pendingItems: [], events: soEvents(3, ['OPEN', 'QUOTED', 'APPROVED'], '2026-09-29T13:00:00Z'), saleId: null },
  { id: 'so-004', number: 4, customerName: 'Gustavo Pires — Corolla 2018', description: 'Higienização e troca de óleo.', status: 'IN_PROGRESS', dueAt: iso('2026-10-01T21:00:00Z'), responsibleId: 'usr-employee', completedAt: null, createdAt: iso('2026-09-28T13:00:00Z'), updatedAt: iso('2026-10-01T12:00:00Z'),
    items: [line(4, 1, { serviceIndex: 3 }, 1), line(4, 2, { serviceIndex: 0 }, 1), line(4, 3, { productIndex: 25 }, 4)],
    acceptedQuote: [line(4, 1, { serviceIndex: 3 }, 1), line(4, 2, { serviceIndex: 0 }, 1), line(4, 3, { productIndex: 25 }, 4)],
    pendingItems: [line(4, 4, { productIndex: 28 }, 1, true), line(4, 5, { oneOff: 'Limpeza do ar-condicionado' }, 1, true)],
    events: soEvents(4, ['OPEN', 'QUOTED', 'APPROVED', 'IN_PROGRESS'], '2026-09-28T13:00:00Z'), saleId: null },
  { id: 'so-005', number: 5, customerName: 'Luciana Teixeira — Kwid 2021', description: 'Alinhamento.', status: 'COMPLETED', dueAt: iso('2026-09-27T21:00:00Z'), responsibleId: 'usr-employee-2', completedAt: iso('2026-09-27T19:00:00Z'), createdAt: iso('2026-09-27T12:00:00Z'), updatedAt: iso('2026-09-27T19:00:00Z'),
    items: [line(5, 1, { serviceIndex: 1 }, 1)], acceptedQuote: [line(5, 1, { serviceIndex: 1 }, 1)], pendingItems: [],
    events: soEvents(5, ['OPEN', 'QUOTED', 'APPROVED', 'IN_PROGRESS', 'COMPLETED'], '2026-09-27T12:00:00Z'), saleId: 'sale-so-005' },
  { id: 'so-006', number: 6, customerName: 'Marcos Vieira — Uno 2012', description: 'Orçamento recusado pelo cliente.', status: 'CANCELLED', dueAt: null, responsibleId: null, completedAt: null, createdAt: iso('2026-09-25T12:00:00Z'), updatedAt: iso('2026-09-26T12:00:00Z'),
    items: [line(6, 1, { serviceIndex: 4 }, 1)], acceptedQuote: null, pendingItems: [],
    events: soEvents(6, ['OPEN', 'QUOTED', 'CANCELLED'], '2026-09-25T12:00:00Z'), saleId: null },
]

const sellers = ['usr-owner', 'usr-manager', 'usr-employee', 'usr-employee-2']
const payments: PaymentMethod[] = ['CASH', 'PIX', 'PIX', 'CREDIT_CARD', 'DEBIT_CARD', 'ON_ACCOUNT']
const customers = [null, 'Ana Paula', 'Bruno Ferreira', 'Camila Duarte', 'Diego Ramos', 'Mesa 2', 'Mesa 5', 'Balcão', 'Eduarda Melo', 'Felipe Santos']

// 200 sales: 199 product sales spread over Sept 1 – Oct 1 (11:00–23:00 local),
// plus the sale produced by the completed service order. Newest first.
function buildSales(): CanonicalSale[] {
  const random = prng(20261001)
  const pick = <T>(list: readonly T[]) => list[Math.floor(random() * list.length)]!
  const start = new Date('2026-09-01T14:00:00Z').getTime() // 11:00 local
  const end = new Date('2026-10-01T17:30:00Z').getTime()
  const generated: CanonicalSale[] = []
  for (let index = 0; index < 199; index += 1) {
    const day = Math.floor(random() * 31)
    const minute = Math.floor(random() * 12 * 60)
    let soldAt = start + day * 86_400_000 + minute * 60_000
    // The sales tab defaults to the last 24 h, so the first 30 land there.
    if (index < 30) soldAt = end - Math.floor(random() * 23 * 60) * 60_000
    if (soldAt > end) soldAt = end - Math.floor(random() * 6 * 60) * 60_000
    const itemCount = 1 + Math.floor(random() * 3)
    const used = new Set<number>()
    const items: CanonicalSaleItem[] = []
    for (let itemIndex = 0; itemIndex < itemCount; itemIndex += 1) {
      let productIndex = Math.floor(random() * 25) // food catalog only
      while (used.has(productIndex)) productIndex = (productIndex + 1) % 25
      used.add(productIndex)
      const product = products[productIndex]!
      items.push({ id: '', productId: product.id, quantity: 1 + Math.floor(random() * 3), unitPriceCents: product.priceCents })
    }
    generated.push({
      id: '',
      customerName: pick(customers),
      soldAt: new Date(soldAt).toISOString(),
      sellerId: pick(sellers),
      paymentMethod: pick(payments),
      isCancelled: random() < 0.04,
      items,
      serviceItems: [],
    })
  }
  const completed = serviceOrders.find((order) => order.saleId === 'sale-so-005')!
  generated.push({
    id: 'sale-so-005',
    customerName: completed.customerName,
    soldAt: completed.completedAt!,
    sellerId: 'usr-employee-2',
    paymentMethod: 'PIX',
    isCancelled: false,
    items: [],
    serviceItems: completed.items.map((item) => ({ id: `ssi-${item.id}`, serviceId: null, description: item.description, details: item.details, quantity: item.quantity, unitPriceCents: item.unitPriceCents })),
  })
  generated.sort((left, right) => right.soldAt.localeCompare(left.soldAt))
  return generated.map((sale, index) => {
    const id = sale.id || `sale-${pad(200 - index)}`
    return { ...sale, id, items: sale.items.map((item, itemIndex) => ({ ...item, id: `${id}-i${itemIndex + 1}` })) }
  })
}

const devices: CanonicalDevice[] = [
  { id: 'dev-001', platform: 'android', model: 'Samsung Galaxy A54', lastUserId: 'usr-employee', lastSeenAt: iso('2026-10-01T17:55:00Z'), createdAt: iso('2026-02-10T12:00:00Z') },
  { id: 'dev-002', platform: 'android', model: 'Motorola Moto G84', lastUserId: 'usr-cook', lastSeenAt: iso('2026-10-01T17:58:00Z'), createdAt: iso('2026-03-12T12:00:00Z') },
  { id: 'dev-003', platform: 'android', model: 'Xiaomi Redmi Note 13', lastUserId: null, lastSeenAt: iso('2026-09-20T22:10:00Z'), createdAt: iso('2026-04-20T12:00:00Z') },
]

// Week of the fixed date: Sun 27 Sep – Sat 3 Oct 2026.
const calendarEvents: CanonicalCalendarEvent[] = [
  { id: 'cal-001', type: 'SHIFT', title: null, employeeId: 'usr-employee', startDate: '2026-09-28', startTime: '09:00', endDate: '2026-09-28', endTime: '17:00', repeatWeekly: true, repeatUntil: null },
  { id: 'cal-002', type: 'SHIFT', title: null, employeeId: 'usr-driver', startDate: '2026-09-30', startTime: '18:00', endDate: '2026-09-30', endTime: '23:00', repeatWeekly: true, repeatUntil: null },
  { id: 'cal-003', type: 'SPECIAL', title: 'Reunião de equipe', employeeId: null, startDate: '2026-09-29', startTime: '10:00', endDate: '2026-09-29', endTime: '11:00', repeatWeekly: false, repeatUntil: null },
  { id: 'cal-004', type: 'SPECIAL', title: 'Entrega de fornecedor', employeeId: 'usr-cook', startDate: '2026-10-01', startTime: '09:00', endDate: '2026-10-01', endTime: '09:30', repeatWeekly: false, repeatUntil: null },
  { id: 'cal-005', type: 'SPECIAL', title: 'Manutenção da chapa', employeeId: null, startDate: '2026-10-02', startTime: '14:00', endDate: '2026-10-02', endTime: '16:00', repeatWeekly: false, repeatUntil: null },
]

const assignment = (id: string, employeeId: string, date: string, startTime: string, endTime: string): CanonicalShiftAssignment =>
  ({ id, employeeId, startDate: date, startTime, endDate: date, endTime })

const shifts: CanonicalShift[] = [
  { id: 'shf-001', title: 'Almoço', startDate: '2026-09-28', startTime: '11:00', endDate: '2026-09-28', endTime: '15:00', repeatWeekly: true, repeatUntil: null,
    assignments: [assignment('sha-001', 'usr-employee-2', '2026-09-28', '11:00', '15:00'), assignment('sha-002', 'usr-cook', '2026-09-28', '11:00', '15:00')] },
  { id: 'shf-002', title: 'Noite', startDate: '2026-10-01', startTime: '18:00', endDate: '2026-10-01', endTime: '23:00', repeatWeekly: true, repeatUntil: null,
    assignments: [assignment('sha-003', 'usr-employee-2', '2026-10-01', '18:00', '23:00'), assignment('sha-004', 'usr-cook', '2026-10-01', '18:00', '23:00')] },
]

const businessHours: CanonicalBusinessHours[] = [
  { daysOfWeek: [1, 2, 3, 4, 5], startTime: '11:00', endTime: '23:00' },
  { daysOfWeek: [0, 6], startTime: '12:00', endTime: '22:00' },
]

export const canonical: CanonicalDataset = {
  establishment,
  users,
  productTypes,
  products,
  orders,
  sales: buildSales(),
  services,
  serviceOrders,
  devices,
  calendarEvents,
  shifts,
  businessHours,
}

export const orderTotalCents = (order: CanonicalOrder) => order.items.reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0)
export const saleTotalCents = (sale: CanonicalSale) =>
  sale.items.reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0) +
  sale.serviceItems.reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0)
export const serviceOrderTotalCents = (order: CanonicalServiceOrder) => order.items.reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0)
export const userName = (id: string | null) => canonical.users.find((user) => user.id === id)?.name ?? null
export const productById = (id: string) => canonical.products.find((product) => product.id === id)!
export const typeById = (id: string) => canonical.productTypes.find((type) => type.id === id)!
