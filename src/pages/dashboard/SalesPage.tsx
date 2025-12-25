import { useState, useEffect } from "react"
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
import api from "@/services/api"
import { useAuth } from "@/contexts/AuthContext"
import { ProductSelectionModal } from "@/components/ProductSelectionModal"
import { Pagination } from "@/components/Pagination"

type Sale = {
  id: number
  cliente: string
  total: number
  horario: string
}

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const { user } = useAuth()
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [totalPages, setTotalPages] = useState(0)
  const [totalItems, setTotalItems] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  
  const [currentSaleItems, setCurrentSaleItems] = useState<{ produtoId: number | string; quantidade: number }[]>([])
  const [currentSaleClient, setCurrentSaleClient] = useState("")
  const [isReadOnlyModal, setIsReadOnlyModal] = useState(false)

  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingDetails, setIsLoadingDetails] = useState(false)

  // Use últimas 24 horas como padrão: end = now, start = now - 24h
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

  useEffect(() => {
    setIsLoading(true)
    fetchSales().finally(() => setIsLoading(false))
  }, [page, limit])

  const fetchSales = async () => {
    try {
      const params: any = { page, limit }
      
      if (startDate && startTime) {
        params.dataInicial = new Date(`${startDate}T${startTime}:00`).toISOString()
      }
      
      if (endDate && endTime) {
        params.dataFinal = new Date(`${endDate}T${endTime}:59`).toISOString()
      }

      const response = await api.get(`/vendas`, { params })
      
      let data = []
      let total = 0
      let fechamento = 0

      if (response.data.vendas) {
        data = response.data.vendas
        fechamento = Number(response.data.fechamento) || 0
        // Tenta pegar o total de itens para paginação
        total = response.data.total || response.data.count || 0
        if (!total && response.headers['x-total-count']) {
          total = parseInt(response.headers['x-total-count'])
        }
        // Se ainda não tiver total mas tiver dados, assume o tamanho dos dados (fallback)
        if (!total && data.length > 0) total = data.length
      } else if (response.data.data) {
        data = response.data.data
        total = response.data.total || response.data.count || 0
      } else if (Array.isArray(response.data)) {
        data = response.data
        const totalHeader = response.headers['x-total-count']
        total = totalHeader ? parseInt(totalHeader) : 0
      }

      setSales(data)
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
    }
  }

  const handleModalConfirm = async (cliente: string, itens: { produtoId: number; quantidade: number }[]) => {
    setIsLoading(true)
    try {
      await api.post("/vendas", {
        cliente,
        itens
      })
      await fetchSales()
      setIsModalOpen(false)
    } catch (error) {
      console.error("Error creating sale", error)
      alert("Erro ao criar venda")
    } finally {
      setIsLoading(false)
    }
  }

  const handleInfoClick = async (sale: Sale) => {
    setIsLoadingDetails(true)
    try {
      // If the sale object already contains items, use them
      // (some APIs include itens in the list). Otherwise try to
      // fetch related pedido by `pedidoId` or fallback to `/vendas/{id}`.
      if ((sale as any).itens && Array.isArray((sale as any).itens)) {
        const items = (sale as any).itens.map((item: any) => ({
          produtoId: item.produtoId ?? (item.produto ? item.produto.id : undefined),
          quantidade: Number(item.quantidade) || 0,
        })).filter((i: any) => i.produtoId != null && i.produtoId !== '')
        setCurrentSaleItems(items)
      } else {
        let itemsFound: { produtoId: number; quantidade: number }[] = []

        // If sale has pedidoId, fetch the pedido which usually contains itens
        if ((sale as any).pedidoId) {
          try {
            const resp = await api.get(`/pedidos`, { params: { id: (sale as any).pedidoId } })
            let pedidoData = null
            if (resp.data.data && Array.isArray(resp.data.data)) pedidoData = resp.data.data[0]
            else if (Array.isArray(resp.data)) pedidoData = resp.data[0]

            if (pedidoData && pedidoData.itens) {
              itemsFound = pedidoData.itens.map((item: any) => ({
                produtoId: item.produtoId ?? (item.produto ? item.produto.id : undefined),
                quantidade: Number(item.quantidade) || 0,
              })).filter((i: any) => i.produtoId != null && i.produtoId !== '')
            }
          } catch (e) {
            // ignore and try other fallbacks
            console.warn('Error fetching pedido for venda details', e)
          }
        }

        // Fallback: try GET /vendas/{id} in case server exposes it
        if (itemsFound.length === 0) {
          try {
            const resp2 = await api.get(`/vendas/${sale.id}`)
            const vendaData = resp2.data && (resp2.data.venda || resp2.data)
            if (vendaData && vendaData.itens) {
              itemsFound = vendaData.itens.map((item: any) => ({
                produtoId: item.produtoId ?? (item.produto ? item.produto.id : undefined),
                quantidade: Number(item.quantidade) || 0,
              })).filter((i: any) => i.produtoId != null && i.produtoId !== '')
            }
          } catch (e) {
            // ignore, server may not support this route
          }
        }

        setCurrentSaleItems(itemsFound)
      }

      setCurrentSaleClient(sale.cliente)
      setIsReadOnlyModal(true)
      setIsModalOpen(true)
    } catch (error) {
      console.error("Error fetching sale details", error)
      alert("Erro ao carregar detalhes da venda")
    } finally {
      setIsLoadingDetails(false)
    }
  }

  const handleNewSaleClick = () => {
    setCurrentSaleClient("")
    setCurrentSaleItems([])
    setIsReadOnlyModal(false)
    setIsModalOpen(true)
  }

  return (
    <div className="space-y-6">
      {(isLoading || isLoadingDetails) && (
        <div className="flex justify-center items-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <DollarSign className="h-8 w-8" />
          {`Vendas${user?.estabelecimento?.nomeFantasia ? ` do ${user.estabelecimento.nomeFantasia}` : ''}`}
        </h1>
        <Button onClick={handleNewSaleClick}>
          <Plus className="mr-2 h-4 w-4" /> Nova Venda
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="startTime">Hora Inicial</Label>
              <Input
                id="startTime"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">Data Final</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">Hora Final</Label>
              <Input
                id="endTime"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={() => { setPage(1); fetchSales(); }} className="w-full md:w-auto">
              <Search className="mr-2 h-4 w-4" /> Filtrar
            </Button>
          </div>
        </CardContent>
      </Card>

      <ProductSelectionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleModalConfirm}
        title={isReadOnlyModal ? "Detalhes da Venda" : "Nova Venda"}
        initialClientName={currentSaleClient}
        initialOrderItems={currentSaleItems as any}
        readOnly={isReadOnlyModal}
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
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(periodTotal)}
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
              {sales.map((sale, index) => (
                <TableRow key={sale.id}>
                  <TableCell>{(page - 1) * limit + index + 1}</TableCell>
                  <TableCell>
                    <Button variant="outline" size="icon" onClick={() => handleInfoClick(sale)}>
                      <Info className="h-4 w-4" />
                    </Button>
                  </TableCell>
                  <TableCell>{sale.cliente || "Não Informado"}</TableCell>
                  <TableCell>
                    {sale.horario ? new Date(sale.horario).toLocaleString() : "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(sale.total)}
                  </TableCell>
                </TableRow>
              ))}
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
          />
        </CardContent>
      </Card>
    </div>
  )
}
