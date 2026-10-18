import { api } from './client'
import { unwrap } from './errors'
import type { components } from './schema'

export type TopProducts = components['schemas']['TopProducts']
export type SalesByHour = components['schemas']['SalesByHour']
export type ReportExport = components['schemas']['ReportExport']
export type ReportExportRequest = components['schemas']['CreateReportExportRequest']
export interface ReportFilters { from?: string; to?: string; productTypeId?: string }
export const reportKeys = { all: ['reports'] as const }
export async function getTopProducts(query: ReportFilters, signal?: AbortSignal): Promise<TopProducts> {
  return unwrap(await api.GET('/v1/reports/top-products', { params: { query }, signal }))
}
export async function listProductReport(query: ReportFilters & { cursor?: string; limit?: number }, signal?: AbortSignal) {
  const page = unwrap(await api.GET('/v1/reports/products', { params: { query }, signal }))
  return { ...page, items: page.items ?? [] }
}
export async function getSalesByHour(query: { date: string; tzOffsetMinutes: string }, signal?: AbortSignal): Promise<SalesByHour> {
  return unwrap(await api.GET('/v1/reports/sales-by-hour', { params: { query }, signal }))
}
export async function createReportExport(body: ReportExportRequest, signal?: AbortSignal): Promise<ReportExport> {
  return unwrap(await api.POST('/v1/reports/exports', { body, signal }))
}
export async function getReportExport(id: string, signal?: AbortSignal): Promise<ReportExport> {
  return unwrap(await api.GET('/v1/reports/exports/{id}', { params: { path: { id } }, signal }))
}
