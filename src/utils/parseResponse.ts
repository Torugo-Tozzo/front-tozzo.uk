export function extractList<T>(data: any): T[] {
  if (Array.isArray(data)) return data
  if (data?.data && Array.isArray(data.data)) return data.data
  if (data?.produtos && Array.isArray(data.produtos)) return data.produtos
  if (data?.vendas && Array.isArray(data.vendas)) return data.vendas
  return []
}

export function extractTotal(data: any, headers?: any): number {
  if (data?.total != null) return Number(data.total)
  if (data?.count != null) return Number(data.count)
  if (headers?.['x-total-count'] != null) return parseInt(headers['x-total-count'])
  return 0
}

export function calcPagination(total: number, page: number, limit: number, dataLength: number) {
  if (total > 0) {
    const totalPages = Math.ceil(total / limit)
    return { totalPages, hasMore: page < totalPages }
  }
  return { totalPages: 0, hasMore: dataLength === limit }
}

export function normalizeOrderItems(
  itens: any[]
): { produtoId: number; quantidade: number; precoHistorico?: number }[] {
  return itens
    .map((item: any) => {
      const rawProdutoId = item.produtoId ?? item.produto?.id
      const produtoId =
        rawProdutoId != null && rawProdutoId !== ''
          ? Number(rawProdutoId)
          : Number.NaN
      return {
        produtoId,
        quantidade: Number(item.quantidade) || 0,
        precoHistorico:
          item.precoHistorico != null
            ? Number(item.precoHistorico)
            : item.preco != null
            ? Number(item.preco)
            : Number(item.produto?.preco ?? 0),
      }
    })
    .filter((i) => !Number.isNaN(i.produtoId))
}
