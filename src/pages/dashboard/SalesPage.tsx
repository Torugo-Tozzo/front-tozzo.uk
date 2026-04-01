import { useState, useEffect, useRef } from "react"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, DollarSign, Info, Search, Loader2 } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { usePolling } from "@/hooks/usePolling"
import { useToast } from "@/contexts/ToastContext"
import { ProductSelectionModal } from "@/components/ProductSelectionModal"
import { Pagination } from "@/components/Pagination"
import { Skeleton } from "@/components/ui/skeleton"
import { salesService, type Sale } from "@/services/sales"
import { formatDateTime, formatCurrency, getTodayDate, toISO } from "@/utils/format"

export default function SalesPage() {
  const { user } = useAuth()
  const toast = useToast()

  const [sales, setSales] = useState<Sale[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [totalPages, setTotalPages] = useState(0)
  const [totalItems, setTotalItems] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [currentSaleItems, setCurrentSaleItems] = useState<any[]>([])
  const [currentSaleClient, setCurrentSaleClient] = useState("")
  const [isReadOnlyModal, setIsReadOnlyModal] = useState(false)
  const [currentSaleId, setCurrentSaleId] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadingSaleId, setLoadingSaleId] = useState<number | null>(null)
  const [periodTotal, setPeriodTotal] = useState(0)
  const salesRef = useRef<Sale[]>([])

  const now = new Date()
  const ago24 = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const pad2 = (n: number) => String(n).padStart(2, '0')

  const [startDate, setStartDate] = useState(
    `${ago24.getFullYear()}-${pad2(ago24.getMonth() + 1)}-${pad2(ago24.getDate())}`
  )
  const [startTime, setStartTime] = useState(`${pad2(ago24.getHours())}:${pad2(ago24.getMinutes())}`)
  const [endDate, setEndDate] = useState(getTodayDate())
  const [endTime, setEndTime] = useState(`${pad2(now.getHours())}:${pad2(now.getMinutes())}`)

  useEffect(() => {
    fetchSales()
  }, [page, limit])

  const fetchSales = async () => {
    setIsLoading(true)
    try {
      const { items, total, fechamento, totalPages, hasMore } = await salesService.list({
        page,
        limit,
        dataInicial: startDate && startTime ? toISO(startDate, startTime) : undefined,
        dataFinal: endDate && endTime ? toISO(endDate, endTime, '59') : undefined,
      })
      setSales(items)
      salesRef.current = items
      setTotalItems(total)
      setPeriodTotal(fechamento)
      setTotalPages(totalPages)
      setHasMore(hasMore)
    } catch {
      toast("Erro ao carregar vendas", "error")
    } finally {
      setIsLoading(false)
    }
  }

  const poll = async () => {
    try {
      const pollNow = new Date()
      const { items, total, fechamento, totalPages, hasMore } = await salesService.list({
        page,
        limit,
        dataInicial: new Date(pollNow.getTime() - 24 * 60 * 60 * 1000).toISOString(),
        dataFinal: pollNow.toISOString(),
      })
      const previous = salesRef.current
      const changed =
        items.length !== previous.length ||
        items.some((s, i) => {
          const p = previous[i]
          return s.id !== p?.id || s.total !== p?.total || (s.horario || '') !== (p.horario || '')
        })
      if (changed) {
        setSales(items)
        salesRef.current = items
        setTotalItems(total)
        setPeriodTotal(fechamento)
        setTotalPages(totalPages)
        setHasMore(hasMore)
      }
    } catch { /* silent */ }
  }

  usePolling(poll, 8000)

  const handleModalConfirm = async (
    cliente: string,
    itens: { produtoId: number; quantidade: number; precoHistorico?: number }[]
  ) => {
    setIsLoading(true)
    try {
      await salesService.create(cliente, itens)
      await fetchSales()
      setIsModalOpen(false)
    } catch {
      toast("Erro ao criar venda", "error")
    } finally {
      setIsLoading(false)
    }
  }

  const handleInfoClick = async (sale: Sale) => {
    setLoadingSaleId(sale.id)
    try {
      const items = await salesService.getItems(sale)
      setCurrentSaleItems(items)
      setCurrentSaleClient(sale.cliente)
      setCurrentSaleId(sale.id)
      setIsReadOnlyModal(true)
      setIsModalOpen(true)
    } catch {
      toast("Erro ao carregar detalhes da venda", "error")
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
      await salesService.delete(id)
      await fetchSales()
      setIsModalOpen(false)
      setCurrentSaleId(null)
      toast("Venda cancelada", "success")
    } catch {
      toast("Erro ao cancelar venda", "error")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <DollarSign className="h-8 w-8" />
          {`Vendas${user?.estabelecimento?.nomeFantasia ? ` do ${user.estabelecimento.nomeFantasia}` : ''}`}
        </h1>
        <Button onClick={handleNewSaleClick} disabled={isLoading}>
          <Plus className="mr-2 h-4 w-4" /> Nova Venda
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Data Inicial</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="startTime">Hora Inicial</Label>
              <Input
                id="startTime"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">Data Final</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">Hora Final</Label>
              <Input
                id="endTime"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button
              onClick={() => { setPage(1); fetchSales() }}
              className="w-full md:w-auto"
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Search className="mr-2 h-4 w-4" />
              )}
              Filtrar
            </Button>
          </div>
        </CardContent>
      </Card>

      <ProductSelectionModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setCurrentSaleId(null); setIsReadOnlyModal(false) }}
        onConfirm={handleModalConfirm}
        title={isReadOnlyModal ? "Detalhes da Venda" : "Nova Venda"}
        initialClientName={currentSaleClient}
        initialOrderItems={currentSaleItems as any}
        readOnly={isReadOnlyModal}
        onCancelSale={
          isReadOnlyModal && currentSaleId
            ? async () => handleCancelSale(currentSaleId)
            : undefined
        }
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle>Vendas Recentes</CardTitle>
            <div className="text-sm text-muted-foreground mt-1">
              Total de registros: {totalItems}
            </div>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-sm text-muted-foreground">Fechamento do Período</span>
            <span className="text-2xl font-bold text-green-600">
              {formatCurrency(periodTotal)}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableCaption>Lista das últimas vendas realizadas.</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">#</TableHead>
                <TableHead className="w-[100px]">Info</TableHead>
                <TableHead>Cliente / Mesa</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-6 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[200px]" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
                    <TableCell className="text-right justify-end flex">
                      <Skeleton className="h-4 w-16" />
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                sales.map((sale, index) => (
                  <TableRow key={sale.id}>
                    <TableCell>{(page - 1) * limit + index + 1}</TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleInfoClick(sale)}
                        disabled={loadingSaleId === sale.id}
                      >
                        {loadingSaleId === sale.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Info className="h-4 w-4" />
                        )}
                      </Button>
                    </TableCell>
                    <TableCell>{sale.cliente || "Não Informado"}</TableCell>
                    <TableCell>{formatDateTime(sale.horario)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(sale.total)}</TableCell>
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
            onPageSizeChange={(newLimit) => {
              setLimit(newLimit)
              setPage(1)
            }}
            isLoading={isLoading}
          />
        </CardContent>
      </Card>
    </div>
  )
}
