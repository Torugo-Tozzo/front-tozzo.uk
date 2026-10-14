import { api } from './client'
import { unwrap } from './errors'
import type { components } from './schema'

export type Sale = components['schemas']['Sale']
export type SalePage = components['schemas']['SalePage']
export type CreateSaleRequest = components['schemas']['CreateSaleRequest']

/** The key realtime.ts invalidates on `sale.changed`: every sales query starts with it. */
export const salesKeys = {
  all: ['sales'] as const,
  // Closing or cancelling a sale changes the reports too (same event).
  reports: ['reports'] as const,
}

export interface SaleFilters {
  /** RFC 3339 instants over soldAt (inclusive). */
  from?: string
  to?: string
  customerName?: string
  sellerId?: string
  minTotalCents?: number
  maxTotalCents?: number
}

const text = (value: string | undefined) => (value?.trim() ? value.trim() : undefined)
const cents = (value: number | undefined) => (value == null ? undefined : String(value))

/**
 * One cursor page of the sales (newest first), with `total` for "Página N de
 * M" and `summary` (count and sum of the whole filter: the period closing).
 */
export async function listSales(query: SaleFilters & { cursor?: string; limit?: number }, signal?: AbortSignal): Promise<SalePage> {
  const page = unwrap(await api.GET('/v1/sales', {
    params: {
      query: {
        from: query.from,
        to: query.to,
        customerName: text(query.customerName),
        sellerId: text(query.sellerId),
        minTotalCents: cents(query.minTotalCents),
        maxTotalCents: cents(query.maxTotalCents),
        cursor: query.cursor,
        limit: query.limit == null ? undefined : String(query.limit),
      },
    },
    signal,
  }))
  return { ...page, items: page.items ?? [] }
}

export async function createSale(body: CreateSaleRequest): Promise<Sale> {
  return unwrap(await api.POST('/v1/sales', { body }))
}

export async function cancelSale(id: string): Promise<void> {
  unwrap(await api.POST('/v1/sales/{id}/cancel', { params: { path: { id } } }))
}
