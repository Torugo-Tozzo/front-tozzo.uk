import { createSignal, For, Show } from "solid-js"
import { createMutation, createQuery, keepPreviousData, useQueryClient } from "@tanstack/solid-query"
import { Eye, Printer } from "lucide-solid"
import { toast } from "solid-sonner"

import { newRequestId } from "@/api/orders"
import { loadedData, onQueryError } from "@/api/query"
import { cancelSale, createSale, listSales, salesKeys, type Sale, type SaleFilters } from "@/api/sales"
import { FiltersBar } from "@/components/dashboard/FiltersBar"
import { Pagination } from "@/components/Pagination"
import { ProductSelectionModal, type ConfirmedItem } from "@/components/ProductSelectionModal"
import { printReceipt } from "@/components/receipt/printReceipt"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { IconButton } from "@/components/ui/icon-button"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useErrorMessage } from "@/i18n/error-message"
import { formatDateTime, formatNumber } from "@/i18n/format"
import { normalizeLocale } from "@/i18n/locale"
import { useTranslation } from "@/i18n/solid"
import { createCursorPages, totalPagesOf } from "@/lib/cursor-pages"
import { createMinLoading } from "@/lib/min-loading"
import { centsFromInput, formatCents } from "@/lib/money"

type DetailItem = { productId: string; quantity: number; unitPriceCents: number; name: string }

const pad = (value: number) => String(value).padStart(2, "0")
const formatDate = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
const formatTime = (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`

function formatItemsSummary(sale: Sale, locale: string, fallbackProduct: string, serviceLabel: string): string {
  const products = (sale.items ?? []).map((item) => `${formatNumber(item.quantity, locale)}x ${item.description || fallbackProduct}`)
  const services = (sale.serviceItems ?? []).map((item) => `${formatNumber(item.quantity, locale)}x ${item.description}${serviceLabel ? ` (${serviceLabel})` : ""}`)
  return [...products, ...services].join(", ")
}

interface SaleFilterInput {
  customerName: string
  createdBy: string
  totalMin: string
  totalMax: string
  startDate: string
  startTime: string
  endDate: string
  endTime: string
}

// The period (local date and time) becomes the from/to instants of the /v1,
// as the React app sent startAt/endAt; the end minute is inclusive (:59).
function toSaleFilters(input: SaleFilterInput): SaleFilters {
  return {
    customerName: input.customerName || undefined,
    // The /v1 filters by the seller's id (exact), as the Bun did with this
    // field: there is no filter by the seller's name (gap of the /v1, plan S4).
    sellerId: input.createdBy || undefined,
    minTotalCents: input.totalMin ? centsFromInput(input.totalMin) : undefined,
    maxTotalCents: input.totalMax ? centsFromInput(input.totalMax) : undefined,
    from: input.startDate && input.startTime ? new Date(`${input.startDate}T${input.startTime}:00`).toISOString() : undefined,
    to: input.endDate && input.endTime ? new Date(`${input.endDate}T${input.endTime}:59`).toISOString() : undefined,
  }
}

export function VendasTab() {
  const { t: tCommon, language } = useTranslation("common")
  const { t: tPrinter } = useTranslation("printer")
  const { t: tSales } = useTranslation("sales")
  const { t: tDeliveries } = useTranslation("deliveries")
  const localizedError = useErrorMessage()
  const activeLocale = () => normalizeLocale(language())
  const queryClient = useQueryClient()

  const now = new Date()
  const ago24 = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const [startDate, setStartDate] = createSignal(formatDate(ago24))
  const [startTime, setStartTime] = createSignal(formatTime(ago24))
  const [endDate, setEndDate] = createSignal(formatDate(now))
  const [endTime, setEndTime] = createSignal(formatTime(now))
  const [customerName, setCustomerName] = createSignal("")
  const [createdBy, setCreatedBy] = createSignal("")
  const [totalMin, setTotalMin] = createSignal("")
  const [totalMax, setTotalMax] = createSignal("")
  const currentInput = (): SaleFilterInput => ({
    customerName: customerName(), createdBy: createdBy(), totalMin: totalMin(), totalMax: totalMax(),
    startDate: startDate(), startTime: startTime(), endDate: endDate(), endTime: endTime(),
  })
  const [applied, setApplied] = createSignal<SaleFilters>(toSaleFilters(currentInput()))
  const pages = createCursorPages(10)

  const [isModalOpen, setIsModalOpen] = createSignal(false)
  const [isReadOnlyModal, setIsReadOnlyModal] = createSignal(false)
  const [currentSale, setCurrentSale] = createSignal<Sale | null>(null)
  const [createId, setCreateId] = createSignal(newRequestId())

  const sales = createQuery(() => ({
    queryKey: [...salesKeys.all, "list", { ...applied(), cursor: pages.cursor(), limit: pages.limit() }],
    queryFn: ({ signal }) => listSales({ ...applied(), cursor: pages.cursor(), limit: pages.limit() }, signal),
    placeholderData: keepPreviousData,
    // Realtime (sale.changed) is the main path; this covers a silent stream.
    refetchInterval: 60_000,
  }))
  onQueryError(sales, (error) => {
    console.error("Error fetching sales", error)
    toast.error(localizedError("loadSales", error))
  })

  const create = createMutation(() => ({
    mutationFn: (input: { customerName: string; items: ConfirmedItem[] }) => createSale({
      id: createId(),
      ...(input.customerName ? { customerName: input.customerName } : {}),
      items: input.items.map(({ productId, quantity }) => ({ productId, quantity })),
    }),
    onSuccess: () => {
      setCreateId(newRequestId())
      void invalidateSales()
    },
    onError: (error) => {
      console.error("Error creating sale", error)
      toast.error(localizedError("createSale", error))
    },
  }))

  const isLoading = () => sales.isPending || sales.isPlaceholderData || create.isPending
  const showSkeleton = createMinLoading(isLoading)
  const page = () => (sales.isError ? undefined : loadedData(sales))
  const rows = () => page()?.items ?? []
  const totalItems = () => page()?.total ?? 0
  const periodTotalCents = () => page()?.summary.totalCents ?? 0
  const totalPages = () => totalPagesOf(totalItems(), pages.limit())

  const invalidateSales = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: salesKeys.all }),
    queryClient.invalidateQueries({ queryKey: salesKeys.reports }),
  ])

  const paymentLabel = (sale: Sale) => (sale.paymentMethod ? tDeliveries(`payment.${sale.paymentMethod}` as never) : tCommon("notInformed"))

  const handleApplyFilters = () => {
    const next = toSaleFilters(currentInput())
    if (JSON.stringify(next) === JSON.stringify(applied()) && pages.page() === 1) {
      void sales.refetch()
      return
    }
    setApplied(next)
    pages.reset()
  }

  const handleModalConfirm = async (name: string, items: ConfirmedItem[]) => {
    // A failure rejects: the modal stays open with the items picked.
    await create.mutateAsync({ customerName: name, items })
    setIsModalOpen(false)
  }

  const handleInfoClick = (sale: Sale) => {
    setCurrentSale(sale)
    setIsReadOnlyModal(true)
    setIsModalOpen(true)
  }

  const handleNewSaleClick = () => {
    setCurrentSale(null)
    setIsReadOnlyModal(false)
    setIsModalOpen(true)
  }

  // The modal confirms, reports a failure (toast) and blocks a second click.
  const handleCancelSale = async (id: string) => {
    await cancelSale(id)
    await invalidateSales()
    setIsModalOpen(false)
    setCurrentSale(null)
  }

  const detailItems = (): DetailItem[] => (currentSale()?.items ?? []).map((item) => ({
    productId: item.productId,
    quantity: item.quantity,
    name: item.description,
    unitPriceCents: item.unitPriceCents,
  }))
  const detailDescription = () => (currentSale()?.serviceItems ?? []).map((item) => `${formatNumber(item.quantity, activeLocale())}x ${item.description}`).join(", ")

  const handlePrint = (sale: Sale) => {
    printReceipt({
      title: tPrinter("receiptTitleSale", { id: sale.id }),
      customerName: sale.customerName?.trim() || tCommon("notInformed"),
      dateLabel: sale.soldAt ? formatDateTime(sale.soldAt, activeLocale()) : tCommon("notInformed"),
      items: [
        ...(sale.items ?? []).map((item) => ({ name: item.description || tSales("fallback.product"), quantity: item.quantity, unitPriceCents: item.unitPriceCents })),
        ...(sale.serviceItems ?? []).map((item) => ({ name: item.description, quantity: item.quantity, unitPriceCents: item.unitPriceCents })),
      ],
      totalCents: sale.totalCents,
      totalLabel: tPrinter("receiptTotal"),
      paymentLabel: tPrinter("receiptPayment", { method: paymentLabel(sale) }),
      locale: activeLocale(),
    })
  }

  return (
    <div class="space-y-4">
      <FiltersBar
        dateRange={{
          startDate: startDate(), startTime: startTime(), endDate: endDate(), endTime: endTime(),
          onStartDateChange: setStartDate,
          onStartTimeChange: setStartTime,
          onEndDateChange: setEndDate,
          onEndTimeChange: setEndTime,
        }}
        customerName={{ value: customerName(), onChange: setCustomerName }}
        createdBy={{ value: createdBy(), onChange: setCreatedBy }}
        totalRange={{ min: totalMin(), max: totalMax(), onMinChange: setTotalMin, onMaxChange: setTotalMax }}
        primaryAction={{ label: tSales("new"), onClick: handleNewSaleClick }}
        onFilter={handleApplyFilters}
        isLoading={isLoading()}
      />

      <ProductSelectionModal
        isOpen={isModalOpen()}
        onClose={() => { setIsModalOpen(false); setCurrentSale(null); setIsReadOnlyModal(false) }}
        onConfirm={handleModalConfirm}
        title={isReadOnlyModal() ? tSales("details") : tSales("new")}
        initialClientName={currentSale()?.customerName ?? ""}
        description={detailDescription() || undefined}
        initialItems={detailItems()}
        additionalReadOnlyItems={(currentSale()?.serviceItems ?? []).map((item) => ({ description: item.description, quantity: item.quantity, unitPriceCents: item.unitPriceCents }))}
        mergeSameProducts
        readOnly={isReadOnlyModal()}
        onCancelSale={isReadOnlyModal() && currentSale() ? () => handleCancelSale(currentSale()!.id) : undefined}
      />

      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle>{tSales("period")}</CardTitle>
            <div class="text-sm text-muted-foreground mt-1">
              {tSales("table.totalRecords", { count: formatNumber(totalItems(), activeLocale()) })}
            </div>
          </div>
          <div class="flex flex-col items-end">
            <span class="text-sm text-muted-foreground">{tSales("closingPeriod")}</span>
            <span class="text-2xl font-bold text-green-600">
              {formatCents(periodTotalCents(), activeLocale())}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <span class="sr-only" role="status">{showSkeleton() ? tCommon("loading") : ""}</span>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead class="w-[50px] text-center">{tCommon("index")}</TableHead>
                <TableHead>{tCommon("customer")}</TableHead>
                <TableHead>{tCommon("createdBy")}</TableHead>
                <TableHead>{tCommon("date")}</TableHead>
                <TableHead>{tSales("table.payment")}</TableHead>
                <TableHead class="text-right">{tCommon("total")}</TableHead>
                <TableHead class="text-right">{tCommon("actions.label")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <Show
                when={!showSkeleton()}
                fallback={
                  <For each={[0, 1, 2, 3, 4]}>
                    {() => (
                      <TableRow class="animate-in fade-in-0 duration-300">
                        <TableCell><Skeleton class="h-4 w-8" /></TableCell>
                        <TableCell><Skeleton class="h-4 w-[200px]" /></TableCell>
                        <TableCell><Skeleton class="h-4 w-[100px]" /></TableCell>
                        <TableCell><Skeleton class="h-4 w-[150px]" /></TableCell>
                        <TableCell class="text-right justify-end flex"><Skeleton class="h-4 w-16" /></TableCell>
                        <TableCell class="text-right justify-end flex gap-2">
                          <Skeleton class="h-8 w-8" />
                          <Skeleton class="h-8 w-8" />
                        </TableCell>
                      </TableRow>
                    )}
                  </For>
                }
              >
                <Show
                  when={rows().length > 0}
                  fallback={
                    <TableRow>
                      <TableCell colSpan={7} class="text-center text-muted-foreground py-8">
                        {tSales("empty")}
                      </TableCell>
                    </TableRow>
                  }
                >
                  <For each={rows()}>
                    {(sale, index) => {
                      const summary = () => formatItemsSummary(sale, activeLocale(), tSales("fallback.product"), tSales("serviceLine"))
                      return (
                        <TableRow class="animate-in fade-in-0 duration-300">
                          <TableCell class="text-center">{formatNumber((pages.page() - 1) * pages.limit() + index() + 1, activeLocale())}</TableCell>
                          <TableCell>
                            <div class="font-medium">{sale.customerName || tCommon("notInformed")}</div>
                            <Show when={summary()}>
                              <div class="text-sm text-muted-foreground truncate max-w-[280px]" title={summary()}>
                                {summary()}
                              </div>
                            </Show>
                          </TableCell>
                          <TableCell class="text-muted-foreground">{sale.seller?.name || tCommon("notInformed")}</TableCell>
                          <TableCell>{sale.soldAt ? formatDateTime(sale.soldAt, activeLocale()) : tCommon("notInformed")}</TableCell>
                          <TableCell>{paymentLabel(sale)}</TableCell>
                          <TableCell class="text-right">{formatCents(sale.totalCents, activeLocale())}</TableCell>
                          <TableCell class="text-right">
                            <div class="flex justify-end gap-2">
                              <IconButton icon={<Printer class="h-4 w-4" />} label={tPrinter("printSale")} onClick={() => handlePrint(sale)} />
                              <IconButton icon={<Eye class="h-4 w-4" />} label={tSales("viewDetails")} onClick={() => handleInfoClick(sale)} />
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    }}
                  </For>
                </Show>
              </Show>
            </TableBody>
          </Table>
          <Pagination
            currentPage={pages.page()}
            totalPages={totalPages()}
            hasMore={!!page()?.nextCursor}
            onPageChange={(target) => pages.goTo(target, page()?.nextCursor)}
            pageSize={pages.limit()}
            onPageSizeChange={pages.setLimit}
            isLoading={isLoading()}
          />
        </CardContent>
      </Card>
    </div>
  )
}
