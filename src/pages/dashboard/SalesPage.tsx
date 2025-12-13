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
import { Plus, DollarSign, Info, Search } from "lucide-react"
import api from "@/services/api"
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
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [totalPages, setTotalPages] = useState(0)
  const [totalItems, setTotalItems] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  
  const [currentSaleItems, setCurrentSaleItems] = useState<{ produtoId: number; quantidade: number }[]>([])
  const [currentSaleClient, setCurrentSaleClient] = useState("")
  const [isReadOnlyModal, setIsReadOnlyModal] = useState(false)

  const getTodayDate = () => {
    const today = new Date()
    const yyyy = today.getFullYear()
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    const dd = String(today.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }

  const [startDate, setStartDate] = useState(getTodayDate())
  const [startTime, setStartTime] = useState("00:00")
  const [endDate, setEndDate] = useState(getTodayDate())
  const [endTime, setEndTime] = useState("23:59")
  const [periodTotal, setPeriodTotal] = useState(0)

  useEffect(() => {
    fetchSales()
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
    try {
      await api.post("/vendas", {
        cliente,
        itens
      })
      fetchSales()
      setIsModalOpen(false)
    } catch (error) {
      console.error("Error creating sale", error)
      alert("Erro ao criar venda")
    }
  }

  const handleInfoClick = async (sale: Sale) => {
    try {
      // Try to fetch details if needed, or use what we have if the list returns items
      // Assuming we need to fetch details similar to orders
      // If the API doesn't support GET /vendas/{id}, we might need to rely on the list or another way.
      // Let's try to fetch from list with filter if possible or just assume we need to fetch.
      // Based on previous context, let's try to get details.
      // If GET /vendas/{id} is not available, we might need to check if the list response already has items.
      // Let's assume for now we can get it via query param like orders or just use the sale object if it has items (it might not).
      
      // Strategy: Fetch /vendas with id param to get details including items
      const response = await api.get(`/vendas`, { params: { id: sale.id } })
      
      let saleData = null
      if (response.data.data && Array.isArray(response.data.data)) {
        saleData = response.data.data[0]
      } else if (Array.isArray(response.data)) {
        saleData = response.data[0]
      }

      if (saleData && saleData.itens) {
         const items = saleData.itens.map((item: any) => ({
          produtoId: item.produtoId || (item.produto ? item.produto.id : 0),
          quantidade: item.quantidade
        })).filter((i: any) => i.produtoId > 0)
        setCurrentSaleItems(items)
      } else {
        setCurrentSaleItems([])
      }
      
      setCurrentSaleClient(sale.cliente)
      setIsReadOnlyModal(true)
      setIsModalOpen(true)
    } catch (error) {
      console.error("Error fetching sale details", error)
      alert("Erro ao carregar detalhes da venda")
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
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <DollarSign className="h-8 w-8" />
          Vendas
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
        initialOrderItems={currentSaleItems}
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
