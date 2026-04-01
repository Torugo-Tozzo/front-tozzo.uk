import api from './api'
import { extractList, extractTotal, calcPagination } from '@/utils/parseResponse'

export type ProductType = {
  id: number
  descricao: string
  isEditable?: boolean
  cor?: string
  ativo?: boolean
}

export type Product = {
  id: number
  nome: string
  preco: number
  ingredientes: string
  tipoProdutoId: number
  tipoProduto?: ProductType
}

function normalizeType(t: any): ProductType {
  return {
    id: t.id,
    descricao: t.descricao,
    isEditable: t.isEditable ?? t.editavel ?? true,
    cor: t.cor ?? t.color ?? '#111827',
    ativo: typeof t.ativo === 'boolean' ? t.ativo : t.ativo !== 0,
  }
}

export const productsService = {
  async list(page: number, limit: number, search = '') {
    const response = await api.get(`/produtos?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`)
    const items = extractList<Product>(response.data)
    const total = extractTotal(response.data, response.headers)
    return { items, total, ...calcPagination(total, page, limit, items.length) }
  },

  async listAll(): Promise<Product[]> {
    const response = await api.get('/produtos')
    return response.data.map((p: any) => ({ ...p, preco: Number(p.preco) || 0 }))
  },

  async create(data: { nome: string; preco: number; ingredientes: string; tipoProdutoId: number }) {
    await api.post('/produtos', data)
  },

  async update(id: number, data: { nome: string; preco: number; ingredientes: string; tipoProdutoId: number }) {
    await api.put(`/produtos/${id}`, data)
  },

  async delete(id: number) {
    await api.delete(`/produtos/${id}`)
  },
}

export const productTypesService = {
  async listAll(): Promise<ProductType[]> {
    const response = await api.get('/tipos?all=true')
    return response.data.map(normalizeType)
  },

  async listPaged(page: number, limit: number, search = '') {
    const response = await api.get(
      `/tipos?page=${page}&limit=${limit}&all=true&search=${encodeURIComponent(search)}`
    )
    const raw = extractList<any>(response.data)
    const total = extractTotal(response.data, response.headers)
    const items = raw.map(normalizeType)
    return { items, total, ...calcPagination(total, page, limit, items.length) }
  },

  async create(descricao: string, cor: string) {
    await api.post('/tipos', { descricao, cor })
  },

  async update(id: number, descricao: string, cor: string) {
    await api.put(`/tipos/${id}`, { descricao, cor })
  },

  async toggleActive(id: number, ativo: boolean) {
    await api.patch(`/tipos/${id}/ativo`, { ativo })
  },
}
