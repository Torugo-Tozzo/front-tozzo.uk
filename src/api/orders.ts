import { api } from './client'
import { unwrap } from './errors'
import type { components } from './schema'

export type Order = components['schemas']['Order']
export type OrderItem = components['schemas']['OrderItem']
export type OrderPage = components['schemas']['OrderPage']
export type Sale = components['schemas']['Sale']
export type CreateOrderRequest = components['schemas']['CreateOrderRequest']
export type UpdateOrderRequest = components['schemas']['UpdateOrderRequest']
export type ClosedOrder = components['schemas']['Closed']
export type PaymentMethod = NonNullable<Sale['paymentMethod']>
export type OrderItemStatusInput = 'REQUESTED' | 'IN_PREPARATION' | 'READY' | 'DELIVERED'

/**
 * Query keys of the operation. realtime.ts invalidates `orders` on
 * order.changed and `sales` on sale.changed, so these prefixes must not change.
 */
export const orderKeys = {
  all: ['orders'] as const,
  detail: (id: string) => ['orders', 'detail', id] as const,
}
export { saleKeys } from './sales'

export interface OrderQuery {
  status?: 'open' | 'closed'
  customerName?: string
  sellerName?: string
  minTotalCents?: number
  maxTotalCents?: number
  cursor?: string
  limit?: number
}

const text = (value: string | undefined) => value?.trim() || undefined
const cents = (value: number | undefined) => (value == null ? undefined : String(value))

export async function listOrders(query: OrderQuery, signal?: AbortSignal): Promise<OrderPage> {
  const page = unwrap(await api.GET('/v1/orders', {
    params: {
      query: {
        status: query.status,
        customerName: text(query.customerName),
        sellerName: text(query.sellerName),
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

/** `body.id` (client-generated) makes a retry return the order already created. */
export async function createOrder(body: CreateOrderRequest): Promise<Order> {
  return unwrap(await api.POST('/v1/orders', { body }))
}

/** `items`, when sent, is the whole list: items left out are removed. */
export async function updateOrder(id: string, body: UpdateOrderRequest): Promise<Order> {
  return unwrap(await api.PUT('/v1/orders/{id}', { params: { path: { id } }, body }))
}

/** Closes the order into a sale (a delivery must have started). */
export async function closeOrder(id: string, paymentMethod: PaymentMethod | null): Promise<ClosedOrder> {
  return unwrap(await api.POST('/v1/orders/{id}/close', {
    params: { path: { id } },
    body: paymentMethod ? { paymentMethod } : {},
  }))
}

export async function setOrderItemStatus(orderId: string, itemId: string, status: OrderItemStatusInput): Promise<Order> {
  return unwrap(await api.PATCH('/v1/orders/{id}/items/{itemId}', {
    params: { path: { id: orderId, itemId } },
    body: { status },
  }))
}

export async function deleteOrder(id: string): Promise<void> {
  unwrap(await api.DELETE('/v1/orders/{id}', { params: { path: { id } } }))
}
