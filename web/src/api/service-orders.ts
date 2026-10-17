import { api } from './client'
import { apiErrorOf, unwrap } from './errors'
import type { components, operations } from './schema'

export type ServiceOrder = components['schemas']['ServiceOrder']
export type ServiceOrderItem = components['schemas']['ServiceOrderLine'] & { id?: string }
export type ServiceOrderQuoteInput = components['schemas']['ServiceOrderLineBody']
export type ServiceOrderStatus = ServiceOrder['status']
export const serviceOrderKeys = { all: ['service-orders'] as const, detail: (id: string) => ['service-orders', 'detail', id] as const }
export function serviceOrderErrorKey(cause: unknown): 'conflict' | 'saveError' {
  const {code}=apiErrorOf(cause)
  return code==='SERVICE_ORDER_CONFLICT' || code==='EXPECTED_UPDATED_AT_REQUIRED' ? 'conflict' : 'saveError'
}
type Query = NonNullable<operations['listServiceOrders']['parameters']['query']>
export const statusKey = (status: string) => ({ OPEN: 'ABERTA', QUOTED: 'ORCADA', APPROVED: 'APROVADA', IN_PROGRESS: 'EM_EXECUCAO', COMPLETED: 'CONCLUIDA', CANCELLED: 'CANCELADA' } as const)[status as ServiceOrderStatus] ?? 'ABERTA'

export const servicesApi = {
  async listOrders(query: Omit<Query, 'open'> & {open?: boolean}, signal?: AbortSignal) {
    const page = unwrap(await api.GET('/v1/service-orders', { params: { query: {
      ...query, open: query.open == null ? undefined : query.open ? 'true' : 'false',
      dueBefore: query.dueBefore && /^\d{4}-\d{2}-\d{2}$/.test(query.dueBefore) ? new Date(`${query.dueBefore}T23:59:59.999`).toISOString() : query.dueBefore,
    } }, signal }))
    return { ...page, items: page.items ?? [] }
  },
  async getOrder(id: string, signal?: AbortSignal) { return unwrap(await api.GET('/v1/service-orders/{id}', {params:{path:{id}},signal})) },
  async createOrder(body: components['schemas']['CreateServiceOrderRequest']) { return unwrap(await api.POST('/v1/service-orders',{body})) },
  async updateOrder(id: string, body: components['schemas']['UpdateServiceOrderRequest']) { return unwrap(await api.PATCH('/v1/service-orders/{id}',{params:{path:{id}},body})) },
  async deleteOrder(id: string, expectedUpdatedAt: string) { return unwrap(await api.DELETE('/v1/service-orders/{id}',{params:{path:{id}},body:{expectedUpdatedAt}})) },
  async replaceQuote(id: string, expectedUpdatedAt: string, items: ServiceOrderQuoteInput[]) { return unwrap(await api.PUT('/v1/service-orders/{id}/quote',{params:{path:{id}},body:{expectedUpdatedAt,items}})) },
  async replaceSupplements(id: string, expectedUpdatedAt: string, items: ServiceOrderQuoteInput[]) { return unwrap(await api.PUT('/v1/service-orders/{id}/supplements',{params:{path:{id}},body:{expectedUpdatedAt,items}})) },
  async approveSupplements(id: string, expectedUpdatedAt: string) { return unwrap(await api.POST('/v1/service-orders/{id}/supplements/approve',{params:{path:{id}},body:{expectedUpdatedAt}})) },
  async action(id: string, verb: 'approve'|'start'|'complete'|'cancel'|'reopen', expectedUpdatedAt: string): Promise<{order:ServiceOrder;sale?: components['schemas']['Sale']}> {
    const params={params:{path:{id}},body:{expectedUpdatedAt}}
    if(verb==='complete') return unwrap(await api.POST('/v1/service-orders/{id}/complete',params))
    const path = {approve:'/v1/service-orders/{id}/approve',start:'/v1/service-orders/{id}/start',cancel:'/v1/service-orders/{id}/cancel',reopen:'/v1/service-orders/{id}/reopen'} as const
    return {order:unwrap(await api.POST(path[verb],params))}
  },
}
