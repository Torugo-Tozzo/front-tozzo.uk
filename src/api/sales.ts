import { api } from './client'
import { unwrap } from './errors'
import type { components } from './schema'

export type Sale = components['schemas']['Sale']
export type SaleItem = components['schemas']['SaleItem']
export type SaleServiceItem = components['schemas']['SaleServiceItem']
export type SalePage = components['schemas']['SalePage']
export type CreateSaleRequest = components['schemas']['CreateSaleRequest']

/** realtime.ts invalidates `sales` on sale.changed: every sales key starts with it. */
export const saleKeys = {
  all: ['sales'] as const,
}

export interface SaleQuery {
  /** RFC 3339 instants over soldAt. */
  from?: string
  to?: string
  customerName?: string
  sellerName?: string
  minTotalCents?: number
  maxTotalCents?: number
  cursor?: string
  limit?: number
}

const text = (value: string | undefined) => value?.trim() || undefined
const number = (value: number | undefined) => (value == null ? undefined : String(value))

/** A page of sales, with `summary` (count and total) of the whole filter. */
export async function listSales(query: SaleQuery, signal?: AbortSignal): Promise<SalePage> {
  const page = unwrap(await api.GET('/v1/sales', {
    params: {
      query: {
        from: query.from,
        to: query.to,
        customerName: text(query.customerName),
        sellerName: text(query.sellerName),
        minTotalCents: number(query.minTotalCents),
        maxTotalCents: number(query.maxTotalCents),
        cursor: query.cursor,
        limit: number(query.limit),
      },
    },
    signal,
  }))
  return { ...page, items: page.items ?? [] }
}

/**
 * `body.id` (client-generated) makes a retry return the sale already created:
 * `created` is false then (200 instead of 201).
 */
export async function createSale(body: CreateSaleRequest): Promise<{ sale: Sale; created: boolean }> {
  const result = await api.POST('/v1/sales', { body })
  return { sale: unwrap(result), created: result.response.status === 201 }
}

/** Idempotent: a cancelled sale answers 204 too. */
export async function cancelSale(id: string): Promise<void> {
  unwrap(await api.POST('/v1/sales/{id}/cancel', { params: { path: { id } } }))
}
