import { batch, createMemo, createSignal, For, Show } from "solid-js"
import { createMutation, createQuery, keepPreviousData, useQueryClient } from "@tanstack/solid-query"
import { Eye, Printer } from "lucide-solid"
import { toast } from "solid-sonner"

import { loadedData, onQueryError } from "@/api/query"
import { cancelSale, createSale, listSales, saleKeys, type Sale, type SalePage, type SaleQuery } from "@/api/sales"
import { FiltersBar } from "@/components/dashboard/FiltersBar"
import { Pagination } from "@/components/Pagination"
import { ProductSelectionModal, type ConfirmedItem, type PaymentMethod, type ProductSelectionModalProps } from "@/components/ProductSelectionModal"
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

type SaleFilters = {
  customerName: string
  createdBy: string
  totalMin: string
  totalMax: string
  startDate: string
  startTime: string
  endDate: string
  endTime: string
  /** The end date or time was edited: until then the period is open-ended. */
  endEdited: boolean
}

const sameFilters = (a: SaleFilters, b: SaleFilters) =>
  (Object.keys(a) as (keyof SaleFilters)[]).every((key) => a[key] === b[key])

const pad = (value: number) => String(value).padStart(2, "0")
const dateInput = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
const timeInput = (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`

// SSE (realtime.ts) is the main path; this slower refetch only covers a
// connection that fails silently, like the React app's 60 s poll.
const FALLBACK_REFETCH_MS = 60_000

type InitialItems = NonNullable<ProductSelectionModalProps["initialItems"]>
type ReadOnlyItems = NonNullable<ProductSelectionModalProps["additionalReadOnlyItems"]>

/** The period's sales (React VendasTab): filters, list with the period closing, new sale, details with cancel, and print. */
export function VendasTab() {
  const { t: tCommon, language } = useTranslation("common")
  const { t: tSales } = useTranslation("sales")
  const { t: tPrinter } = useTranslation("printer")
  const { t: tDeliveries } = useTranslation("deliveries")
  const localizedError = useErrorMessage()
  const activeLocale = () => normalizeLocale(language())
  const queryClient = useQueryClient()
  const pages = createCursorPages(10)

  // The last 24 h by default, like the React app.
  const now = new Date()
  const ago24 = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const [customerName, setCustomerName] = createSignal("")
  const [createdBy, setCreatedBy] = createSignal("")
  const [totalMin, setTotalMin] = createSignal("")
  const [totalMax, setTotalMax] = createSignal("")
  const [startDate, setStartDate] = createSignal(dateInput(ago24))
  const [startTime, setStartTime] = createSignal(timeInput(ago24))
  const [endDate, setEndDate] = createSignal(dateInput(now))
  const [endTime, setEndTime] = createSignal(timeInput(now))
  const [endEdited, setEndEdited] = createSignal(false)
  const inputs = (): SaleFilters => ({
    customerName: customerName(), createdBy: createdBy(), totalMin: totalMin(), totalMax: totalMax(),
    startDate: startDate(), startTime: startTime(), endDate: endDate(), endTime: endTime(), endEdited: endEdited(),
  })
  // Filters apply on "Search" only; page and page size refetch at once.
  const [applied, setApplied] = createSignal<SaleFilters>(inputs())
  const [isSearching, setIsSearching] = createSignal(false)

  const [isModalOpen, setIsModalOpen] = createSignal(false)
  const [currentSale, setCurrentSale] = createSignal<Sale | null>(null)
  // Client id of the sale being created (a retry after a lost answer gets the
  // sale the first attempt created), and the body of that first attempt, to
  // tell whether a retry changed it.
  let draftSaleId = ""
  let draftFirstBody: string | null = null

  const listQuery = (): SaleQuery => {
    const filters = applied()
    return {
      // An instant range, like the React app (start at :00, end at the last
      // millisecond of the minute). The default end (the minute the page
      // opened) is not sent: sales made since, here or through SSE, still show.
      from: filters.startDate && filters.startTime ? new Date(`${filters.startDate}T${filters.startTime}:00`).toISOString() : undefined,
      to: filters.endEdited && filters.endDate && filters.endTime ? new Date(`${filters.endDate}T${filters.endTime}:59.999`).toISOString() : undefined,
      customerName: filters.customerName,
      sellerName: filters.createdBy,
      minTotalCents: filters.totalMin ? centsFromInput(filters.totalMin) : undefined,
      maxTotalCents: filters.totalMax ? centsFromInput(filters.totalMax) : undefined,
      cursor: pages.cursor(),
      limit: pages.limit(),
    }
  }

  const sales = createQuery(() => {
    const query = listQuery()
    return {
      queryKey: [...saleKeys.all, "list", query],
      queryFn: ({ signal }) => listSales(query, signal),
      placeholderData: keepPreviousData,
      refetchInterval: FALLBACK_REFETCH_MS,
      // A refetch updates the rows in place (by id): no remount.
      reconcile: "id",
    }
  })

  // A failed background refetch keeps the rows and only logs, like the React
  // poll; a failed load also warns.
  onQueryError(sales, (error) => {
    console.error("Error fetching sales", error)
    if (sales.data === undefined) toast.error(localizedError("loadSales", error))
  })

  const isLoading = () => sales.isPending || sales.isPlaceholderData || isSearching()
  const showSkeleton = createMinLoading(isLoading)
  // A failed load after a filter, page or search change keeps the last rows
  // and summary on screen (React kept them), with the toast; the first load
  // has nothing to keep.
  const lastGood = createMemo<SalePage | undefined>((previous) => loadedData(sales) ?? previous)
  const salePage = () => loadedData(sales) ?? (sales.isError ? lastGood() : undefined)
  const saleRows = () => salePage()?.items ?? []
  const totalItems = () => salePage()?.total ?? 0
  // The period closing: the /v1 sums the whole filter (summary), not the page.
  const periodTotalCents = () => salePage()?.summary.totalCents ?? 0

  const invalidateSales = () => queryClient.invalidateQueries({ queryKey: saleKeys.all })

  const create = createMutation(() => ({
    mutationFn: async (input: { customerName: string; items: ConfirmedItem[] }) => {
      const body = {
        ...(input.customerName ? { customerName: input.customerName } : {}),
        items: input.items.map(({ productId, quantity }) => ({ productId, quantity })),
      }
      const serialized = JSON.stringify(body)
      if (draftFirstBody === null) draftFirstBody = serialized
      const result = await createSale({ id: draftSaleId, ...body })
      // A retry with an edited form whose first attempt had gone through: the
      // API answers the sale already recorded (200), without the change. It
      // stays as it is (user's decision, S4), and the user is told.
      return { sale: result.sale, changeLost: !result.created && serialized !== draftFirstBody }
    },
    onSuccess: (result) => {
      void invalidateSales()
      setIsModalOpen(false)
      if (result.changeLost) toast.warning(tSales("alreadyRegistered"))
    },
    onError: (error) => {
      console.error("Error creating sale", error)
      toast.error(localizedError("createSale", error))
    },
  }))

  const cancel = createMutation(() => ({
    mutationFn: cancelSale,
    // The modal closes itself after this; the sale stays as the dialog's
    // content through the exit animation (cleared when a new sale opens).
    onSuccess: () => void invalidateSales(),
    // ProductSelectionModal shows the toast.
  }))

  const handleNewSaleClick = () => {
    draftSaleId = crypto.randomUUID()
    draftFirstBody = null
    setCurrentSale(null)
    setIsModalOpen(true)
  }

  const handleInfoClick = (sale: Sale) => {
    setCurrentSale(sale)
    setIsModalOpen(true)
  }

  const handleModalConfirm = async (name: string, items: ConfirmedItem[]) => {
    // Rejects on failure: the modal keeps what was typed.
    await create.mutateAsync({ customerName: name, items })
  }

  // "Search" always asks the API (React's fetchSales). A failure says so
  // even with rows on screen (the background refetches only log).
  const reloadList = async () => {
    const key = [...saleKeys.all, "list", listQuery()]
    setIsSearching(true)
    try {
      // cancelRefetch false: joins the fetch the page change may have started.
      await queryClient.refetchQueries({ queryKey: key, exact: true }, { cancelRefetch: false })
      const state = queryClient.getQueryState(key)
      if (state?.status === "error" && state.data !== undefined) toast.error(localizedError("loadSales", state.error))
    } finally {
      setIsSearching(false)
    }
  }

  const handleApplyFilters = () => {
    const next = inputs()
    if (sameFilters(next, applied())) {
      // Same filters: back to page 1, asked again.
      pages.reset()
      void reloadList()
      return
    }
    // One change: no request with the old filters' cursor in between.
    batch(() => {
      setApplied(next)
      pages.reset()
    })
  }

  const paymentLabel = (method: PaymentMethod | null) => (method ? tDeliveries(`payment.${method}` as never) : tCommon("notInformed"))
  const saleDate = (sale: Sale) => (sale.soldAt ? formatDateTime(sale.soldAt, activeLocale()) : tCommon("notInformed"))
  const itemsSummary = (sale: Sale) => [
    ...(sale.items ?? []).map((item) => `${formatNumber(item.quantity, activeLocale())}x ${item.description || tSales("fallback.product")}`),
    ...(sale.serviceItems ?? []).map((item) => `${formatNumber(item.quantity, activeLocale())}x ${item.description} (${tSales("serviceLine")})`),
  ].join(", ")

  const currentItems = (): InitialItems => (currentSale()?.items ?? []).map((item) => ({
    productId: item.productId,
    quantity: item.quantity,
    name: item.description,
    unitPriceCents: item.unitPriceCents,
  }))
  const currentServiceItems = (): ReadOnlyItems => (currentSale()?.serviceItems ?? []).map((item) => ({
    description: item.description,
    quantity: item.quantity,
    unitPriceCents: item.unitPriceCents,
  }))
  const currentDescription = () => (currentSale()?.serviceItems ?? [])
    .map((item) => `${formatNumber(item.quantity, activeLocale())}x ${item.description}`).join(", ")

  const handlePrint = (sale: Sale) =>
    printReceipt({
      title: tPrinter("receiptTitleSale", { id: sale.id }),
      customerName: sale.customerName?.trim() || tCommon("notInformed"),
      dateLabel: saleDate(sale),
      items: [
        ...(sale.items ?? []).map((item) => ({ name: item.description || tSales("fallback.product"), quantity: item.quantity, unitPriceCents: item.unitPriceCents })),
        ...(sale.serviceItems ?? []).map((item) => ({ name: item.description, quantity: item.quantity, unitPriceCents: item.unitPriceCents })),
      ],
      totalCents: sale.totalCents,
      totalLabel: tPrinter("receiptTotal"),
      paymentLabel: paymentLabel(sale.paymentMethod),
      locale: activeLocale(),
    })

  return (
    <div class="space-y-4">
      <FiltersBar
        dateRange={{
          startDate: startDate(), startTime: startTime(), endDate: endDate(), endTime: endTime(),
          onStartDateChange: setStartDate,
          onStartTimeChange: setStartTime,
          onEndDateChange: (value) => { setEndDate(value); setEndEdited(true) },
          onEndTimeChange: (value) => { setEndTime(value); setEndEdited(true) },
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
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleModalConfirm}
        title={currentSale() ? tSales("details") : tSales("new")}
        initialClientName={currentSale()?.customerName ?? ""}
        description={currentDescription() || undefined}
        initialItems={currentItems()}
        additionalReadOnlyItems={currentServiceItems()}
        mergeSameProducts
        readOnly={!!currentSale()}
        onCancelSale={currentSale() ? async () => { await cancel.mutateAsync(currentSale()!.id) } : undefined}
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
                <TableHead>{tCommon("payment")}</TableHead>
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
                  when={saleRows().length > 0}
                  fallback={
                    <TableRow>
                      <TableCell colSpan={7} class="text-center text-muted-foreground py-8">
                        {tSales("empty")}
                      </TableCell>
                    </TableRow>
                  }
                >
                  <For each={saleRows()}>
                    {(sale, index) => (
                      <TableRow class="animate-in fade-in-0 duration-300">
                        <TableCell class="text-center">{formatNumber((pages.page() - 1) * pages.limit() + index() + 1, activeLocale())}</TableCell>
                        <TableCell>
                          <div class="font-medium">{sale.customerName || tCommon("notInformed")}</div>
                          <Show when={itemsSummary(sale)}>
                            <div class="text-sm text-muted-foreground truncate max-w-[280px]" title={itemsSummary(sale)}>
                              {itemsSummary(sale)}
                            </div>
                          </Show>
                        </TableCell>
                        <TableCell class="text-muted-foreground">{sale.seller?.name || tCommon("notInformed")}</TableCell>
                        <TableCell>{saleDate(sale)}</TableCell>
                        <TableCell>{paymentLabel(sale.paymentMethod)}</TableCell>
                        <TableCell class="text-right">{formatCents(sale.totalCents, activeLocale())}</TableCell>
                        <TableCell class="text-right">
                          <div class="flex justify-end gap-2">
                            <IconButton
                              icon={<Printer class="h-4 w-4" />}
                              label={tPrinter("printSale")}
                              onClick={() => handlePrint(sale)}
                            />
                            <IconButton
                              icon={<Eye class="h-4 w-4" />}
                              label={tSales("viewDetails")}
                              onClick={() => handleInfoClick(sale)}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </For>
                </Show>
              </Show>
            </TableBody>
          </Table>
          <Pagination
            currentPage={pages.page()}
            totalPages={totalPagesOf(totalItems(), pages.limit())}
            hasMore={!!salePage()?.nextCursor}
            onPageChange={(target) => pages.goTo(target, salePage()?.nextCursor)}
            pageSize={pages.limit()}
            onPageSizeChange={pages.setLimit}
            isLoading={isLoading()}
          />
        </CardContent>
      </Card>
    </div>
  )
}
