import { batch, createMemo, createSignal, For, Show } from "solid-js"
import { createMutation, createQuery, keepPreviousData, useQueryClient } from "@tanstack/solid-query"
import { Loader2, Pencil, Printer, Trash2 } from "lucide-solid"
import { toast } from "solid-sonner"

import { apiErrorOf } from "@/api/errors"
import {
  closeOrder,
  createOrder,
  deleteOrder,
  getOrder,
  listOrders,
  orderKeys,
  saleKeys,
  setOrderItemStatus,
  updateOrder,
  type Order,
  type OrderPage,
  type OrderQuery,
  type PaymentMethod,
} from "@/api/orders"
import { loadedData, onQueryError } from "@/api/query"
import { FiltersBar } from "@/components/dashboard/FiltersBar"
import { Pagination } from "@/components/Pagination"
import { ProductSelectionModal, type ConfirmedItem, type ProductSelectionModalProps } from "@/components/ProductSelectionModal"
import { printReceipt } from "@/components/receipt/printReceipt"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { IconButton } from "@/components/ui/icon-button"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useConfirm } from "@/contexts/ConfirmContext"
import type { OrderItemStatus } from "@/domain/models"
import { useErrorMessage } from "@/i18n/error-message"
import { formatDateTime, formatNumber } from "@/i18n/format"
import { normalizeLocale } from "@/i18n/locale"
import { useTranslation } from "@/i18n/solid"
import { createCursorPages, totalPagesOf } from "@/lib/cursor-pages"
import { createMinLoading } from "@/lib/min-loading"
import { centsFromInput, formatCents } from "@/lib/money"

type OrderFilters = {
  customerName: string
  createdBy: string
  totalMin: string
  totalMax: string
}

const NO_FILTERS: OrderFilters = { customerName: "", createdBy: "", totalMin: "", totalMax: "" }
const sameFilters = (a: OrderFilters, b: OrderFilters) =>
  a.customerName === b.customerName && a.createdBy === b.createdBy && a.totalMin === b.totalMin && a.totalMax === b.totalMax

// The order changed under the screen: the list is reloaded so it shows why.
const STALE_ORDER_CODES = new Set(["ORDER_NOT_FOUND", "ORDER_NOT_OPEN", "ORDER_DELIVERING", "ORDER_ALREADY_CLOSED", "ORDER_CONFLICT", "DELIVERY_NOT_STARTED"])

// SSE (realtime.ts) is the main path for updates; this slower refetch only
// covers a connection that fails silently, like the React app's 60 s poll.
// TanStack Query pauses it while the tab is hidden.
const FALLBACK_REFETCH_MS = 60_000

type InitialItems = NonNullable<ProductSelectionModalProps["initialItems"]>

/** The open orders (React PedidosTab): filters, list, create/edit/close in ProductSelectionModal, print and delete. */
export function PedidosTab() {
  const { t: tCommon, language } = useTranslation("common")
  const { t: tOrders } = useTranslation("orders")
  const { t: tPrinter } = useTranslation("printer")
  const localizedError = useErrorMessage()
  const activeLocale = () => normalizeLocale(language())
  const confirm = useConfirm()
  const queryClient = useQueryClient()
  const pages = createCursorPages(10)

  const [customerName, setCustomerName] = createSignal("")
  const [createdBy, setCreatedBy] = createSignal("")
  const [totalMin, setTotalMin] = createSignal("")
  const [totalMax, setTotalMax] = createSignal("")
  // Filters apply on "Search" only; page and page size refetch at once.
  const [applied, setApplied] = createSignal<OrderFilters>(NO_FILTERS)
  const [isSearching, setIsSearching] = createSignal(false)

  const [isModalOpen, setIsModalOpen] = createSignal(false)
  const [currentOrder, setCurrentOrder] = createSignal<Order | null>(null)
  const [currentOrderItems, setCurrentOrderItems] = createSignal<InitialItems>([])
  const [openingOrderId, setOpeningOrderId] = createSignal<string | null>(null)
  // Bumped to reload the open editor from the order read again (after a conflict).
  const [editorReload, setEditorReload] = createSignal(0)
  const [deletingId, setDeletingId] = createSignal<string | null>(null)
  // Client id of the order being created: a retry after a lost answer gets
  // the order the first attempt created, never a second one. The body of that
  // first attempt is kept: if the form changed before the retry, the API may
  // answer with the old order, so the new body follows as a PUT.
  let draftOrderId = ""
  let draftFirstBody: string | null = null

  const listQuery = (): OrderQuery => {
    const filters = applied()
    return {
      status: "open",
      customerName: filters.customerName,
      sellerName: filters.createdBy,
      minTotalCents: filters.totalMin ? centsFromInput(filters.totalMin) : undefined,
      maxTotalCents: filters.totalMax ? centsFromInput(filters.totalMax) : undefined,
      cursor: pages.cursor(),
      limit: pages.limit(),
    }
  }

  const orders = createQuery(() => {
    const query = listQuery()
    return {
      queryKey: [...orderKeys.all, "list", query],
      queryFn: ({ signal }) => listOrders(query, signal),
      placeholderData: keepPreviousData,
      refetchInterval: FALLBACK_REFETCH_MS,
      // A refetch updates the rows in place (by id): no remount, so no fade-in
      // replay and the focus stays on the row's button.
      reconcile: "id",
    }
  })

  // A failed refetch in the background (realtime, the fallback) keeps the rows
  // and only logs, like the React poll; a failed load also warns.
  onQueryError(orders, (error) => {
    console.error("Error fetching orders", error)
    if (orders.data === undefined) toast.error(localizedError("loadOrders", error))
  })

  const isLoading = () => orders.isPending || orders.isPlaceholderData || isSearching()
  const showSkeleton = createMinLoading(isLoading)
  // A failed load after a filter, page or search change keeps the last rows
  // on screen (React kept them), with the toast; the first load has none.
  const lastGood = createMemo<OrderPage | undefined>((previous) => loadedData(orders) ?? previous)
  const orderPage = () => loadedData(orders) ?? (orders.isError ? lastGood() : undefined)
  const orderRows = () => orderPage()?.items ?? []

  const invalidateOrders = () => queryClient.invalidateQueries({ queryKey: orderKeys.all })
  const reloadIfStale = (error: unknown) => {
    if (STALE_ORDER_CODES.has(apiErrorOf(error).code)) void invalidateOrders()
  }

  const save = createMutation(() => ({
    mutationFn: async (input: { order: Order | null; customerName: string; items: ConfirmedItem[]; delivery?: { isDelivery: boolean; deliveryAddress: string | null } }) => {
      const isDelivery = input.delivery?.isDelivery ?? false
      const deliveryAddress = isDelivery && input.delivery?.deliveryAddress ? { deliveryAddress: input.delivery.deliveryAddress } : {}
      if (input.order) {
        return updateOrder(input.order.id, {
          // The version the editor shows: a change made elsewhere since
          // answers ORDER_CONFLICT, and nothing is written.
          expectedUpdatedAt: input.order.updatedAt,
          customerName: input.customerName,
          isDelivery,
          ...deliveryAddress,
          items: input.items.map(({ id, productId, quantity }) => ({ ...(id != null ? { id } : {}), productId, quantity })),
        })
      }
      const body = {
        ...(input.customerName ? { customerName: input.customerName } : {}),
        isDelivery,
        ...deliveryAddress,
        items: input.items.map(({ productId, quantity }) => ({ productId, quantity })),
      }
      const serialized = JSON.stringify(body)
      const isFirstAttempt = draftFirstBody === null
      if (isFirstAttempt) draftFirstBody = serialized
      const created = await createOrder({ id: draftOrderId, ...body })
      if (isFirstAttempt || serialized === draftFirstBody) return created
      // A retry with an edited form: the order may be the first attempt's.
      return updateOrder(created.id, { expectedUpdatedAt: created.updatedAt, customerName: input.customerName, ...body })
    },
    onSuccess: () => {
      void invalidateOrders()
      setIsModalOpen(false)
    },
    onError: (error, input) => {
      console.error("Error saving order", error)
      toast.error(localizedError("saveOrder", error))
      reloadIfStale(error)
      // Changed elsewhere: the dialog stays open and shows the order as it is
      // now, so the next save carries the new version.
      if (input.order && apiErrorOf(error).code === "ORDER_CONFLICT") void reloadEditor(input.order.id)
    },
  }))

  const close = createMutation(() => ({
    mutationFn: (input: { id: string; paymentMethod: PaymentMethod | null }) => closeOrder(input.id, input.paymentMethod),
    onSuccess: () => {
      // The order became a sale.
      void invalidateOrders()
      void queryClient.invalidateQueries({ queryKey: saleKeys.all })
    },
    // ProductSelectionModal shows the toast.
    onError: reloadIfStale,
  }))

  const changeItemStatus = createMutation(() => ({
    mutationFn: (input: { orderId: string; itemId: string; status: OrderItemStatus }) => setOrderItemStatus(input.orderId, input.itemId, input.status),
    onSuccess: (updated: Order) => {
      // The status change moved the order's version: keep the editor's in step.
      if (currentOrder()?.id === updated.id) setCurrentOrder(updated)
      void invalidateOrders()
    },
    // ProductSelectionModal shows the toast.
    onError: reloadIfStale,
  }))

  const remove = createMutation(() => ({
    mutationFn: deleteOrder,
    onMutate: (id: string) => setDeletingId(id),
    onSuccess: () => void invalidateOrders(),
    onError: (error) => {
      console.error("Error deleting order", error)
      toast.error(localizedError("deleteOrder", error))
      reloadIfStale(error)
    },
    onSettled: () => setDeletingId(null),
  }))

  const handleOpenCreateModal = () => {
    draftOrderId = crypto.randomUUID()
    draftFirstBody = null
    setCurrentOrder(null)
    setCurrentOrderItems([])
    setIsModalOpen(true)
  }

  // "Search" always asks the API. A failure says so even with rows on screen
  // (the background refetches only log).
  const reloadList = async () => {
    const key = [...orderKeys.all, "list", listQuery()]
    setIsSearching(true)
    try {
      // cancelRefetch false: joins the fetch the page change may have started.
      await queryClient.refetchQueries({ queryKey: key, exact: true }, { cancelRefetch: false })
      const state = queryClient.getQueryState(key)
      if (state?.status === "error" && state.data !== undefined) toast.error(localizedError("loadOrders", state.error))
    } finally {
      setIsSearching(false)
    }
  }

  const handleApplyFilters = () => {
    const next = { customerName: customerName(), createdBy: createdBy(), totalMin: totalMin(), totalMax: totalMax() }
    if (sameFilters(next, applied())) {
      // Same filters: back to page 1, asked again (React's fetchOrders).
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

  const readOrder = (id: string) => queryClient.fetchQuery({
    queryKey: orderKeys.detail(id),
    queryFn: ({ signal }) => getOrder(id, signal),
    staleTime: 0,
    // The pencil waits on this: fail fast instead of the default retries.
    retry: false,
  })
  const loadEditor = (fresh: Order) => {
    setCurrentOrder(fresh)
    setCurrentOrderItems((fresh.items ?? []).map((item) => ({
      id: item.id,
      productId: item.productId,
      quantity: item.quantity,
      name: item.productName,
      unitPriceCents: item.unitPriceCents,
      status: item.status,
    })))
  }
  const reloadEditor = async (id: string) => {
    try {
      const fresh = await readOrder(id)
      if (!isModalOpen() || currentOrder()?.id !== id) return
      batch(() => {
        loadEditor(fresh)
        setEditorReload((count) => count + 1)
      })
    } catch (error) {
      console.error("Error reloading the order", error)
    }
  }

  // The modal edits the order as it is now (another device may have changed
  // it), so it opens only after the order is read again.
  const handleEditClick = async (order: Order) => {
    if (openingOrderId()) return
    setOpeningOrderId(order.id)
    try {
      loadEditor(await readOrder(order.id))
      setIsModalOpen(true)
    } catch (error) {
      console.error("Error fetching order details", error)
      toast.error(localizedError("loadOrders", error))
      reloadIfStale(error)
    } finally {
      setOpeningOrderId(null)
    }
  }

  const handleModalConfirm = async (name: string, items: ConfirmedItem[], delivery?: { isDelivery: boolean; deliveryAddress: string | null }) => {
    // Rejects on failure: the modal keeps what was typed.
    await save.mutateAsync({ order: currentOrder(), customerName: name, items, delivery })
  }

  const handleDeleteOrder = async (id: string) => {
    if (deletingId() != null) return
    if (!(await confirm({ description: tOrders("confirm.delete"), confirmLabel: tCommon("delete"), destructive: true }))) return
    remove.mutate(id)
  }

  const closeOrderHandler = () => {
    const order = currentOrder()
    if (!order || order.isDelivery) return undefined
    return async (paymentMethod: PaymentMethod | null) => {
      await close.mutateAsync({ id: order.id, paymentMethod })
    }
  }

  const itemStatusHandler = () => {
    const order = currentOrder()
    if (!order || order.status === "DELIVERING") return undefined
    return async (itemId: string, status: OrderItemStatus) => {
      await changeItemStatus.mutateAsync({ orderId: order.id, itemId, status })
    }
  }

  const itemsSummary = (order: Order) =>
    (order.items ?? []).map((item) => `${formatNumber(item.quantity, activeLocale())}x ${item.productName || tOrders("fallback.product")}`).join(", ")
  const orderDate = (order: Order) => formatDateTime(order.updatedAt || order.openedAt || "", activeLocale())

  const handlePrint = (order: Order) =>
    printReceipt({
      title: tPrinter("receiptTitleOrder", { id: order.id }),
      customerName: order.customerName?.trim() || tCommon("notInformed"),
      dateLabel: orderDate(order),
      items: (order.items ?? []).map((item) => ({
        name: item.productName || tOrders("fallback.product"),
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
      })),
      totalCents: order.totalCents,
      totalLabel: tPrinter("receiptTotal"),
      locale: activeLocale(),
    })

  return (
    <div class="space-y-4">
      <FiltersBar
        customerName={{ value: customerName(), onChange: setCustomerName }}
        createdBy={{ value: createdBy(), onChange: setCreatedBy }}
        totalRange={{ min: totalMin(), max: totalMax(), onMinChange: setTotalMin, onMaxChange: setTotalMax }}
        primaryAction={{ label: tOrders("new"), onClick: handleOpenCreateModal }}
        onFilter={handleApplyFilters}
        isLoading={isLoading()}
      />

      <ProductSelectionModal
        allowDelivery
        isOpen={isModalOpen()}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleModalConfirm}
        title={currentOrder() ? tOrders("edit") : tOrders("new")}
        initialClientName={currentOrder()?.customerName || ""}
        initialDelivery={{ isDelivery: currentOrder()?.isDelivery ?? false, deliveryAddress: currentOrder()?.deliveryAddress ?? null }}
        initialItems={currentOrderItems()}
        isEditing={!!currentOrder()}
        resetKey={editorReload()}
        onCloseOrder={closeOrderHandler()}
        onChangeItemStatus={itemStatusHandler()}
      />

      <Card>
        <CardHeader>
          <CardTitle>{tOrders("recent")}</CardTitle>
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
                        <TableCell><Skeleton class="h-4 w-[150px]" /></TableCell>
                        <TableCell><Skeleton class="h-4 w-[100px]" /></TableCell>
                        <TableCell><Skeleton class="h-4 w-[120px]" /></TableCell>
                        <TableCell class="text-right justify-end flex"><Skeleton class="h-4 w-16" /></TableCell>
                        <TableCell class="text-right justify-end flex gap-2">
                          <Skeleton class="h-8 w-8" />
                          <Skeleton class="h-8 w-8" />
                          <Skeleton class="h-8 w-8" />
                        </TableCell>
                      </TableRow>
                    )}
                  </For>
                }
              >
                <Show
                  when={orderRows().length > 0}
                  fallback={
                    <TableRow>
                      <TableCell colSpan={6} class="text-center text-muted-foreground py-8">
                        {tOrders("empty")}
                      </TableCell>
                    </TableRow>
                  }
                >
                  <For each={orderRows()}>
                    {(order, index) => (
                      <TableRow class="animate-in fade-in-0 duration-300">
                        <TableCell class="text-center">{formatNumber((pages.page() - 1) * pages.limit() + index() + 1, activeLocale())}</TableCell>
                        <TableCell>
                          <div class="font-medium">{order.customerName || tCommon("notInformed")}</div>
                          <Show when={order.isDelivery}>
                            <div class="text-xs text-muted-foreground">{tOrders(order.status === "DELIVERING" ? "statusDelivering" : "isDelivery")}: {order.deliveryAddress}</div>
                          </Show>
                          <Show when={itemsSummary(order)}>
                            <div class="text-sm text-muted-foreground truncate max-w-[280px]" title={itemsSummary(order)}>
                              {itemsSummary(order)}
                            </div>
                          </Show>
                        </TableCell>
                        <TableCell class="text-muted-foreground">{order.seller?.name || tCommon("notInformed")}</TableCell>
                        <TableCell>{orderDate(order)}</TableCell>
                        <TableCell class="text-right">{formatCents(order.totalCents, activeLocale())}</TableCell>
                        <TableCell class="text-right">
                          <div class="flex justify-end gap-2">
                            <IconButton
                              icon={<Printer class="h-4 w-4" />}
                              label={tPrinter("printOrder")}
                              onClick={() => handlePrint(order)}
                            />
                            <IconButton
                              icon={<Pencil class="h-4 w-4" />}
                              label={tOrders("editLabel")}
                              onClick={() => void handleEditClick(order)}
                              disabled={order.status === "DELIVERING" || openingOrderId() === order.id}
                            />
                            <IconButton
                              icon={
                                <Show when={deletingId() === order.id} fallback={<Trash2 class="h-4 w-4" />}>
                                  <Loader2 class="h-4 w-4 animate-spin" />
                                </Show>
                              }
                              label={tOrders("deleteLabel")}
                              class="text-destructive hover:text-destructive"
                              onClick={() => void handleDeleteOrder(order.id)}
                              disabled={deletingId() === order.id || order.status === "DELIVERING"}
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
            totalPages={totalPagesOf(orderPage()?.total ?? 0, pages.limit())}
            hasMore={!!orderPage()?.nextCursor}
            onPageChange={(target) => pages.goTo(target, orderPage()?.nextCursor)}
            pageSize={pages.limit()}
            onPageSizeChange={pages.setLimit}
            isLoading={isLoading()}
          />
        </CardContent>
      </Card>
    </div>
  )
}
