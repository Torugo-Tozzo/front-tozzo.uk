import api from './api'
import { extractList, extractTotal, calcPagination } from '@/utils/parseResponse'

export type Employee = {
  id: number
  nome: string
  email: string
  role: string
}

export const employeesService = {
  async list(page: number, limit: number, search = '') {
    const response = await api.get(
      `/usuarios?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`
    )
    const items = extractList<Employee>(response.data)
    const total = extractTotal(response.data, response.headers)
    return { items, total, ...calcPagination(total, page, limit, items.length) }
  },

  async create(data: { nome: string; email: string; senha: string; role: string }) {
    await api.post('/usuarios', data)
  },

  async update(id: number, data: { nome: string; email: string; role: string; senha?: string }) {
    await api.put(`/usuarios/${id}`, data)
  },

  async delete(id: number) {
    await api.delete(`/usuarios/${id}`)
  },
}
