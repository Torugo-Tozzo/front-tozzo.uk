import { batch, createMemo, createSignal, Show } from 'solid-js'
import { Navigate } from '@solidjs/router'
import { createQuery, useQueryClient } from '@tanstack/solid-query'
import { toast } from 'solid-sonner'
import { BarChart3, Search, Loader2, ChevronLeft, ChevronRight, Clock } from 'lucide-solid'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Pagination } from '@/components/Pagination'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { PaywallBanner, type PaywallCode } from '@/components/dashboard/PaywallBanner'
import ReportChart from '@/components/reports/ReportChart'
import { createReportExportController } from '@/components/reports/create-report-export'
import { useTranslation } from '@/i18n/solid'
import { normalizeLocale } from '@/i18n/locale'
import { formatCount, formatDate, formatNumber, type PluralMessages } from '@/i18n/format'
import { getCatalogLabel } from '@/i18n/labels'
import { formatCents as formatCurrencyBRL } from '@/lib/money'
import { createCursorPages, totalPagesOf } from '@/lib/cursor-pages'
import { localDate, reportDay, reportDays, reportFilters } from '@/lib/report-filters'
import { apiErrorOf } from '@/api/errors'
import { catalogKeys, listProductTypes } from '@/api/catalog'
import { loadedData, onQueryError } from '@/api/query'
import { getTopProducts, listProductReport, getSalesByHour, reportKeys } from '@/api/reports'

export default function ChartsPage() {
  const { user } = useAuth()
  return <Show when={user()?.role !== 'EMPLOYEE'} fallback={<Navigate href="/dashboard" />}><ChartsContent /></Show>
}
function ChartsContent() {
  const { user } = useAuth()
  const { t: tCharts, language } = useTranslation('charts')
  const { t: tCommon } = useTranslation('common')
  const { t: tProducts } = useTranslation('products')
  const { t: tErrors } = useTranslation('errors')
  const activeLocale = () => normalizeLocale(language())
  const recordCountMessages = (): PluralMessages => ({
    zero: tCommon('recordCount.zero'), one: tCommon('recordCount.one'), two: tCommon('recordCount.two'),
    few: tCommon('recordCount.few'), many: tCommon('recordCount.many'), other: tCommon('recordCount.other'),
  })
  const unitCountMessages = (): PluralMessages => ({
    zero: tCommon('unitCount.zero'), one: tCommon('unitCount.one'), two: tCommon('unitCount.two'),
    few: tCommon('unitCount.few'), many: tCommon('unitCount.many'), other: tCommon('unitCount.other'),
  })
  const client = useQueryClient()
  const today = localDate()
  const [startDate, setStartDate] = createSignal(today)
  const [endDate, setEndDate] = createSignal(today)
  const [startTime, setStartTime] = createSignal('00:00')
  const [endTime, setEndTime] = createSignal('23:59')
  const [selectedTypeId, setSelectedTypeId] = createSignal('0')
  const [chartType, setChartType] = createSignal<'bar' | 'column' | 'line' | 'pie'>('bar')
  const draftFilters = () => reportFilters(startDate(), startTime(), endDate(), endTime(), selectedTypeId())
  const [filters, setFilters] = createSignal(draftFilters())
  const pages = createCursorPages(10)
  const page = pages.page, limit = pages.limit
  const setPage = (target: number) => pages.goTo(target, loadedData(details)?.nextCursor)
  const setLimit = pages.setLimit
  const types = createQuery(() => ({ queryKey: catalogKeys.productTypes, queryFn: ({ signal }) => listProductTypes({}, signal) }))
  const top = createQuery(() => ({ queryKey: [...reportKeys.all, 'top', filters()], queryFn: ({ signal }) => getTopProducts(filters(), signal) }))
  const details = createQuery(() => ({ queryKey: [...reportKeys.all, 'products', filters(), pages.cursor(), limit()], queryFn: ({ signal }) => listProductReport({ ...filters(), cursor: pages.cursor(), limit: limit() }, signal) }))
  const topData = () => top.isError ? undefined : loadedData(top)
  const chartData = () => topData()?.products ?? []
  const periodTotal = () => {
    const totals = topData()?.totals
    return totals ? { totalRevenue: totals.revenueCents, totalSales: totals.salesCount, totalUnitsSold: totals.units } : null
  }
  const detailedData = () => (details.isError ? [] : loadedData(details)?.items ?? []).map(row => ({ ...row, quantitySold: row.quantity, totalRevenue: row.revenueCents }))
  const totalItems = () => details.isError ? 0 : loadedData(details)?.total ?? 0
  const totalPages = () => totalPagesOf(totalItems(), limit())
  const hasMore = () => !details.isError && Boolean(loadedData(details)?.nextCursor)
  const isChartLoading = () => top.isFetching
  const isTableLoading = () => details.isFetching
  const isLoading = () => isChartLoading() || isTableLoading()
  const showTableSkeleton = isTableLoading
  const typeOptions = () => [{ id: '0', label: tCharts('filters.all') }, ...(loadedData(types) ?? []).map(type => ({ id: type.id, label: getCatalogLabel(type.id, type.description, activeLocale()) }))]
  const chartOptions = () => ([['bar', 'revenue'], ['column', 'salesCount'], ['line', 'revenueAndSales'], ['pie', 'salesPie']] as const).map(([id, key]) => ({ id, label: tCharts(`visualization.${key}`) }))
  const handleSearch = () => {
    try { const next = draftFilters(); batch(() => { pages.reset(); setFilters(next) }); void client.invalidateQueries({ queryKey: [...reportKeys.all, 'top'] }); void client.invalidateQueries({ queryKey: [...reportKeys.all, 'products'] }) }
    catch { toast.error(tErrors('generic')) }
  }
  const [salesByHourStartDate, setSalesByHourStartDate] = createSignal(today)
  const [salesByHourEndDate, setSalesByHourEndDate] = createSignal(today)
  const [hourRange, setHourRange] = createSignal({ start: today, end: today })
  const [salesByHourPage, setSalesByHourPage] = createSignal(0)
  const hourDate = () => reportDay(hourRange().start, salesByHourPage())
  const hours = createQuery(() => ({ queryKey: [...reportKeys.all, 'hours', hourDate()], queryFn: ({ signal }) => getSalesByHour({ date: hourDate(), tzOffsetMinutes: '-180' }, signal) }))
  const hourData = () => hours.isError ? undefined : loadedData(hours)
  const salesByHourData = () => (hourData()?.sales ?? []).map(sale => ({ ...sale, total: sale.totalCents }))
  const salesByHourChartData = () => (hourData()?.hours ?? []).map(row => ({ hour: `${String(row.hour).padStart(2, '0')}:00`, salesCount: row.salesCount, revenue: row.revenueCents }))
  const isSalesByHourLoading = () => hours.isFetching
  const getCurrentSalesByHourDate = () => formatDate(`${hourDate()}T12:00:00`, activeLocale(), { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })
  const getSalesByHourMaxPage = () => reportDays(hourRange().start, hourRange().end)
  const handleSalesByHourSearch = () => {
    if (!salesByHourStartDate() || !salesByHourEndDate()) return
    batch(() => { setSalesByHourPage(0); setHourRange({ start: salesByHourStartDate(), end: salesByHourEndDate() }) })
    void client.invalidateQueries({ queryKey: [...reportKeys.all, 'hours'] })
  }
  const report = createReportExportController(client)
  const reportGeneratingType = () => report.format() === 'xlsx' ? 'excel' : report.format()
  const reportError = () => {
    if (!report.error()) return null
    const code = apiErrorOf(report.failure()).code
    if (code === 'PLAN_UPGRADE_REQUIRED') return tErrors('planUpgradeRequired')
    if (code === 'REPORT_QUOTA_EXCEEDED') return tErrors('reportQuotaExceeded')
    if (code === 'NOT_READY') return tCharts('report.unavailable')
    return tCharts(`report.${report.error()!}`)
  }
  const generateReport = (format: 'excel' | 'pdf') => {
    try { report.start({ ...draftFilters(), format: format === 'excel' ? 'xlsx' : 'pdf', locale: activeLocale(), tzOffsetMinutes: -180 }) }
    catch { toast.error(tErrors('generic')) }
  }
  const paywallCode = createMemo<PaywallCode | null>(() => {
    for (const query of [top, details, hours]) {
      if (!query.isError) continue
      const code = apiErrorOf(query.error).code
      if (code === 'PLAN_UPGRADE_REQUIRED' || code === 'REPORT_QUOTA_EXCEEDED') return code
    }
    return null
  })
  for (const query of [top, details, hours, types]) onQueryError(query, error => {
    if (!['PLAN_UPGRADE_REQUIRED', 'REPORT_QUOTA_EXCEEDED'].includes(apiErrorOf(error).code)) toast.error(tErrors('generic'))
  })
  return (
    <div class="space-y-6">
      {paywallCode() && <PaywallBanner code={paywallCode()!} role={user()?.role} />}
      <Tabs defaultValue="products" class="w-full space-y-6">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <h1 class="text-3xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 class="h-8 w-8" />
            {user()?.establishment?.tradeName
              ? tCharts("pageTitle", { establishment: user()?.establishment?.tradeName })
              : tCharts("title")}
          </h1>
          {!paywallCode() && (
            <TabsList class="ml-auto">
              <TabsTrigger value="products">{tCharts("tabs.products")}</TabsTrigger>
              <TabsTrigger value="hours">{tCharts("tabs.hours")}</TabsTrigger>
            </TabsList>
          )}
        </div>
        {!paywallCode() && <>
        <TabsContent value="products" class="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{tCharts("filters.title")}</CardTitle>
            </CardHeader>
        <CardContent>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div class="space-y-2">
              <Label for="charts-start-date">{tCharts("filters.startDate")}</Label>
              <Input
                id="charts-start-date"
                type="date"
                value={startDate()}
                onInput={(e) => setStartDate(e.currentTarget.value)}
                disabled={isLoading()}
              />
            </div>
            <div class="space-y-2">
              <Label for="charts-start-time">{tCharts("filters.startTime")}</Label>
              <Input
                id="charts-start-time"
                type="time"
                value={startTime()}
                onInput={(e) => setStartTime(e.currentTarget.value)}
                disabled={isLoading()}
              />
            </div>
            <div class="space-y-2">
              <Label for="charts-end-date">{tCharts("filters.endDate")}</Label>
              <Input
                id="charts-end-date"
                type="date"
                value={endDate()}
                onInput={(e) => setEndDate(e.currentTarget.value)}
                disabled={isLoading()}
              />
            </div>
            <div class="space-y-2">
              <Label for="charts-end-time">{tCharts("filters.endTime")}</Label>
              <Input
                id="charts-end-time"
                type="time"
                value={endTime()}
                onInput={(e) => setEndTime(e.currentTarget.value)}
                disabled={isLoading()}
              />
            </div>
            <div class="space-y-2">
              <Label>{tCharts("filters.foodType")}</Label>
              <Select options={typeOptions()} optionValue="id" optionTextValue="label" value={typeOptions().find(option => option.id === selectedTypeId())} onChange={option => setSelectedTypeId(option?.id ?? '0')} disabled={isLoading()} itemComponent={props => <SelectItem item={props.item}>{props.item.rawValue.label}</SelectItem>}>
                <SelectTrigger aria-label={tCharts("filters.foodType")}><SelectValue<{ id: string; label: string }>>{state => state.selectedOption()?.label ?? tCharts("filters.select")}</SelectValue></SelectTrigger>
                <SelectContent />
              </Select>
            </div>
          </div>
          <div class="mt-4 flex flex-col items-end">
            <div class="flex gap-2 w-full md:w-auto justify-end">
              <Button
                class="w-full md:w-auto"
                onClick={() => generateReport('excel')}
                disabled={!!reportGeneratingType() || isLoading() || detailedData().length === 0}
              >
                {reportGeneratingType() === 'excel' ? <Loader2 class="mr-2 h-4 w-4 animate-spin" /> : null}
                {tCharts("report.generateExcel")}
              </Button>
              <Button
                class="w-full md:w-auto"
                onClick={() => generateReport('pdf')}
                disabled={!!reportGeneratingType() || isLoading() || detailedData().length === 0}
              >
                {reportGeneratingType() === 'pdf' ? <Loader2 class="mr-2 h-4 w-4 animate-spin" /> : null}
                {tCharts("report.generatePdf")}
              </Button>
              <Button class="w-full md:w-auto" onClick={handleSearch} disabled={isLoading()}>
                {isLoading() ? <Loader2 class="mr-2 h-4 w-4 animate-spin" /> : <Search class="mr-2 h-4 w-4" />}
                {tCharts("filters.search")}
              </Button>
            </div>
            {reportGeneratingType() && (
              <div class="mt-2 text-sm text-muted-foreground">
                {tCharts("report.generatingWithFormat", {
                  format: reportGeneratingType() === "excel"
                    ? tCharts("report.format.excel")
                    : tCharts("report.format.pdf"),
                })}
              </div>
            )}
            {/* download link and task id hidden — download is automatic */}
            {reportError() && (
              <div role="alert" class="mt-2 text-sm text-red-600">{reportError()}</div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card class="min-h-[500px]">
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle>{tCharts("visualization.title")}</CardTitle>
          <div class="w-[200px]">
            <Select options={chartOptions()} optionValue="id" optionTextValue="label" value={chartOptions().find(option => option.id === chartType())} onChange={option => { if (option) setChartType(option.id) }} disabled={isLoading()} itemComponent={props => <SelectItem item={props.item}>{props.item.rawValue.label}</SelectItem>}>
              <SelectTrigger aria-label={tCharts("visualization.title")}><SelectValue<{ id: string; label: string }>>{state => state.selectedOption()?.label}</SelectValue></SelectTrigger>
              <SelectContent />
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isChartLoading() ? (
            <div class="space-y-4">
              <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
                 <Skeleton class="h-20 rounded-lg" />
                 <Skeleton class="h-20 rounded-lg" />
                 <Skeleton class="h-20 rounded-lg" />
              </div>
              <Skeleton class="h-[400px] w-full rounded-lg" />
            </div>
          ) : (
            <>
              {periodTotal() && (
                <div class="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div class="rounded-lg border p-3">
                    <div class="text-sm font-medium text-muted-foreground">{tCharts("summary.totalRevenue")}</div>
                    <div class="text-2xl font-bold">
                      {formatCurrencyBRL(periodTotal()!.totalRevenue, activeLocale())}
                    </div>
                  </div>
                  <div class="rounded-lg border p-3">
                    <div class="text-sm font-medium text-muted-foreground">{tCharts("summary.totalSales")}</div>
                  <div class="text-2xl font-bold">
                    {formatCount(periodTotal()!.totalSales, recordCountMessages(), activeLocale())}
                  </div>
                  </div>
                  <div class="rounded-lg border p-3">
                    <div class="text-sm font-medium text-muted-foreground">{tCharts("summary.unitsSold")}</div>
                  <div class="text-2xl font-bold">
                    {formatCount(periodTotal()!.totalUnitsSold, unitCountMessages(), activeLocale())}
                  </div>
                  </div>
                </div>
              )}
              {chartData().length > 0 ? (
                <ReportChart kind={chartType()} top={topData()} label={tCharts("visualization.title")} />
              ) : (
                <div class="flex h-[400px] items-center justify-center text-muted-foreground">
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
          <span class="sr-only" role="status">{isLoading() ? tCommon("loading") : ""}</span>
          <div class="mb-4 text-sm text-muted-foreground">
            {tCharts("details.totalRecords", { count: formatNumber(totalItems(), activeLocale()) })}
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead class="w-[50px]">{tCommon("index")}</TableHead>
                <TableHead>{tProducts("name")}</TableHead>
                <TableHead class="text-right">{tCharts("details.quantitySold")}</TableHead>
                <TableHead class="text-right">{tCharts("details.totalRevenue")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {showTableSkeleton() ? (
                Array.from({ length: limit() || 10 }).map(() => (
                  <TableRow class="animate-in fade-in-0 duration-300">
                    <TableCell>
                      <Skeleton class="h-4 w-8" />
                    </TableCell>
                    <TableCell>
                      <Skeleton class="h-4 w-[200px]" />
                    </TableCell>
                    <TableCell class="text-right">
                      <Skeleton class="h-4 w-12 ml-auto" />
                    </TableCell>
                    <TableCell class="text-right">
                      <Skeleton class="h-4 w-24 ml-auto" />
                    </TableCell>
                  </TableRow>
                ))
              ) : detailedData().length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} class="py-8 text-center text-muted-foreground">
                    {tCharts("empty.filtered")}
                  </TableCell>
                </TableRow>
              ) : (
                detailedData().map((item, index) => (
                  <TableRow class="animate-in fade-in-0 duration-300">
                    <TableCell>{formatNumber((page() - 1) * limit() + index + 1, activeLocale())}</TableCell>
                    <TableCell>{item.name}</TableCell>
                    <TableCell class="text-right">{formatNumber(item.quantitySold, activeLocale())}</TableCell>
                    <TableCell class="text-right">
                      {formatCurrencyBRL(item.totalRevenue, activeLocale())}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <Pagination
            currentPage={page()}
            totalPages={totalPages()}
            hasMore={hasMore()}
            onPageChange={setPage}
            pageSize={limit()}
            onPageSizeChange={(newLimit) => {
              setLimit(newLimit)
              setPage(1)
            }}
            isLoading={isTableLoading()}
          />
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="hours" class="space-y-6">
          {/* Filtros */}
          <Card>
            <CardHeader>
              <CardTitle>{tCharts("filters.title")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="space-y-2">
                  <Label for="charts-hourly-start-date">{tCharts("filters.startDate")}</Label>
                  <Input
                    id="charts-hourly-start-date"
                    type="date"
                    value={salesByHourStartDate()}
                    onInput={(e) => setSalesByHourStartDate(e.currentTarget.value)}
                    disabled={isSalesByHourLoading()}
                  />
                </div>
                <div class="space-y-2">
                  <Label for="charts-hourly-end-date">{tCharts("filters.endDate")}</Label>
                  <Input
                    id="charts-hourly-end-date"
                    type="date"
                    value={salesByHourEndDate()}
                    onInput={(e) => setSalesByHourEndDate(e.currentTarget.value)}
                    disabled={isSalesByHourLoading()}
                  />
                </div>
                <div class="flex items-end">
                  <Button 
                    class="w-full" 
                    onClick={handleSalesByHourSearch} 
                    disabled={isSalesByHourLoading()}
                  >
                    {isSalesByHourLoading() ? <Loader2 class="mr-2 h-4 w-4 animate-spin" /> : <Search class="mr-2 h-4 w-4" />}
                    {tCharts("filters.search")}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Chart */}
          <Card class="min-h-[500px]">
            <CardHeader>
              <CardTitle class="flex items-center gap-2">
                <Clock class="h-5 w-5" />
                {tCharts("hourly.title")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Summary cards */}
              {isSalesByHourLoading() ? (
                <div class="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                  <Skeleton class="h-20 rounded-lg" />
                  <Skeleton class="h-20 rounded-lg" />
                  <Skeleton class="h-20 rounded-lg" />
                </div>
              ) : salesByHourData().length > 0 && (
                <div class="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div class="rounded-lg border p-3">
                    <div class="text-sm font-medium text-muted-foreground">{tCharts("summary.totalSales")}</div>
                    <div class="text-2xl font-bold">
                      {formatCount(salesByHourData().length, recordCountMessages(), activeLocale())}
                    </div>
                  </div>
                  <div class="rounded-lg border p-3">
                    <div class="text-sm font-medium text-muted-foreground">{tCharts("summary.dayRevenue")}</div>
                    <div class="text-2xl font-bold">
                      {formatCurrencyBRL(
                        salesByHourData().reduce((sum, sale) => sum + sale.total, 0),
                        activeLocale(),
                      )}
                    </div>
                  </div>
                  <div class="rounded-lg border p-3">
                    <div class="text-sm font-medium text-muted-foreground">{tCharts("summary.peakHour")}</div>
                    <div class="text-2xl font-bold">
                      {salesByHourChartData().reduce((max, curr) => {
                        if (!max) return curr
                        if (curr.salesCount > max.salesCount) return curr
                        if (curr.salesCount === max.salesCount && curr.revenue > max.revenue) return curr
                        return max
                      }, salesByHourChartData()[0])?.hour || tCommon("notInformed")}
                    </div>
                  </div>
                </div>
              )}

              {/* Day navigation */}
              <div class="flex items-center justify-center gap-4 mb-4">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setSalesByHourPage(Math.max(0, salesByHourPage() - 1))}
                  disabled={salesByHourPage() === 0 || isSalesByHourLoading()}
                  aria-label={tCommon("previous")}
                  title={tCommon("previous")}
                >
                  <ChevronLeft class="h-4 w-4" />
                </Button>
                <div class="text-center min-w-[250px]">
                  <div class="font-medium capitalize">{getCurrentSalesByHourDate()}</div>
                  <div class="text-sm text-muted-foreground">
                    {tCharts("dayOf", {
                      day: formatNumber(salesByHourPage() + 1, activeLocale()),
                      total: formatNumber(getSalesByHourMaxPage() + 1, activeLocale()),
                    })}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setSalesByHourPage(Math.min(getSalesByHourMaxPage(), salesByHourPage() + 1))}
                  disabled={salesByHourPage() >= getSalesByHourMaxPage() || isSalesByHourLoading()}
                  aria-label={tCommon("next")}
                  title={tCommon("next")}
                >
                  <ChevronRight class="h-4 w-4" />
                </Button>
              </div>

              {isSalesByHourLoading() ? (
                <Skeleton class="h-[400px] w-full rounded-lg" />
              ) : salesByHourChartData().length > 0 ? (
<ReportChart kind="hours" hourly={hourData()} label={tCharts("hourly.title")} />
              ) : (
                <div class="flex h-[400px] items-center justify-center text-muted-foreground">
                  {salesByHourData().length === 0
                    ? tCharts("empty.noSalesForDay")
                    : tCharts("empty.selectPeriod")}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        </>}
      </Tabs>
    </div>
  )
}
