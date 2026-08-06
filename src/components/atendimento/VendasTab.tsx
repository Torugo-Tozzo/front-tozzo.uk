import { useState, useEffect, useRef, useCallback } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { IconButton } from "@/components/ui/icon-button"
import { FiltersBar } from "@/components/atendimento/FiltersBar"
import { Printer, Eye, Loader2 } from "lucide-react"
import api, { getErrorMessage } from "@/services/api"
import { parseListResponse } from "@/services/parseResponse"
import { toast } from "sonner"
import { useRealtimeEvents } from "@/hooks/useRealtimeEvents"
import { ProductSelectionModal } from "@/components/ProductSelectionModal"
import { Pagination } from "@/components/Pagination"
import { Skeleton } from "@/components/ui/skeleton"
import { getStatusColor } from "@/lib/status"

type SaleItem = {
  produtoId: number
  quantidade: number
  produto?: { nome: string } | null
}

type Sale = {
  id: number
  cliente: string
  total: number
  horario: string
  vendedor?: { id: number; nome: string } | null
  itens?: SaleItem[]
}

type SaleFilters = {
  cliente: string
  criadoPor: string
  totalMin: string
  totalMax: string
  startDate: string
  startTime: string
  endDate: string
  endTime: string
}

function isSalesEqual(a: Sale[], b: Sale[]) {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const ai = a[i]
    const bi = b[i]
    if (ai.id !== bi.id) return false
    if (ai.total !== bi.total) return false
    if ((ai.horario || '') !== (bi.horario || '')) return false
  }
  return true
}

function formatItemsSummary(itens?: SaleItem[]): string {
  if (!itens || itens.length === 0) return ""
  return itens.map((i) => `${i.quantidade}x ${i.produto?.nome ?? "Produto"}`).join(", ")
}

function buildSaleParams(page: number, limit: number, f: SaleFilters) {
  const params: any = { page, limit }
  if (f.cliente) params.cliente = f.cliente
  if (f.criadoPor) params.criadoPor = f.criadoPor
  if (f.totalMin) params.totalMin = parseFloat(f.totalMin)
  if (f.totalMax) params.totalMax = parseFloat(f.totalMax)
  if (f.startDate && f.startTime) params.dataInicial = new Date(`${f.startDate}T${f.startTime}:00`).toISOString()
  if (f.endDate && f.endTime) params.dataFinal = new Date(`${f.endDate}T${f.endTime}:59`).toISOString()
  return params
}

export function VendasTab() {
  const [sales, setSales] = useState<Sale[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [totalPages, setTotalPages] = useState(0)
  const [totalItems, setTotalItems] = useState(0)
  const [hasMore, setHasMore] = useState(false)

  const [currentSaleItems, setCurrentSaleItems] = useState<{ produtoId: number | string; quantidade: number; precoHistorico?: number }[]>([])
  const [currentSaleClient, setCurrentSaleClient] = useState("")
  const [isReadOnlyModal, setIsReadOnlyModal] = useState(false)
  const [currentSaleId, setCurrentSaleId] = useState<number | null>(null)

  const [isLoading, setIsLoading] = useState(false)
  const [loadingSaleId, setLoadingSaleId] = useState<number | null>(null)

  const [cliente, setCliente] = useState("")
  const [criadoPor, setCriadoPor] = useState("")
  const [totalMin, setTotalMin] = useState("")
  const [totalMax, setTotalMax] = useState("")

  const formatDate = (d: Date) => {
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }

  const formatTime = (d: Date) => {
    const hh = String(d.getHours()).padStart(2, '0')
    const min = String(d.getMinutes()).padStart(2, '0')
    return `${hh}:${min}`
  }

  const now = new Date()
  const ago24 = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  const [startDate, setStartDate] = useState(formatDate(ago24))
  const [startTime, setStartTime] = useState(formatTime(ago24))
  const [endDate, setEndDate] = useState(formatDate(now))
  const [endTime, setEndTime] = useState(formatTime(now))
  const [periodTotal, setPeriodTotal] = useState(0)
  const salesRef = useRef<Sale[]>([])
  const filterRef = useRef<SaleFilters>({ cliente, criadoPor, totalMin, totalMax, startDate, startTime, endDate, endTime })

  useEffect(() => {
    filterRef.current = { cliente, criadoPor, totalMin, totalMax, startDate, startTime, endDate, endTime }
  }, [cliente, criadoPor, totalMin, totalMax, startDate, startTime, endDate, endTime])

  const fetchSales = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = buildSaleParams(page, limit, {
        cliente, criadoPor, totalMin, totalMax, startDate, startTime, endDate, endTime,
      })

      const response = await api.get(`/vendas`, { params })
      const { data, total } = parseListResponse<Sale>(response, 'vendas')
      const fechamento = Number(response.data.fechamento) || 0

      setSales(data)
      salesRef.current = data
      setTotalItems(total)
      setPeriodTotal(fechamento)

      if (total > 0) {
        setTotalPages(Math.ceil(total / limit))
        setHasMore(page < Math.ceil(total / limit))
      } else {
        setTotalPages(0)
        setHasMore(data.length === limit)
      }
    } catch (error) {
      console.error("Error fetching sales", error)
    } finally {
      setIsLoading(false)
    }
  }, [page, limit, cliente, criadoPor, totalMin, totalMax, startDate, startTime, endDate, endTime])

  useEffect(() => {
    fetchSales()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit])

  const poll = useCallback(async () => {
    try {
      const f = filterRef.current
      const params = buildSaleParams(page, limit, f)

      const response = await api.get(`/vendas`, { params })
      const { data, total } = parseListResponse<Sale>(response, 'vendas')
      const fechamento = Number(response.data.fechamento) || 0

      const previous = salesRef.current || []
      if (!isSalesEqual(previous, data)) {
        setSales(data)
        salesRef.current = data
        setTotalItems(total)
        setPeriodTotal(fechamento)

        if (total > 0) {
          setTotalPages(Math.ceil(total / limit))
          setHasMore(page < Math.ceil(total / limit))
        } else {
          setTotalPages(0)
          setHasMore(data.length === limit)
        }
      }
    } catch (err) {
      console.error('Error polling sales', err)
    }
  }, [page, limit])

  useRealtimeEvents(['vendas'], poll)

  useEffect(() => {
    let interval: number | null = null

    const startPolling = () => {
      if (interval != null) return
      poll()
      interval = window.setInterval(poll, 60000)
    }

    const stopPolling = () => {
      if (interval != null) {
        clearInterval(interval)
        interval = null
      }
    }

    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        startPolling()
      } else {
        stopPolling()
      }
    }

    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      startPolling()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleVisibilityChange)
    window.addEventListener('blur', handleVisibilityChange)

    return () => {
      stopPolling()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleVisibilityChange)
      window.removeEventListener('blur', handleVisibilityChange)
    }
  }, [poll])

  const handleModalConfirm = async (cliente: string, itens: { produtoId: number; quantidade: number; precoHistorico?: number }[]) => {
    setIsLoading(true)
    try {
      await api.post("/vendas", { cliente, itens })
      await fetchSales()
      setIsModalOpen(false)
    } catch (error) {
      console.error("Error creating sale", error)
      toast.error(getErrorMessage(error, "Erro ao criar venda"))
    } finally {
      setIsLoading(false)
    }
  }

  const handleInfoClick = async (sale: Sale) => {
    setLoadingSaleId(sale.id)
    try {
      if (sale.itens && Array.isArray(sale.itens)) {
        const items = sale.itens.map((item: any) => ({
          produtoId: item.produtoId ?? (item.produto ? item.produto.id : undefined),
          quantidade: Number(item.quantidade) || 0,
          precoHistorico: item.precoHistorico != null ? Number(item.precoHistorico) : (item.preco != null ? Number(item.preco) : (item.produto ? Number(item.produto.preco || 0) : undefined)),
        })).filter((i: any) => i.produtoId != null && i.produtoId !== '')
        setCurrentSaleItems(items)
      } else {
        setCurrentSaleItems([])
      }

      setCurrentSaleClient(sale.cliente)
      setCurrentSaleId(sale.id)
      setIsReadOnlyModal(true)
      setIsModalOpen(true)
    } catch (error) {
      console.error("Error fetching sale details", error)
      toast.error(getErrorMessage(error, "Erro ao carregar detalhes da venda"))
    } finally {
      setLoadingSaleId(null)
    }
  }

  const handleNewSaleClick = () => {
    setCurrentSaleClient("")
    setCurrentSaleItems([])
    setIsReadOnlyModal(false)
    setCurrentSaleId(null)
    setIsModalOpen(true)
  }

  const handleCancelSale = async (id: number) => {
    try {
      await api.delete(`/vendas/${id}`)
      await fetchSales()
      setIsModalOpen(false)
      setCurrentSaleId(null)
    } catch (error) {
      console.error('Error cancelling sale', error)
      toast.error(getErrorMessage(error, 'Erro ao cancelar venda'))
    }
  }

  const handleApplyFilters = () => {
    setPage(1)
    fetchSales()
  }

  return (
    <div className="space-y-4">
      <FiltersBar
        dateRange={{
          startDate, startTime, endDate, endTime,
          onStartDateChange: setStartDate,
          onStartTimeChange: setStartTime,
          onEndDateChange: setEndDate,
          onEndTimeChange: setEndTime,
        }}
        cliente={{ value: cliente, onChange: setCliente }}
        criadoPor={{ value: criadoPor, onChange: setCriadoPor }}
        totalRange={{ min: totalMin, max: totalMax, onMinChange: setTotalMin, onMaxChange: setTotalMax }}
        primaryAction={{ label: "Nova Venda", onClick: handleNewSaleClick }}
        onFilter={handleApplyFilters}
        isLoading={isLoading}
      />

      <ProductSelectionModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setCurrentSaleId(null); setIsReadOnlyModal(false) }}
        onConfirm={handleModalConfirm}
        title={isReadOnlyModal ? "Detalhes da Venda" : "Nova Venda"}
        initialClientName={currentSaleClient}
        initialOrderItems={currentSaleItems as any}
        readOnly={isReadOnlyModal}
        onCancelSale={isReadOnlyModal && currentSaleId ? async () => handleCancelSale(currentSaleId) : undefined}
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle>Vendas no Período</CardTitle>
            <div className="text-sm text-muted-foreground mt-1">Total de registros: {totalItems}</div>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-sm text-muted-foreground">Fechamento do Período</span>
            <span className="text-2xl font-bold text-green-600">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(periodTotal)}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px] text-center">#</TableHead>
                <TableHead>Cliente / Mesa</TableHead>
                <TableHead>Criado por</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[200px]" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
                    <TableCell className="text-right justify-end flex"><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell className="text-right justify-end flex gap-2">
                      <Skeleton className="h-8 w-8" />
                      <Skeleton className="h-8 w-8" />
                    </TableCell>
                  </TableRow>
                ))
              ) : sales.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Nenhuma venda encontrada no período.
                  </TableCell>
                </TableRow>
              ) : (
                sales.map((sale, index) => (
                  <TableRow key={sale.id} accentColor={getStatusColor('FECHADO')}>
                    <TableCell className="text-center">{(page - 1) * limit + index + 1}</TableCell>
                    <TableCell>
                      <div className="font-medium">{sale.cliente || "Não Informado"}</div>
                      {formatItemsSummary(sale.itens) && (
                        <div
                          className="text-sm text-muted-foreground truncate max-w-[280px]"
                          title={formatItemsSummary(sale.itens)}
                        >
                          {formatItemsSummary(sale.itens)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{sale.vendedor?.nome || "-"}</TableCell>
                    <TableCell>{sale.horario ? new Date(sale.horario).toLocaleString() : "-"}</TableCell>
                    <TableCell className="text-right">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(sale.total)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <IconButton icon={<Printer className="h-4 w-4" />} label="Impressão (em breve)" disabled />
                        <IconButton
                          icon={loadingSaleId === sale.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                          label="Ver detalhes"
                          onClick={() => handleInfoClick(sale)}
                          disabled={loadingSaleId === sale.id}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            hasMore={hasMore}
            onPageChange={setPage}
            pageSize={limit}
            onPageSizeChange={(newLimit) => { setLimit(newLimit); setPage(1) }}
            isLoading={isLoading}
          />
        </CardContent>
      </Card>
    </div>
  )
}
