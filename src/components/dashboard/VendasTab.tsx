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
import { FiltersBar } from "@/components/dashboard/FiltersBar"
import { Printer, Eye, Loader2 } from "lucide-react"
import api, { getErrorMessage } from "@/services/api"
import { parseListResponse } from "@/services/parseResponse"
import { toast } from "sonner"
import { useRealtimeEvents } from "@/hooks/useRealtimeEvents"
import { useMinLoadingDuration } from "@/hooks/useMinLoadingDuration"
import { ProductSelectionModal } from "@/components/ProductSelectionModal"
import { Pagination } from "@/components/Pagination"
import { Skeleton } from "@/components/ui/skeleton"
import { getStatusColor } from "@/lib/status"
import type { Sale, SaleItem } from "@/domain/models"

type SaleFilters = {
  customerName: string
  createdBy: string
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
    if ((ai.soldAt || '') !== (bi.soldAt || '')) return false
  }
  return true
}

function formatItemsSummary(items?: SaleItem[]): string {
  if (!items || items.length === 0) return ""
  return items.map((item) => `${item.quantity}x ${item.product?.name ?? "Produto"}`).join(", ")
}

function buildSaleParams(page: number, limit: number, f: SaleFilters) {
  const params: any = { page, limit }
  if (f.customerName) params.customerName = f.customerName
  if (f.createdBy) params.createdBy = f.createdBy
  if (f.totalMin) params.totalMin = parseFloat(f.totalMin)
  if (f.totalMax) params.totalMax = parseFloat(f.totalMax)
  if (f.startDate && f.startTime) params.startAt = new Date(`${f.startDate}T${f.startTime}:00`).toISOString()
  if (f.endDate && f.endTime) params.endAt = new Date(`${f.endDate}T${f.endTime}:59`).toISOString()
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

  const [currentSaleItems, setCurrentSaleItems] = useState<{ productId: number | string; quantity: number; unitPrice?: number; name?: string }[]>([])
  const [currentSaleClient, setCurrentSaleClient] = useState("")
  const [isReadOnlyModal, setIsReadOnlyModal] = useState(false)
  const [currentSaleId, setCurrentSaleId] = useState<number | string | null>(null)

  const [isLoading, setIsLoading] = useState(false)
  const showSkeleton = useMinLoadingDuration(isLoading)
  const [loadingSaleId, setLoadingSaleId] = useState<number | string | null>(null)

  const [customerName, setCustomerName] = useState("")
  const [createdBy, setCreatedBy] = useState("")
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
  const filterRef = useRef<SaleFilters>({ customerName, createdBy, totalMin, totalMax, startDate, startTime, endDate, endTime })

  useEffect(() => {
    filterRef.current = { customerName, createdBy, totalMin, totalMax, startDate, startTime, endDate, endTime }
  }, [customerName, createdBy, totalMin, totalMax, startDate, startTime, endDate, endTime])

  const fetchSales = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = buildSaleParams(page, limit, {
        customerName, createdBy, totalMin, totalMax, startDate, startTime, endDate, endTime,
      })

      const response = await api.get(`/vendas`, { params })
      const { data, total } = parseListResponse<Sale>(response, 'sales')
      const closing = Number(response.data.closing) || 0

      setSales(data)
      salesRef.current = data
      setTotalItems(total)
      setPeriodTotal(closing)

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
  }, [page, limit, customerName, createdBy, totalMin, totalMax, startDate, startTime, endDate, endTime])

  useEffect(() => {
    fetchSales()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit])

  const poll = useCallback(async () => {
    try {
      const f = filterRef.current
      const params = buildSaleParams(page, limit, f)

      const response = await api.get(`/vendas`, { params })
      const { data, total } = parseListResponse<Sale>(response, 'sales')
      const closing = Number(response.data.closing) || 0

      const previous = salesRef.current || []
      if (!isSalesEqual(previous, data)) {
        setSales(data)
        salesRef.current = data
        setTotalItems(total)
      setPeriodTotal(closing)

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

  useRealtimeEvents(['sales'], poll)

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

  const handleModalConfirm = async (customerName: string, items: { productId: number | string; quantity: number; unitPrice?: number }[]) => {
    setIsLoading(true)
    try {
      await api.post("/vendas", { customerName, items })
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
      if (sale.items && Array.isArray(sale.items)) {
        const items = sale.items.map((item: SaleItem) => ({
          productId: item.productId ?? (item.product ? item.product.id : undefined),
          quantity: Number(item.quantity) || 0,
          name: item.product?.name,
          unitPrice: item.unitPriceAtSale != null ? Number(item.unitPriceAtSale) : (item.product ? Number(item.product.price || 0) : undefined),
        })).filter((item) => item.productId != null && item.productId !== '')
        setCurrentSaleItems(items as { productId: number | string; quantity: number; unitPrice?: number; name?: string }[])
      } else {
        setCurrentSaleItems([])
      }

      setCurrentSaleClient(sale.customerName ?? '')
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

  const handleCancelSale = async (id: number | string) => {
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
        customerName={{ value: customerName, onChange: setCustomerName }}
        createdBy={{ value: createdBy, onChange: setCreatedBy }}
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
        initialItems={currentSaleItems}
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
              {showSkeleton ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="animate-in fade-in-0 duration-300">
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
                  <TableRow key={sale.id} accentColor={getStatusColor('CLOSED')} className="animate-in fade-in-0 duration-300">
                    <TableCell className="text-center">{(page - 1) * limit + index + 1}</TableCell>
                    <TableCell>
                      <div className="font-medium">{sale.customerName || "Não Informado"}</div>
                      {formatItemsSummary(sale.items) && (
                        <div
                          className="text-sm text-muted-foreground truncate max-w-[280px]"
                          title={formatItemsSummary(sale.items)}
                        >
                          {formatItemsSummary(sale.items)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{sale.seller?.name || "-"}</TableCell>
                    <TableCell>{sale.soldAt ? new Date(sale.soldAt).toLocaleString() : "-"}</TableCell>
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
