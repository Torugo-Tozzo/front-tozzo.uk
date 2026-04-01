import api from './api'
import { extractList, extractTotal, calcPagination, normalizeOrderItems } from '@/utils/parseResponse'

export type Order = {
  id: number
  cliente: string
  total: number
  status: string
  dataCriacao: string
  updatedAt: string
}

export type OrderItem = {
  produtoId: number
  quantidade: number
  precoHistorico?: number
}

interface ListParams {
  page: number
  limit: number
  status?: string
}

export const ordersService = {
  async list(params: ListParams) {
    const query: Record<string, any> = { page: params.page, limit: params.limit }
    if (params.status && params.status !== 'NAO_FECHADOS') query.status = params.status

    const response = await api.get('/pedidos', { params: query })
    let items = extractList<Order>(response.data)
    const rawTotal = extractTotal(response.data, response.headers)

    if (params.status === 'NAO_FECHADOS') {
      items = items.filter(o => o.status !== 'FECHADO')
    }

    const total = params.status === 'NAO_FECHADOS' ? items.length : rawTotal
    return { items, total, ...calcPagination(total, params.page, params.limit, items.length) }
  },

  async getWithItems(id: number) {
    const response = await api.get('/pedidos', { params: { id } })
    const list = extractList<any>(response.data)
    const orderData = list[0] ?? null
    if (!orderData?.itens) return { order: orderData, items: [] as OrderItem[] }
    return { order: orderData, items: normalizeOrderItems(orderData.itens) }
  },

  async create(cliente: string, itens: OrderItem[]) {
    await api.post('/pedidos', { cliente, itens })
  },

  async update(id: number, cliente: string, itens: OrderItem[]) {
    await api.put(`/pedidos/${id}`, { cliente, itens })
  },

  async delete(id: number) {
    await api.delete(`/pedidos/${id}`)
  },

  async updateStatus(id: number, status: string) {
    await api.post(`/pedidos/${id}/status`, { status })
  },

  async countOpen(): Promise<number> {
    const response = await api.get('/pedidos', { params: { limit: 1000 } })
    const items = extractList<Order>(response.data)
    return items.filter(o => o.status !== 'FECHADO').length
  },
}
