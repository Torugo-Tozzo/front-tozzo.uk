import { api } from './client'
import { unwrap } from './errors'
import type { components } from './schema'

export type Order = components['schemas']['Order']
export type OrderItem = components['schemas']['OrderItem']
export type OrderPage = components['schemas']['OrderPage']
export type CreateOrderRequest = components['schemas']['CreateOrderRequest']
export type UpdateOrderRequest = components['schemas']['UpdateOrderRequest']
export type PaymentMethod = NonNullable<components['schemas']['Sale']['paymentMethod']>
export type KitchenOrder = components['schemas']['KitchenOrder']
export type KitchenItem = components['schemas']['KitchenItem']
export type KitchenActionRequest = components['schemas']['KitchenActionRequest']
export type DeliveryPage = components['schemas']['DeliveryPage']
export type BoardDriver = components['schemas']['BoardDriver']
export type DeliveryActionRequest = components['schemas']['DeliveryActionRequest']

/**
 * Query keys of the operation screens. They are the keys realtime.ts
 * invalidates on `order.changed` (orders, kitchen, delivery): every query of
 * these screens starts with one of them, so an event refreshes it.
 */
export const operationKeys = {
  orders: ['orders'] as const,
  kitchen: ['kitchen'] as const,
  delivery: ['delivery'] as const,
}

export interface OrderFilters {
  customerName?: string
  sellerId?: string
  minTotalCents?: number
  maxTotalCents?: number
}

const text = (value: string | undefined) => (value?.trim() ? value.trim() : undefined)
const cents = (value: number | undefined) => (value == null ? undefined : String(value))

/** One cursor page of the open orders (newest first), with `total` for "Página N de M". */
export async function listOrders(query: OrderFilters & { cursor?: string; limit?: number }, signal?: AbortSignal): Promise<OrderPage> {
  const page = unwrap(await api.GET('/v1/orders', {
    params: {
      query: {
        customerName: text(query.customerName),
        sellerId: text(query.sellerId),
        minTotalCents: cents(query.minTotalCents),
        maxTotalCents: cents(query.maxTotalCents),
        cursor: query.cursor,
        limit: query.limit,
      },
    },
    signal,
  }))
  return { ...page, items: page.items ?? [] }
}

export async function getOrder(id: string, signal?: AbortSignal): Promise<Order> {
  return unwrap(await api.GET('/v1/orders/{id}', { params: { path: { id } }, signal }))
}

export async function createOrder(body: CreateOrderRequest): Promise<Order> {
  return unwrap(await api.POST('/v1/orders', { body }))
}

export async function updateOrder(id: string, body: UpdateOrderRequest): Promise<Order> {
  return unwrap(await api.PUT('/v1/orders/{id}', { params: { path: { id } }, body }))
}

export async function deleteOrder(id: string): Promise<void> {
  unwrap(await api.DELETE('/v1/orders/{id}', { params: { path: { id } } }))
}

/** Closes the order into a sale. */
export async function closeOrder(id: string, paymentMethod: PaymentMethod | null) {
  return unwrap(await api.POST('/v1/orders/{id}/close', {
    params: { path: { id } },
    body: paymentMethod ? { paymentMethod } : {},
  }))
}

export async function setOrderItemStatus(orderId: string, itemId: string, status: string): Promise<Order> {
  return unwrap(await api.PATCH('/v1/orders/{id}/items/{itemId}', {
    params: { path: { id: orderId, itemId } },
    body: { status },
  }))
}

// The boards (kitchen and delivery) show every open order at once, like the
// React app did with page=1..totalPages: the cursor is followed to the end.
const BOARD_PAGE = 100

/** Every order on the kitchen board (oldest first). */
export async function listKitchenOrders(signal?: AbortSignal): Promise<KitchenOrder[]> {
  const orders: KitchenOrder[] = []
  let cursor: string | undefined
  do {
    const page = unwrap(await api.GET('/v1/kitchen/orders', { params: { query: { limit: BOARD_PAGE, cursor } }, signal }))
    orders.push(...(page.items ?? []))
    cursor = page.nextCursor ?? undefined
  } while (cursor)
  return orders
}

export async function kitchenAction(orderId: string, body: KitchenActionRequest) {
  return unwrap(await api.PATCH('/v1/kitchen/orders/{id}/items', { params: { path: { id: orderId } }, body }))
}

/** Every order on the delivery board (oldest first) and the drivers. */
export async function listDeliveryBoard(signal?: AbortSignal): Promise<{ orders: Order[]; drivers: BoardDriver[] }> {
  const orders: Order[] = []
  let drivers: BoardDriver[] = []
  let cursor: string | undefined
  do {
    const page = unwrap(await api.GET('/v1/delivery/orders', { params: { query: { limit: BOARD_PAGE, cursor } }, signal }))
    orders.push(...(page.items ?? []))
    if (!cursor) drivers = page.drivers ?? []
    cursor = page.nextCursor ?? undefined
  } while (cursor)
  return { orders, drivers }
}

export async function deliveryAction(orderId: string, body: DeliveryActionRequest): Promise<Order> {
  return unwrap(await api.PATCH('/v1/delivery/orders/{id}', { params: { path: { id: orderId } }, body }))
}

/** A client id for a create (POST /v1/orders, /v1/sales): a retry with the same id does not create twice. */
export function newRequestId(): string {
  return crypto.randomUUID()
}
