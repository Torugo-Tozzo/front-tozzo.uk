import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import api from "@/services/api"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Pagination } from "@/components/Pagination"
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { BarChart3, Search } from "lucide-react"

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8", "#82ca9d", "#ffc658"];

type ProductType = {
  id: number
  descricao: string
}

export default function ChartsPage() {
  const getTodayDate = () => {
    const today = new Date()
    const yyyy = today.getFullYear()
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    const dd = String(today.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }

  // Filters
  const [startDate, setStartDate] = useState(getTodayDate())
  const [startTime, setStartTime] = useState("00:00")
  const [endDate, setEndDate] = useState(getTodayDate())
  const [endTime, setEndTime] = useState("23:59")
  const [selectedTypeId, setSelectedTypeId] = useState("0")
  const [chartType, setChartType] = useState<"bar" | "column" | "line" | "pie">("bar")

  // Data
  const [chartData, setChartData] = useState<any[]>([])
  const [productTypes, setProductTypes] = useState<ProductType[]>([])
  const [periodTotal, setPeriodTotal] = useState<{ totalUnidadesVendidas: number, totalFaturado: number } | null>(null)

  // Detailed List Data
  const [detailedData, setDetailedData] = useState<any[]>([])
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [totalPages, setTotalPages] = useState(0)
  const [totalItems, setTotalItems] = useState(0)
  const [hasMore, setHasMore] = useState(false)

  useEffect(() => {
    fetchTypes()
    fetchChartData()
    fetchDetailedData()
  }, [])

  useEffect(() => {
    fetchDetailedData()
  }, [page, limit])

  const fetchTypes = async () => {
    try {
      const response = await api.get("/tipos")
      setProductTypes(response.data)
    } catch (error) {
      console.error("Error fetching types", error)
    }
  }

  const fetchChartData = async () => {
    try {
      const params: any = {}
      
      if (startDate && startTime) {
        params.dataInicial = new Date(`${startDate}T${startTime}:00`).toISOString()
      }
      
      if (endDate && endTime) {
        params.dataFinal = new Date(`${endDate}T${endTime}:59`).toISOString()
      }

      if (selectedTypeId && selectedTypeId !== "0") {
        params.tipoProdutoId = parseInt(selectedTypeId)
      }

      const response = await api.get("/graficos", { params })
      
      if (response.data && response.data.produtos) {
        const formattedData = response.data.produtos.map((item: any) => ({
          name: item.nome,
          sales: item.quantidadeVendida,
          revenue: typeof item.totalFaturado === 'string' ? parseFloat(item.totalFaturado) : item.totalFaturado
        }))
        setChartData(formattedData)
      }

      if (response.data && response.data.fechamento) {
        setPeriodTotal(response.data.fechamento)
      }

    } catch (error) {
      console.error("Error fetching chart data", error)
      setChartData([])
    }
  }

  const fetchDetailedData = async () => {
    try {
      const params: any = { page, limit }
      
      if (startDate && startTime) {
        params.dataInicial = new Date(`${startDate}T${startTime}:00`).toISOString()
      }
      
      if (endDate && endTime) {
        params.dataFinal = new Date(`${endDate}T${endTime}:59`).toISOString()
      }

      if (selectedTypeId && selectedTypeId !== "0") {
        params.tipoProdutoId = parseInt(selectedTypeId)
      }

      const response = await api.get("/graficos/lista", { params })
      
      let data = []
      let total = 0

      if (response.data.data) {
        data = response.data.data
        total = response.data.total || response.data.count || 0
      } else if (response.data.produtos) {
        data = response.data.produtos
        total = response.data.total || response.data.count || 0
      } else if (Array.isArray(response.data)) {
        data = response.data
        const totalHeader = response.headers['x-total-count']
        total = totalHeader ? parseInt(totalHeader) : 0
      }

      setDetailedData(data)
      setTotalItems(total)

      if (total > 0) {
        setTotalPages(Math.ceil(total / limit))
        setHasMore(page < Math.ceil(total / limit))
      } else {
        setTotalPages(0)
        setHasMore(data.length === limit)
      }
    } catch (error) {
      console.error("Error fetching detailed data", error)
      setDetailedData([])
    }
  }

  const handleSearch = () => {
    setPage(1)
    fetchChartData()
    fetchDetailedData()
  }

  const renderChart = () => {
    switch (chartType) {
      case "bar": // Horizontal Bar
        return (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart layout="vertical" data={chartData} margin={{ top: 20, right: 30, left: 40, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={100} />
              <Tooltip formatter={(value) => `R$ ${value}`} />
              <Legend />
              <Bar dataKey="revenue" name="Receita" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        )
      case "column": // Vertical Bar
        return (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value) => `R$ ${value}`} />
              <Legend />
              <Bar dataKey="revenue" name="Receita" fill="#82ca9d" />
            </BarChart>
          </ResponsiveContainer>
        )
      case "line":
        return (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value) => `R$ ${value}`} />
              <Legend />
              <Line type="monotone" dataKey="revenue" name="Receita" stroke="#8884d8" activeDot={{ r: 8 }} />
              <Line type="monotone" dataKey="sales" name="Vendas (Qtd)" stroke="#82ca9d" />
            </LineChart>
          </ResponsiveContainer>
        )
      case "pie":
        return (
          <ResponsiveContainer width="100%" height={400}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry: any) => `${entry.name} ${((entry.percent ?? 0) * 100).toFixed(0)}%`}
                outerRadius={150}
                fill="#8884d8"
                dataKey="revenue"
                nameKey="name"
              >
                {chartData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `R$ ${value}`} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )
      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <BarChart3 className="h-8 w-8" />
          Relatórios e Gráficos
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Data Inicial</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Hora Inicial</Label>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Data Final</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Hora Final</Label>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo de Alimento</Label>
              <Select value={selectedTypeId} onValueChange={setSelectedTypeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Todos</SelectItem>
                  {productTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id.toString()}>
                      {type.descricao}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button className="w-full md:w-auto" onClick={handleSearch}>
              <Search className="mr-2 h-4 w-4" /> Pesquisar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="min-h-[500px]">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle>Visualização de Vendas</CardTitle>
          <div className="w-[200px]">
            <Select value={chartType} onValueChange={(value: any) => setChartType(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o gráfico" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bar">Barras (Horizontal)</SelectItem>
                <SelectItem value="column">Colunas (Vertical)</SelectItem>
                <SelectItem value="line">Linhas</SelectItem>
                <SelectItem value="pie">Pizza</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {periodTotal && (
            <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-lg border p-3">
                <div className="text-sm font-medium text-muted-foreground">Total Faturado</div>
                <div className="text-2xl font-bold">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(periodTotal.totalFaturado)}
                </div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-sm font-medium text-muted-foreground">Unidades Vendidas</div>
                <div className="text-2xl font-bold">{periodTotal.totalUnidadesVendidas}</div>
              </div>
            </div>
          )}
          {chartData.length > 0 ? (
            renderChart()
          ) : (
            <div className="flex h-[400px] items-center justify-center text-muted-foreground">
              Nenhum dado encontrado para os filtros selecionados.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Detalhamento de Vendas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 text-sm text-muted-foreground">
            Total de registros: {totalItems}
          </div>
          <Table>
            <TableCaption>Lista detalhada dos produtos vendidos no período.</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">#</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead className="text-right">Qtd. Vendida</TableHead>
                <TableHead className="text-right">Total Faturado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detailedData.map((item, index) => (
                <TableRow key={item.id || index}>
                  <TableCell>{(page - 1) * limit + index + 1}</TableCell>
                  <TableCell>{item.nome}</TableCell>
                  <TableCell className="text-right">{item.quantidadeVendida}</TableCell>
                  <TableCell className="text-right">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.totalFaturado)}
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
