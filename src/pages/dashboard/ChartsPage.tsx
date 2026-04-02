import { useState, useEffect, useRef } from "react"
import { useAuth } from "@/contexts/AuthContext"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import { BarChart3, Search, Loader2, ChevronLeft, ChevronRight, Clock } from "lucide-react"

import { Skeleton } from "@/components/ui/skeleton"

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8", "#82ca9d", "#ffc658"];

type ProductType = {
  id: number
  descricao: string
}

export default function ChartsPage() {
  const { user } = useAuth()
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
  const [periodTotal, setPeriodTotal] = useState<{ totalUnidadesVendidas: number, totalFaturado: number, totalNumeroVendas: number } | null>(null)

  // Detailed List Data
  const [detailedData, setDetailedData] = useState<any[]>([])
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [totalPages, setTotalPages] = useState(0)
  const [totalItems, setTotalItems] = useState(0)
  const [hasMore, setHasMore] = useState(false)

  const [isChartLoading, setIsChartLoading] = useState(false)
  const [isTableLoading, setIsTableLoading] = useState(false)
  const isLoading = isChartLoading || isTableLoading

  // Report generation state
  const [reportGeneratingType, setReportGeneratingType] = useState<'excel' | 'pdf' | null>(null)
  const [reportStatusUrl, setReportStatusUrl] = useState<string | null>(null)
  const [reportError, setReportError] = useState<string | null>(null)
  const pollTimerRef = useRef<number | null>(null)

  // Sales by Hour state
  const [salesByHourStartDate, setSalesByHourStartDate] = useState(getTodayDate())
  const [salesByHourEndDate, setSalesByHourEndDate] = useState(getTodayDate())
  const [salesByHourPage, setSalesByHourPage] = useState(0) // offset in days from start date
  const [salesByHourData, setSalesByHourData] = useState<any[]>([]) // raw API data
  const [salesByHourChartData, setSalesByHourChartData] = useState<any[]>([]) // aggregated by hour
  const [isSalesByHourLoading, setIsSalesByHourLoading] = useState(false)

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
    setIsChartLoading(true)
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
    } finally {
      setIsChartLoading(false)
    }
  }

  const fetchDetailedData = async () => {
    setIsTableLoading(true)
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
    } finally {
      setIsTableLoading(false)
    }
  }

  const handleSearch = async () => {
    setPage(1)
    await Promise.all([fetchChartData(), fetchDetailedData()])
  }

  // Fetch sales by hour data
  const fetchSalesByHour = async () => {
    setIsSalesByHourLoading(true)
    try {
      const params: any = {
        dataInicial: new Date(`${salesByHourStartDate}T00:00:00-03:00`).toISOString(),
        page: salesByHourPage
      }

      if (salesByHourEndDate) {
        params.dataFinal = new Date(`${salesByHourEndDate}T23:59:59-03:00`).toISOString()
      }

      const response = await api.get("/graficos/vendas-por-horario", { params })
      
      const rawData = Array.isArray(response.data) ? response.data : []
      setSalesByHourData(rawData)

      // Aggregate by hour (0-23)
      const hourCounts: { [hour: string]: { count: number, totalRevenue: number, sales: any[] } } = {}
      
      // Initialize all hours
      for (let h = 0; h < 24; h++) {
        const hourKey = String(h).padStart(2, '0') + ':00'
        hourCounts[hourKey] = { count: 0, totalRevenue: 0, sales: [] }
      }

      rawData.forEach((sale: any) => {
        const date = new Date(sale.horario)
        const brazilHour = ((date.getUTCHours() - 3) + 24) % 24
        const hourKey = String(brazilHour).padStart(2, '0') + ':00'
        if (hourCounts[hourKey]) {
          hourCounts[hourKey].count += 1
          hourCounts[hourKey].totalRevenue += parseFloat(sale.total) || 0
          hourCounts[hourKey].sales.push(sale)
        }
      })

      const aggregatedData = Object.entries(hourCounts)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([hour, data]) => ({
          hour,
          vendas: data.count,
          faturamento: data.totalRevenue,
          sales: data.sales
        }))

      setSalesByHourChartData(aggregatedData)
    } catch (error) {
      console.error("Error fetching sales by hour", error)
      setSalesByHourData([])
      setSalesByHourChartData([])
    } finally {
      setIsSalesByHourLoading(false)
    }
  }

  // Get the current day being displayed for sales by hour
  const getCurrentSalesByHourDate = () => {
    const startDateObj = new Date(salesByHourStartDate + 'T00:00:00')
    startDateObj.setDate(startDateObj.getDate() + salesByHourPage)
    return startDateObj.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  // Calculate max page (days between start and end date)
  const getSalesByHourMaxPage = () => {
    const start = new Date(salesByHourStartDate + 'T00:00:00')
    const end = new Date(salesByHourEndDate + 'T00:00:00')
    const diffTime = end.getTime() - start.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    return Math.max(0, diffDays)
  }

  const handleSalesByHourSearch = () => {
    setSalesByHourPage(0)
    fetchSalesByHour()
  }

  // Effect to fetch sales by hour when page changes
  useEffect(() => {
    if (salesByHourStartDate) {
      fetchSalesByHour()
    }
  }, [salesByHourPage])

  const buildFilterBody = () => {
    const body: any = {}
    if (startDate && startTime) body.dataInicial = new Date(`${startDate}T${startTime}:00`).toISOString()
    if (endDate && endTime) body.dataFinal = new Date(`${endDate}T${endTime}:59`).toISOString()
    if (selectedTypeId && selectedTypeId !== "0") body.tipoProdutoId = parseInt(selectedTypeId)
    return body
  }

  // downloadBlob removed in favor of downloadBlobWithRetry

  const downloadBlobWithRetry = async (url: string, filename?: string, attempts = 3) => {
    let lastErr: any = null
    for (let i = 0; i < attempts; i++) {
      try {
        const path = url.startsWith('http') ? url.replace(window.location.origin, '') : url
        const response = await api.get(path, { responseType: 'blob' } as any)
        const blob = response.data instanceof Blob ? response.data : new Blob([response.data])
        const link = document.createElement('a')
        link.href = window.URL.createObjectURL(blob)
        link.download = filename || 'relatorio'
        document.body.appendChild(link)
        link.click()
        link.remove()
        return
      } catch (err) {
        lastErr = err
        const backoff = 500 * Math.pow(2, i)
        await new Promise((r) => setTimeout(r, backoff))
      }
    }
    console.error('All download attempts failed', lastErr)
    setReportError('Falha ao baixar o arquivo após várias tentativas')
    throw lastErr
  }

  const stopPolling = () => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }

  const pollStatus = (taskId: string, statusPath?: string) => {
    const statusPathNormalized = statusPath ? (statusPath.startsWith('http') ? statusPath.replace(window.location.origin, '') : statusPath) : `/graficos/relatorio/${taskId}`
    let attempts = 0
    const maxAttempts = 90 // allow ~3 minutes if interval 2s
    const intervalMs = 2000
    stopPolling()

    return new Promise<any>((resolve, reject) => {
      pollTimerRef.current = window.setInterval(async () => {
        attempts += 1
        try {
          const resp = await api.get(statusPathNormalized, { headers: { Accept: 'application/json' } })
          const data = resp.data
          if (data?.status === 'done') {
            stopPolling()
            setReportGeneratingType(null)
            setReportStatusUrl(null)
            resolve(data)
          } else if (data?.status === 'error') {
            stopPolling()
            setReportGeneratingType(null)
            setReportError(data.error || 'Erro na geração do relatório')
            reject(new Error(data.error || 'Erro na geração do relatório'))
          }
        } catch (err) {
          console.error('Error polling report status', err)
          if (attempts >= maxAttempts) {
            stopPolling()
            setReportGeneratingType(null)
            setReportError('Tempo esgotado ao verificar status do relatório')
            reject(new Error('Tempo esgotado ao verificar status do relatório'))
          }
        }
      }, intervalMs)
    })
  }

  const generateReport = async (tipo: 'excel' | 'pdf' = 'excel') => {
    setReportError(null)
    setReportGeneratingType(tipo)
    setReportStatusUrl(null)

    try {
      const body = buildFilterBody()
      body.tipo = tipo
      // no callbackUrl by default -> use polling
      const response = await api.post('/graficos/relatorio', body)
      if (response.status === 201) {
        const resp = response.data || {}
        const taskId = resp.taskId || resp.id || null
        const statusUrl = resp.statusUrl || resp.status_url || (taskId ? `/graficos/relatorio/${taskId}` : null)
        const downloadUrl = resp.downloadUrl || resp.download_url || null
        setReportStatusUrl(statusUrl)

        if (taskId) {
          // wait until status === done, then download
          try {
            const statusResult = await pollStatus(taskId, statusUrl || undefined)
            const finalDownload = statusResult?.downloadUrl || statusResult?.download_url || downloadUrl
            if (finalDownload) {
              await downloadBlobWithRetry(finalDownload, statusResult?.filename || resp.filename)
              setReportGeneratingType(null)
            } else {
              setReportGeneratingType(null)
              setReportError('Relatório pronto, mas sem URL de download')
            }
          } catch (err: any) {
            console.error('Polling failed', err)
            setReportGeneratingType(null)
            setReportError(err?.message || 'Erro no polling do relatório')
          }
        } else if (downloadUrl) {
          // No taskId (backend provided immediate download URL). Try download with retry.
          try {
            await downloadBlobWithRetry(downloadUrl, resp.filename)
          } finally {
            setReportGeneratingType(null)
          }
        } else {
          setReportGeneratingType(null)
          setReportError('Resposta inválida do servidor')
        }
      } else {
        setReportGeneratingType(null)
        setReportError('Falha ao iniciar geração do relatório')
      }
    } catch (err: any) {
      console.error('Error generating report', err)
      setReportGeneratingType(null)
      setReportError(err?.response?.data?.message || 'Erro ao iniciar geração do relatório')
    }
  }

  useEffect(() => {
    return () => {
      stopPolling()
    }
  }, [])

  const renderChart = () => {
    const tooltipStyle = { backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', color: '#0f172a' }

    switch (chartType) {
      case "bar": // Faturamento
        return (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart layout="vertical" data={chartData} margin={{ top: 20, right: 30, left: 40, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={100} />
              <Tooltip formatter={(value) => `R$ ${value}`} contentStyle={tooltipStyle} />
              <Legend />
              <Bar dataKey="revenue" name="Receita" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        )
      case "column": // № de Vendas
        return (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend />
              <Bar dataKey="sales" name="Vendas" fill="#82ca9d" />
            </BarChart>
          </ResponsiveContainer>
        )
      case "line": // Faturamento e Vendas
        return (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value, name) => name === 'Receita' ? `R$ ${value}` : value} contentStyle={tooltipStyle} />
              <Legend />
              <Line type="monotone" dataKey="revenue" name="Receita" stroke="#8884d8" activeDot={{ r: 8 }} />
              <Line type="monotone" dataKey="sales" name="Vendas (Qtd)" stroke="#82ca9d" />
            </LineChart>
          </ResponsiveContainer>
        )
      case "pie": // № de Vendas (Pizza)
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
                dataKey="sales"
                nameKey="name"
              >
                {chartData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
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
          {`Relatórios e Gráficos${user?.estabelecimento?.nomeFantasia ? ` do ${user.estabelecimento.nomeFantasia}` : ''}`}
        </h1>
      </div>

      <Tabs defaultValue="produtos" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="produtos">Produtos Vendidos</TabsTrigger>
          <TabsTrigger value="horarios">Vendas por Horário</TabsTrigger>
        </TabsList>

        <TabsContent value="produtos" className="space-y-6">
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
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label>Hora Inicial</Label>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label>Data Final</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label>Hora Final</Label>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo de Alimento</Label>
              <Select value={selectedTypeId} onValueChange={setSelectedTypeId} disabled={isLoading}>
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
          <div className="mt-4 flex flex-col items-end">
            <div className="flex gap-2 w-full md:w-auto justify-end">
              <Button
                className="w-full md:w-auto"
                onClick={() => generateReport('excel')}
                disabled={!!reportGeneratingType || isLoading || detailedData.length === 0}
              >
                {reportGeneratingType === 'excel' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Gerar Excel
              </Button>
              <Button
                className="w-full md:w-auto"
                onClick={() => generateReport('pdf')}
                disabled={!!reportGeneratingType || isLoading || detailedData.length === 0}
              >
                {reportGeneratingType === 'pdf' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Gerar PDF
              </Button>
              <Button className="w-full md:w-auto" onClick={handleSearch} disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                Pesquisar
              </Button>
            </div>
            {reportGeneratingType && (
              <div className="mt-2 text-sm text-muted-foreground">
                Gerando relatório{reportGeneratingType ? ` (${reportGeneratingType.toUpperCase()})` : ''}... {reportStatusUrl ? (
                  <>
                    Ver status em{' '}
                    <a className="underline" href={reportStatusUrl?.startsWith('http') ? reportStatusUrl : window.location.origin + (reportStatusUrl || '')} target="_blank" rel="noreferrer">status</a>
                  </>
                ) : null}
              </div>
            )}
            {/* download link and task id hidden — download is automatic */}
            {reportError && (
              <div className="mt-2 text-sm text-red-600">{reportError}</div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="min-h-[500px]">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle>Visualização de Vendas</CardTitle>
          <div className="w-[200px]">
            <Select value={chartType} onValueChange={(value: any) => setChartType(value)} disabled={isLoading}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o gráfico" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bar">Faturamento</SelectItem>
                <SelectItem value="column">№ de Vendas</SelectItem>
                <SelectItem value="line">Faturamento e Vendas</SelectItem>
                <SelectItem value="pie">№ de Vendas (Pizza)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isChartLoading ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                 <Skeleton className="h-20 rounded-lg" />
                 <Skeleton className="h-20 rounded-lg" />
                 <Skeleton className="h-20 rounded-lg" />
              </div>
              <Skeleton className="h-[400px] w-full rounded-lg" />
            </div>
          ) : (
            <>
              {periodTotal && (
                <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="rounded-lg border p-3">
                    <div className="text-sm font-medium text-muted-foreground">Total Faturado</div>
                    <div className="text-2xl font-bold">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(periodTotal.totalFaturado)}
                    </div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-sm font-medium text-muted-foreground">Total de Vendas</div>
                    <div className="text-2xl font-bold">{periodTotal.totalNumeroVendas}</div>
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
            </>
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
              {isTableLoading ? (
                Array.from({ length: limit || 10 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Skeleton className="h-4 w-8" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-[200px]" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Skeleton className="h-4 w-12 ml-auto" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Skeleton className="h-4 w-24 ml-auto" />
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                detailedData.map((item, index) => (
                  <TableRow key={item.id || index}>
                    <TableCell>{(page - 1) * limit + index + 1}</TableCell>
                    <TableCell>{item.nome}</TableCell>
                    <TableCell className="text-right">{item.quantidadeVendida}</TableCell>
                    <TableCell className="text-right">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.totalFaturado)}
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
            onPageSizeChange={(newLimit) => {
              setLimit(newLimit)
              setPage(1)
            }}
            isLoading={isTableLoading}
          />
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="horarios" className="space-y-6">
          {/* Filtros */}
          <Card>
            <CardHeader>
              <CardTitle>Filtros</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Data Inicial</Label>
                  <Input
                    type="date"
                    value={salesByHourStartDate}
                    onChange={(e) => setSalesByHourStartDate(e.target.value)}
                    disabled={isSalesByHourLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data Final</Label>
                  <Input
                    type="date"
                    value={salesByHourEndDate}
                    onChange={(e) => setSalesByHourEndDate(e.target.value)}
                    disabled={isSalesByHourLoading}
                  />
                </div>
                <div className="flex items-end">
                  <Button 
                    className="w-full" 
                    onClick={handleSalesByHourSearch} 
                    disabled={isSalesByHourLoading}
                  >
                    {isSalesByHourLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                    Pesquisar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Chart */}
          <Card className="min-h-[500px]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Vendas por Horário
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Summary cards */}
              {isSalesByHourLoading ? (
                <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                  <Skeleton className="h-20 rounded-lg" />
                  <Skeleton className="h-20 rounded-lg" />
                  <Skeleton className="h-20 rounded-lg" />
                </div>
              ) : salesByHourData.length > 0 && (
                <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="rounded-lg border p-3">
                    <div className="text-sm font-medium text-muted-foreground">Total de Vendas</div>
                    <div className="text-2xl font-bold">{salesByHourData.length}</div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-sm font-medium text-muted-foreground">Faturamento do Dia</div>
                    <div className="text-2xl font-bold">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                        salesByHourData.reduce((sum: number, sale: any) => sum + (parseFloat(sale.total) || 0), 0)
                      )}
                    </div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-sm font-medium text-muted-foreground">Horário de Pico</div>
                    <div className="text-2xl font-bold">
                      {salesByHourChartData.reduce((max: any, curr: any) => {
                        if (!max) return curr
                        if (curr.vendas > max.vendas) return curr
                        if (curr.vendas === max.vendas && curr.faturamento > max.faturamento) return curr
                        return max
                      }, null)?.hour || '-'}
                    </div>
                  </div>
                </div>
              )}

              {/* Day navigation */}
              <div className="flex items-center justify-center gap-4 mb-4">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setSalesByHourPage(Math.max(0, salesByHourPage - 1))}
                  disabled={salesByHourPage === 0 || isSalesByHourLoading}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="text-center min-w-[250px]">
                  <div className="font-medium capitalize">{getCurrentSalesByHourDate()}</div>
                  <div className="text-sm text-muted-foreground">
                    Dia {salesByHourPage + 1} de {getSalesByHourMaxPage() + 1}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setSalesByHourPage(Math.min(getSalesByHourMaxPage(), salesByHourPage + 1))}
                  disabled={salesByHourPage >= getSalesByHourMaxPage() || isSalesByHourLoading}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {isSalesByHourLoading ? (
                <Skeleton className="h-[400px] w-full rounded-lg" />
              ) : salesByHourChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={salesByHourChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" />
                    <YAxis allowDecimals={false} />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload
                          return (
                            <div className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-lg border">
                              <p className="font-semibold mb-2">{label}</p>
                              <p className="text-sm">Vendas: <span className="font-medium">{data.vendas}</span></p>
                              <p className="text-sm">Faturamento: <span className="font-medium">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(data.faturamento)}</span></p>
                              {data.sales && data.sales.length > 0 && (
                                <div className="mt-2 pt-2 border-t max-h-[150px] overflow-y-auto">
                                  <p className="text-xs text-muted-foreground mb-1">Detalhes:</p>
                                  {data.sales.slice(0, 5).map((sale: any, idx: number) => (
                                    <div key={sale.id || idx} className="text-xs py-1 border-b last:border-b-0">
                                      <div className="flex justify-between">
                                        <span>{new Date(sale.horario).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                                        <span className="font-medium">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(sale.total)}</span>
                                      </div>
                                      {sale.cliente && <div className="text-muted-foreground">{sale.cliente}</div>}
                                    </div>
                                  ))}
                                  {data.sales.length > 5 && (
                                    <p className="text-xs text-muted-foreground mt-1">+{data.sales.length - 5} mais...</p>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        }
                        return null
                      }}
                    />
                    <Legend />
                    <Bar dataKey="vendas" name="Vendas" fill="#82ca9d" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[400px] items-center justify-center text-muted-foreground">
                  {salesByHourData.length === 0 ? 'Nenhuma venda encontrada para este dia.' : 'Selecione um período e clique em Pesquisar.'}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
