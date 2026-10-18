import { api } from './client'
import { unwrap } from './errors'
import type { components } from './schema'

export type KitchenOrder = components['schemas']['KitchenOrder']
export type KitchenItem = components['schemas']['KitchenItem']
export type KitchenResult = components['schemas']['KitchenResult']
export type KitchenStage = KitchenItem['stage']

/** realtime.ts invalidates `kitchen` on order.changed: every kitchen key starts with it. */
export const kitchenKeys = {
  all: ['kitchen'] as const,
  board: ['kitchen', 'board'] as const,
}

const PAGE_SIZE = 100

/** The whole board (the React app read every page too), following the /v1 cursor. */
export async function listKitchenBoard(signal?: AbortSignal): Promise<KitchenOrder[]> {
  const orders: KitchenOrder[] = []
  let cursor: string | undefined
  do {
    const page = unwrap(await api.GET('/v1/kitchen/orders', { params: { query: { cursor, limit: PAGE_SIZE } }, signal }))
    orders.push(...(page.items ?? []))
    cursor = page.nextCursor ?? undefined
  } while (cursor)
  return orders
}

/** Moves items to `targetStage`. `expectedUpdatedAt` is the order's version as read: KITCHEN_CONFLICT when it changed. */
export async function moveKitchenItems(orderId: string, body: { itemIds: string[]; targetStage: KitchenStage; expectedUpdatedAt: string }): Promise<KitchenResult> {
  return unwrap(await api.PATCH('/v1/kitchen/orders/{id}/items', {
    params: { path: { id: orderId } },
    body: { action: 'MOVE', ...body },
  }))
}
