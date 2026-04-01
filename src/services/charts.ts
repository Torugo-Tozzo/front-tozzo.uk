import api from './api'
import { extractTotal, calcPagination } from '@/utils/parseResponse'

interface FilterParams {
  dataInicial?: string
  dataFinal?: string
  tipoProdutoId?: number
}

export const chartsService = {
  async fetchTypes(): Promise<{ id: number; descricao: string }[]> {
    const response = await api.get('/tipos')
    return response.data
  },

  async fetchChartData(params: FilterParams) {
    const response = await api.get('/graficos', { params })
    const raw = response.data
    const produtos =
      raw?.produtos?.map((item: any) => ({
        name: item.nome,
        sales: item.quantidadeVendida,
        revenue:
          typeof item.totalFaturado === 'string'
            ? parseFloat(item.totalFaturado)
            : item.totalFaturado,
      })) ?? []
    return { produtos, fechamento: raw?.fechamento ?? null }
  },

  async fetchDetailed(params: FilterParams & { page: number; limit: number }) {
    const response = await api.get('/graficos/lista', { params })
    const data = response.data
    let items: any[] = []
    let total = 0

    if (data?.data) { items = data.data; total = Number(data.total ?? data.count ?? 0) }
    else if (data?.produtos) { items = data.produtos; total = Number(data.total ?? data.count ?? 0) }
    else if (Array.isArray(data)) {
      items = data
      total = extractTotal(null, response.headers)
    }

    return { items, total, ...calcPagination(total, params.page, params.limit, items.length) }
  },

  async fetchSalesByHour(params: { dataInicial: string; dataFinal?: string; page?: number }) {
    const response = await api.get('/graficos/vendas-por-horario', { params })
    return Array.isArray(response.data) ? response.data : []
  },

  async generateReport(body: Record<string, any>) {
    return api.post('/graficos/relatorio', body)
  },

  async getReportStatus(path: string) {
    return api.get(path, { headers: { Accept: 'application/json' } })
  },

  async downloadBlob(path: string) {
    return api.get(path, { responseType: 'blob' } as any)
  },
}
