import api from './api'
import { extractList, calcPagination, normalizeOrderItems } from '@/utils/parseResponse'

export type Sale = {
  id: number
  cliente: string
  total: number
  horario: string
}

interface ListParams {
  page: number
  limit: number
  dataInicial?: string
  dataFinal?: string
}

function parseSalesResponse(response: any) {
  const data = response.data
  let items: any[] = []
  let total = 0
  let fechamento = 0

  if (data?.vendas && Array.isArray(data.vendas)) {
    items = data.vendas
    fechamento = Number(data.fechamento) || 0
    total = Number(data.total || data.count || items.length)
    if (!total && response.headers?.['x-total-count'])
      total = parseInt(response.headers['x-total-count'])
  } else if (data?.data && Array.isArray(data.data)) {
    items = data.data
    total = Number(data.total || data.count || 0)
  } else if (Array.isArray(data)) {
    items = data
    total = response.headers?.['x-total-count']
      ? parseInt(response.headers['x-total-count'])
      : 0
  }

  return { items, total, fechamento }
}

export const salesService = {
  async list(params: ListParams) {
    const response = await api.get('/vendas', { params })
    const { items, total, fechamento } = parseSalesResponse(response)
    return { items, total, fechamento, ...calcPagination(total, params.page, params.limit, items.length) }
  },

  async getItems(sale: any): Promise<{ produtoId: number; quantidade: number; precoHistorico?: number }[]> {
    if (sale.itens && Array.isArray(sale.itens)) {
      return normalizeOrderItems(sale.itens)
    }

    if (sale.pedidoId) {
      try {
        const resp = await api.get('/pedidos', { params: { id: sale.pedidoId } })
        const list = extractList<any>(resp.data)
        if (list[0]?.itens) return normalizeOrderItems(list[0].itens)
      } catch { /* fall through */ }
    }

    try {
      const resp = await api.get('/vendas', { params: { id: sale.id } })
      const d = resp.data
      const vendaData =
        d?.venda ??
        (Array.isArray(d) ? d[0] : d?.vendas?.[0] ?? d?.data?.[0])
      if (vendaData?.itens) return normalizeOrderItems(vendaData.itens)
    } catch { /* ignore */ }

    return []
  },

  async create(cliente: string, itens: { produtoId: number; quantidade: number; precoHistorico?: number }[]) {
    await api.post('/vendas', { cliente, itens })
  },

  async delete(id: number) {
    await api.delete(`/vendas/${id}`)
  },
}
