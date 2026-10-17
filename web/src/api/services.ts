import { api } from './client'
import { apiErrorOf, unwrap } from './errors'
import type { components } from './schema'

export type CatalogService = components['schemas']['CatalogService']
export type ServicePage = components['schemas']['ServicePage']
export type CreateServiceRequest = components['schemas']['CreateServiceRequest']
export type UpdateServiceRequest = components['schemas']['UpdateServiceRequest']
export const serviceKeys = { all: ['services'] as const }
export interface ServiceQuery { search?: string; cursor?: string; limit?: number }
export async function listServices(query: ServiceQuery = {}, signal?: AbortSignal): Promise<ServicePage> {
  const page = unwrap(await api.GET('/v1/services', { params: { query: { ...query, search: query.search || undefined } }, signal }))
  return { ...page, items: page.items ?? [] }
}
export async function createService(body: CreateServiceRequest): Promise<CatalogService> {
  return unwrap(await api.POST('/v1/services', { body }))
}
export async function updateService(id: string, body: UpdateServiceRequest): Promise<CatalogService> {
  return unwrap(await api.PATCH('/v1/services/{id}', { params: { path: { id } }, body }))
}
export async function deleteService(id: string): Promise<void> {
  unwrap(await api.DELETE('/v1/services/{id}', { params: { path: { id } } }))
}
export interface ServiceReference { id: string; customerName: string; status: string }
/** Documented problem extension; absent from the generated generic Problem schema. */
export function serviceReferences(error: unknown): ServiceReference[] {
  const failure = apiErrorOf(error)
  if (failure.code !== 'SERVICE_IN_USE') return []
  const references: unknown = (failure.problem as unknown as { references?: unknown } | undefined)?.references
  if (!Array.isArray(references)) return []
  return references.filter((entry): entry is ServiceReference => typeof entry === 'object' && entry !== null && typeof entry.id === 'string' && typeof entry.customerName === 'string' && typeof entry.status === 'string')
}
