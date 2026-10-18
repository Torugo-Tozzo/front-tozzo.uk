import { api } from './client'
import { unwrap } from './errors'
import type { components } from './schema'

export type DeliveryOrder = components['schemas']['Order']
export type BoardDriver = components['schemas']['BoardDriver']
export type DeliveryStage = 'WAITING' | 'DELIVERING'

/** realtime.ts invalidates `delivery` on order.changed: every delivery key starts with it. */
export const deliveryKeys = {
  all: ['delivery'] as const,
  board: ['delivery', 'board'] as const,
}

export interface DeliveryBoard {
  orders: DeliveryOrder[]
  drivers: BoardDriver[]
}

const PAGE_SIZE = 100

/** The whole board and the drivers (a DRIVER gets only their own orders), following the /v1 cursor. */
export async function listDeliveryBoard(signal?: AbortSignal): Promise<DeliveryBoard> {
  const orders: DeliveryOrder[] = []
  let drivers: BoardDriver[] = []
  let cursor: string | undefined
  let first = true
  do {
    const page = unwrap(await api.GET('/v1/delivery/orders', { params: { query: { cursor, limit: PAGE_SIZE } }, signal }))
    orders.push(...(page.items ?? []))
    if (first) drivers = page.drivers ?? []
    first = false
    cursor = page.nextCursor ?? undefined
  } while (cursor)
  return { orders, drivers }
}

export type DeliveryAction =
  | { action: 'ASSIGN'; driverId: string }
  | { action: 'ASSIGN'; externalDriverName: string; externalDriverPhone?: string }
  | { action: 'START'; confirmReady?: boolean }
  | { action: 'WAIT' }
  // Staff only; clears the internal and the external driver. Nothing else
  // may go with it (DELIVERY_ACTION_INVALID).
  | { action: 'UNASSIGN' }

/** `expectedUpdatedAt` is the order's version as read: DELIVERY_CONFLICT when it changed. */
export async function deliveryAction(orderId: string, expectedUpdatedAt: string, action: DeliveryAction): Promise<DeliveryOrder> {
  return unwrap(await api.PATCH('/v1/delivery/orders/{id}', {
    params: { path: { id: orderId } },
    body: { ...action, expectedUpdatedAt },
  })) as DeliveryOrder
}
