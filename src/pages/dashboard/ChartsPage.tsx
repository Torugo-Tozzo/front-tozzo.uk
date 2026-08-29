import { useState, useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import { useAuth } from "@/contexts/AuthContext"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import api from "@/services/api"
import { toast } from "sonner"
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
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Pagination } from "@/components/Pagination"
import { useMinLoadingDuration } from "@/hooks/useMinLoadingDuration"
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
import { formatChartValue, formatCount, formatCurrencyBRL, formatDate, formatNumber, formatTime } from "@/i18n/format"
import { getCatalogLabel } from "@/i18n/labels"
import { normalizeLocale } from "@/i18n/locale"
import type { ProductType } from "@/domain/models"

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8", "#82ca9d", "#ffc658"];

type ChartPoint = {
  name: string
  sales: number
  revenue: number
}

type SalesSummary = {
  totalUnitsSold: number
  totalRevenue: number
  totalSales: number
}

type DetailedSalesRow = {
  id?: number | string
  name: string
  quantitySold: number
  totalRevenue: number
}

type HourlySale = {
  id?: number | string
  soldAt: string
  total: number | string
  customerName?: string | null
}

type HourlyChartPoint = {
  hour: string
  salesCount: number
  revenue: number
  sales: HourlySale[]
}

export default function ChartsPage() {
  const { i18n } = useTranslation()
  const { t: tCharts } = useTranslation("charts")
  const { t: tCommon } = useTranslation("common")
  const { t: tProducts } = useTranslation("products")
  const { t: tErrors } = useTranslation("errors")
  const activeLocale = normalizeLocale(i18n.language)
  const recordCountMessages = {
    zero: tCommon('recordCount.zero'),
    one: tCommon('recordCount.one'),
    two: tCommon('recordCount.two'),
    few: tCommon('recordCount.few'),
    many: tCommon('recordCount.many'),
    other: tCommon('recordCount.other'),
  }
  const unitCountMessages = {
    zero: tCommon('unitCount.zero'),
    one: tCommon('unitCount.one'),
    two: tCommon('unitCount.two'),
    few: tCommon('unitCount.few'),
    many: tCommon('unitCount.many'),
    other: tCommon('unitCount.other'),
  }
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
  const [chartData, setChartData] = useState<ChartPoint[]>([])
  const [productTypes, setProductTypes] = useState<ProductType[]>([])
  const [periodTotal, setPeriodTotal] = useState<SalesSummary | null>(null)

  // Detailed List Data
  const [detailedData, setDetailedData] = useState<DetailedSalesRow[]>([])
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [totalPages, setTotalPages] = useState(0)
  const [totalItems, setTotalItems] = useState(0)
  const [hasMore, setHasMore] = useState(false)

  const [isChartLoading, setIsChartLoading] = useState(false)
  const [isTableLoading, setIsTableLoading] = useState(false)
  const isLoading = isChartLoading || isTableLoading
  const showTableSkeleton = useMinLoadingDuration(isTableLoading)

  // Report generation state
  const [reportGeneratingType, setReportGeneratingType] = useState<'excel' | 'pdf' | null>(null)
  const [reportStatusUrl, setReportStatusUrl] = useState<string | null>(null)
  const [reportError, setReportError] = useState<string | null>(null)
  const pollTimerRef = useRef<number | null>(null)

  // Sales by Hour state
  const [salesByHourStartDate, setSalesByHourStartDate] = useState(getTodayDate())
  const [salesByHourEndDate, setSalesByHourEndDate] = useState(getTodayDate())
  const [salesByHourPage, setSalesByHourPage] = useState(0) // offset in days from start date
  const [salesByHourData, setSalesByHourData] = useState<HourlySale[]>([])
  const [salesByHourChartData, setSalesByHourChartData] = useState<HourlyChartPoint[]>([])
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
      setProductTypes(Array.isArray(response.data) ? response.data : response.data.types ?? [])
    } catch (error) {
      console.error("Error fetching types", error)
      toast.error(tErrors("generic"))
    }
  }

  const fetchChartData = async () => {
    setIsChartLoading(true)
    try {
      const params: any = {}
      
      if (startDate && startTime) {
        params.startAt = new Date(`${startDate}T${startTime}:00`).toISOString()
      }
      
      if (endDate && endTime) {
        params.endAt = new Date(`${endDate}T${endTime}:59`).toISOString()
      }

      if (selectedTypeId && selectedTypeId !== "0") {
        params.productTypeId = selectedTypeId
      }

      const response = await api.get("/graficos", { params })
      
      if (response.data && response.data.products) {
        const formattedData = response.data.products.map((item: { name: string; quantitySold: number; totalRevenue: number | string }) => ({
          name: item.name,
          sales: Number(item.quantitySold) || 0,
          revenue: typeof item.totalRevenue === 'string' ? parseFloat(item.totalRevenue) : item.totalRevenue
        }))
        setChartData(formattedData)
      }

      if (response.data && response.data.closing) {
        setPeriodTotal(response.data.closing)
      }

    } catch (error) {
      console.error("Error fetching chart data", error)
      toast.error(tErrors("generic"))
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
        params.startAt = new Date(`${startDate}T${startTime}:00`).toISOString()
      }
      
      if (endDate && endTime) {
        params.endAt = new Date(`${endDate}T${endTime}:59`).toISOString()
      }

      if (selectedTypeId && selectedTypeId !== "0") {
        params.productTypeId = selectedTypeId
      }

      const response = await api.get("/graficos/lista", { params })
      
      let data: DetailedSalesRow[] = []
      let total = 0

      if (response.data.data) {
        data = response.data.data
        total = response.data.total || response.data.count || 0
      } else if (response.data.products) {
        data = response.data.products
        total = response.data.total || response.data.count || 0
      } else if (Array.isArray(response.data)) {
        data = response.data
        const totalHeader = response.headers['x-total-count']
        total = totalHeader ? parseInt(totalHeader, 10) : 0
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
      toast.error(tErrors("generic"))
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
        startAt: new Date(`${salesByHourStartDate}T00:00:00-03:00`).toISOString(),
        page: salesByHourPage
      }

      if (salesByHourEndDate) {
        params.endAt = new Date(`${salesByHourEndDate}T23:59:59-03:00`).toISOString()
      }

      const response = await api.get("/graficos/vendas-por-horario", { params })
      
      const rawData = (Array.isArray(response.data) ? response.data : []) as HourlySale[]
      setSalesByHourData(rawData)

      // Aggregate by hour (0-23)
      const hourCounts: { [hour: string]: { count: number, totalRevenue: number, sales: HourlySale[] } } = {}
      
      // Initialize all hours
      for (let h = 0; h < 24; h++) {
        const hourKey = String(h).padStart(2, '0') + ':00'
        hourCounts[hourKey] = { count: 0, totalRevenue: 0, sales: [] }
      }

      rawData.forEach((sale: any) => {
        const date = new Date(sale.soldAt)
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
          salesCount: data.count,
          revenue: data.totalRevenue,
          sales: data.sales
        }))

      setSalesByHourChartData(aggregatedData)
    } catch (error) {
      console.error("Error fetching sales by hour", error)
      toast.error(tErrors("generic"))
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
    return formatDate(startDateObj, activeLocale, { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })
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
    if (startDate && startTime) body.startAt = new Date(`${startDate}T${startTime}:00`).toISOString()
    if (endDate && endTime) body.endAt = new Date(`${endDate}T${endTime}:59`).toISOString()
    if (selectedTypeId && selectedTypeId !== "0") body.productTypeId = selectedTypeId
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
        link.download = filename || tCharts("report.filename")
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
    setReportError(tCharts("report.downloadFailed"))
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
            setReportError(tCharts("report.generationFailed"))
            reject(new Error(tCharts("report.generationFailed")))
          }
        } catch (err) {
          console.error('Error polling report status', err)
          if (attempts >= maxAttempts) {
            stopPolling()
            setReportGeneratingType(null)
            setReportError(tCharts("report.timeout"))
            reject(new Error(tCharts("report.timeout")))
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
      body.reportFormat = tipo
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
              setReportError(tCharts("report.readyWithoutUrl"))
            }
          } catch (err: any) {
            console.error('Polling failed', err)
            setReportGeneratingType(null)
            setReportError(tCharts("report.pollingFailed"))
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
          setReportError(tCharts("report.invalidResponse"))
        }
      } else {
        setReportGeneratingType(null)
        setReportError(tCharts("report.startFailed"))
      }
    } catch (err: any) {
      console.error('Error generating report', err)
      setReportGeneratingType(null)
      setReportError(tCharts("report.startFailed"))
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
      case "bar":
        return (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart layout="vertical" data={chartData} margin={{ top: 20, right: 30, left: 40, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                type="number"
                tickFormatter={(value) => formatChartValue(value, activeLocale, 'currency')}
              />
              <YAxis dataKey="name" type="category" width={100} />
              <Tooltip
                formatter={(value) => formatChartValue(value, activeLocale, 'currency')}
                contentStyle={tooltipStyle}
              />
              <Legend />
              <Bar dataKey="revenue" name={tCharts("revenue")} fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        )
      case "column":
        return (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis tickFormatter={(value) => formatChartValue(value, activeLocale)} />
              <Tooltip
                formatter={(value) => formatChartValue(value, activeLocale)}
                contentStyle={tooltipStyle}
              />
              <Legend />
              <Bar dataKey="sales" name={tCharts("sales")} fill="#82ca9d" />
            </BarChart>
          </ResponsiveContainer>
        )
      case "line":
        return (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis tickFormatter={(value) => formatChartValue(value, activeLocale)} />
              <Tooltip
                formatter={(value, name) => formatChartValue(
                  value,
                  activeLocale,
                  name === tCharts("revenue") ? 'currency' : 'number',
                )}
                contentStyle={tooltipStyle}
              />
              <Legend />
              <Line type="monotone" dataKey="revenue" name={tCharts("revenue")} stroke="#8884d8" activeDot={{ r: 8 }} />
              <Line type="monotone" dataKey="sales" name={tCharts("salesCount")} stroke="#82ca9d" />
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
                label={(entry: any) => tCharts("visualization.pieLabel", {
                  name: entry.name,
                  value: formatChartValue(entry.percent ?? 0, activeLocale, 'percent'),
                })}
                outerRadius={150}
                fill="#8884d8"
                dataKey="sales"
                nameKey="name"
              >
                {chartData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => formatChartValue(value, activeLocale)}
                contentStyle={tooltipStyle}
              />
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
          {user?.establishment?.tradeName
            ? tCharts("pageTitle", { establishment: user.establishment.tradeName })
            : tCharts("title")}
        </h1>
      </div>

      <Tabs defaultValue="products" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="products">{tCharts("tabs.products")}</TabsTrigger>
          <TabsTrigger value="hours">{tCharts("tabs.hours")}</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{tCharts("filters.title")}</CardTitle>
            </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="charts-start-date">{tCharts("filters.startDate")}</Label>
              <Input
                id="charts-start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="charts-start-time">{tCharts("filters.startTime")}</Label>
              <Input
                id="charts-start-time"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="charts-end-date">{tCharts("filters.endDate")}</Label>
              <Input
                id="charts-end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="charts-end-time">{tCharts("filters.endTime")}</Label>
              <Input
                id="charts-end-time"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label>{tCharts("filters.foodType")}</Label>
              <Select value={selectedTypeId} onValueChange={setSelectedTypeId} disabled={isLoading}>
                <SelectTrigger aria-label={tCharts("filters.foodType")}>
                  <SelectValue placeholder={tCharts("filters.select")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">{tCharts("filters.all")}</SelectItem>
                  {productTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id.toString()}>
                      {getCatalogLabel(type.id, type.description, activeLocale)}
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
                {tCharts("report.generateExcel")}
              </Button>
              <Button
                className="w-full md:w-auto"
                onClick={() => generateReport('pdf')}
                disabled={!!reportGeneratingType || isLoading || detailedData.length === 0}
              >
                {reportGeneratingType === 'pdf' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {tCharts("report.generatePdf")}
              </Button>
              <Button className="w-full md:w-auto" onClick={handleSearch} disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                {tCharts("filters.search")}
              </Button>
            </div>
            {reportGeneratingType && (
              <div className="mt-2 text-sm text-muted-foreground">
                {tCharts("report.generatingWithFormat", {
                  format: reportGeneratingType === "excel"
                    ? tCharts("report.format.excel")
                    : tCharts("report.format.pdf"),
                })} {reportStatusUrl ? (
                  <a
                    className="underline"
                    href={reportStatusUrl?.startsWith('http') ? reportStatusUrl : window.location.origin + (reportStatusUrl || '')}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={tCharts("report.viewStatus")}
                  >
                    {tCharts("report.viewStatus")}
                  </a>
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
          <CardTitle>{tCharts("visualization.title")}</CardTitle>
          <div className="w-[200px]">
            <Select value={chartType} onValueChange={(value: any) => setChartType(value)} disabled={isLoading}>
              <SelectTrigger aria-label={tCharts("visualization.title")}>
                <SelectValue placeholder={tCharts("visualization.select")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bar">{tCharts("visualization.revenue")}</SelectItem>
                <SelectItem value="column">{tCharts("visualization.salesCount")}</SelectItem>
                <SelectItem value="line">{tCharts("visualization.revenueAndSales")}</SelectItem>
                <SelectItem value="pie">{tCharts("visualization.salesPie")}</SelectItem>
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
                    <div className="text-sm font-medium text-muted-foreground">{tCharts("summary.totalRevenue")}</div>
                    <div className="text-2xl font-bold">
                      {formatCurrencyBRL(periodTotal.totalRevenue, activeLocale)}
                    </div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-sm font-medium text-muted-foreground">{tCharts("summary.totalSales")}</div>
                  <div className="text-2xl font-bold">
                    {formatCount(periodTotal.totalSales, recordCountMessages, activeLocale)}
                  </div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-sm font-medium text-muted-foreground">{tCharts("summary.unitsSold")}</div>
                  <div className="text-2xl font-bold">
                    {formatCount(periodTotal.totalUnitsSold, unitCountMessages, activeLocale)}
                  </div>
                  </div>
                </div>
              )}
              {chartData.length > 0 ? (
                renderChart()
              ) : (
                <div className="flex h-[400px] items-center justify-center text-muted-foreground">
                  {tCharts("empty.filtered")}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{tCharts("details.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <span className="sr-only" role="status">{isLoading ? tCommon("loading") : ""}</span>
          <div className="mb-4 text-sm text-muted-foreground">
            {tCharts("details.totalRecords", { count: formatNumber(totalItems, activeLocale) })}
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">{tCommon("index")}</TableHead>
                <TableHead>{tProducts("name")}</TableHead>
                <TableHead className="text-right">{tCharts("details.quantitySold")}</TableHead>
                <TableHead className="text-right">{tCharts("details.totalRevenue")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {showTableSkeleton ? (
                Array.from({ length: limit || 10 }).map((_, i) => (
                  <TableRow key={i} className="animate-in fade-in-0 duration-300">
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
              ) : detailedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                    {tCharts("empty.filtered")}
                  </TableCell>
                </TableRow>
              ) : (
                detailedData.map((item, index) => (
                  <TableRow key={item.id || index} className="animate-in fade-in-0 duration-300">
                    <TableCell>{formatNumber((page - 1) * limit + index + 1, activeLocale)}</TableCell>
                    <TableCell>{item.name}</TableCell>
                    <TableCell className="text-right">{formatNumber(item.quantitySold, activeLocale)}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrencyBRL(item.totalRevenue, activeLocale)}
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

        <TabsContent value="hours" className="space-y-6">
          {/* Filtros */}
          <Card>
            <CardHeader>
              <CardTitle>{tCharts("filters.title")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="charts-hourly-start-date">{tCharts("filters.startDate")}</Label>
                  <Input
                    id="charts-hourly-start-date"
                    type="date"
                    value={salesByHourStartDate}
                    onChange={(e) => setSalesByHourStartDate(e.target.value)}
                    disabled={isSalesByHourLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="charts-hourly-end-date">{tCharts("filters.endDate")}</Label>
                  <Input
                    id="charts-hourly-end-date"
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
                    {tCharts("filters.search")}
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
                {tCharts("hourly.title")}
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
                    <div className="text-sm font-medium text-muted-foreground">{tCharts("summary.totalSales")}</div>
                    <div className="text-2xl font-bold">
                      {formatCount(salesByHourData.length, recordCountMessages, activeLocale)}
                    </div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-sm font-medium text-muted-foreground">{tCharts("summary.dayRevenue")}</div>
                    <div className="text-2xl font-bold">
                      {formatCurrencyBRL(
                        salesByHourData.reduce((sum: number, sale: any) => sum + (parseFloat(sale.total) || 0), 0),
                        activeLocale,
                      )}
                    </div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-sm font-medium text-muted-foreground">{tCharts("summary.peakHour")}</div>
                    <div className="text-2xl font-bold">
                      {salesByHourChartData.reduce((max: any, curr: any) => {
                        if (!max) return curr
                        if (curr.salesCount > max.salesCount) return curr
                        if (curr.salesCount === max.salesCount && curr.revenue > max.revenue) return curr
                        return max
                      }, null)?.hour || tCommon("notInformed")}
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
                  aria-label={tCommon("previous")}
                  title={tCommon("previous")}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="text-center min-w-[250px]">
                  <div className="font-medium capitalize">{getCurrentSalesByHourDate()}</div>
                  <div className="text-sm text-muted-foreground">
                    {tCharts("dayOf", {
                      day: formatNumber(salesByHourPage + 1, activeLocale),
                      total: formatNumber(getSalesByHourMaxPage() + 1, activeLocale),
                    })}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setSalesByHourPage(Math.min(getSalesByHourMaxPage(), salesByHourPage + 1))}
                  disabled={salesByHourPage >= getSalesByHourMaxPage() || isSalesByHourLoading}
                  aria-label={tCommon("next")}
                  title={tCommon("next")}
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
                    <YAxis
                      allowDecimals={false}
                      tickFormatter={(value) => formatChartValue(value, activeLocale)}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload
                          return (
                            <div className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-lg border">
                              <p className="font-semibold mb-2">{label}</p>
                              <p className="text-sm">{tCharts("tooltip.label", { label: tCharts("tooltip.sales") })} <span className="font-medium">{formatCount(data.salesCount, recordCountMessages, activeLocale)}</span></p>
                              <p className="text-sm">{tCharts("tooltip.label", { label: tCharts("tooltip.revenue") })} <span className="font-medium">{formatCurrencyBRL(data.revenue, activeLocale)}</span></p>
                              {data.sales && data.sales.length > 0 && (
                                <div className="mt-2 pt-2 border-t max-h-[150px] overflow-y-auto">
                                  <p className="text-xs text-muted-foreground mb-1">{tCharts("tooltip.label", { label: tCharts("tooltip.details") })}</p>
                                  {data.sales.slice(0, 5).map((sale: any, idx: number) => (
                                    <div key={sale.id || idx} className="text-xs py-1 border-b last:border-b-0">
                                      <div className="flex justify-between">
                                        <span>{formatTime(sale.soldAt, activeLocale, { hour: '2-digit', minute: '2-digit' })}</span>
                                        <span className="font-medium">{formatCurrencyBRL(Number(sale.total), activeLocale)}</span>
                                      </div>
                                      {sale.customerName && <div className="text-muted-foreground">{sale.customerName}</div>}
                                    </div>
                                  ))}
                                  {data.sales.length > 5 && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {tCharts("tooltip.more", { count: formatNumber(data.sales.length - 5, activeLocale) })}
                                    </p>
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
                    <Bar dataKey="salesCount" name={tCharts("sales")} fill="#82ca9d" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[400px] items-center justify-center text-muted-foreground">
                  {salesByHourData.length === 0
                    ? tCharts("empty.noSalesForDay")
                    : tCharts("empty.selectPeriod")}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
