import { createSignal, For, Show } from "solid-js"
import { createMutation, createQuery, keepPreviousData, useQueryClient } from "@tanstack/solid-query"
import { Loader2, Pencil, Printer, Trash2 } from "lucide-solid"
import { toast } from "solid-sonner"

import {
  closeOrder,
  createOrder,
  deleteOrder,
  getOrder,
  listOrders,
  newRequestId,
  operationKeys,
  setOrderItemStatus,
  updateOrder,
  type Order,
  type OrderFilters,
} from "@/api/orders"
import { loadedData, onQueryError } from "@/api/query"
import { salesKeys } from "@/api/sales"
import { FiltersBar } from "@/components/dashboard/FiltersBar"
import { Pagination } from "@/components/Pagination"
import { ProductSelectionModal, type ConfirmedItem, type PaymentMethod } from "@/components/ProductSelectionModal"
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

type ModalItem = { id?: string; productId: string; quantity: number; unitPriceCents?: number; name?: string; status?: OrderItemStatus }

function formatItemsSummary(order: Order, locale: string, fallbackProduct: string): string {
  return (order.items ?? []).map((item) => `${formatNumber(item.quantity, locale)}x ${item.productName || fallbackProduct}`).join(", ")
}

// The filters apply on "Search" (like the React app): only the page and the
// page size refetch on their own.
function toOrderFilters(input: { customerName: string; createdBy: string; totalMin: string; totalMax: string }): OrderFilters {
  return {
    customerName: input.customerName || undefined,
    // The /v1 filters by the seller's id (exact), as the Bun did with this
    // field: there is no filter by the seller's name (gap of the /v1, plan S4).
    sellerId: input.createdBy || undefined,
    minTotalCents: input.totalMin ? centsFromInput(input.totalMin) : undefined,
    maxTotalCents: input.totalMax ? centsFromInput(input.totalMax) : undefined,
  }
}

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
  const [applied, setApplied] = createSignal<OrderFilters>({})

  const [isModalOpen, setIsModalOpen] = createSignal(false)
  const [currentOrder, setCurrentOrder] = createSignal<Order | null>(null)
  const [currentOrderItems, setCurrentOrderItems] = createSignal<ModalItem[]>([])
  // The client id of the order being created: a retry after a failure (or a
  // second click that got through) sends the same id, and the API creates one order.
  const [createId, setCreateId] = createSignal(newRequestId())
  const [deletingId, setDeletingId] = createSignal<string | null>(null)

  const orders = createQuery(() => ({
    queryKey: [...operationKeys.orders, "list", { ...applied(), cursor: pages.cursor(), limit: pages.limit() }],
    queryFn: ({ signal }) => listOrders({ ...applied(), cursor: pages.cursor(), limit: pages.limit() }, signal),
    placeholderData: keepPreviousData,
    // Realtime events are the main path (order.changed invalidates "orders");
    // this slower poll only covers a stream that failed silently, like the React app.
    refetchInterval: 60_000,
  }))
  onQueryError(orders, (error) => {
    console.error("Error fetching orders", error)
    toast.error(localizedError("loadOrders", error))
  })

  const isLoading = () => orders.isPending || orders.isPlaceholderData
  const showSkeleton = createMinLoading(isLoading)
  const page = () => (orders.isError ? undefined : loadedData(orders))
  const rows = () => page()?.items ?? []
  const totalPages = () => totalPagesOf(page()?.total ?? 0, pages.limit())

  // An order change shows on the kitchen and delivery boards and on the
  // sidebar counters too (all keyed under these prefixes).
  const invalidateOrders = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: operationKeys.orders }),
    queryClient.invalidateQueries({ queryKey: operationKeys.kitchen }),
    queryClient.invalidateQueries({ queryKey: operationKeys.delivery }),
  ])

  const save = createMutation(() => ({
    mutationFn: (input: { order: Order | null; customerName: string; items: ConfirmedItem[]; delivery?: { isDelivery: boolean; deliveryAddress: string | null } }) => {
      const items = input.items.map(({ id, productId, quantity }) => ({ ...(id != null ? { id } : {}), productId, quantity }))
      const delivery = input.delivery
        ? { isDelivery: input.delivery.isDelivery, ...(input.delivery.isDelivery && input.delivery.deliveryAddress ? { deliveryAddress: input.delivery.deliveryAddress } : {}) }
        : {}
      return input.order
        ? updateOrder(input.order.id, { customerName: input.customerName, items, ...delivery })
        : createOrder({ id: createId(), ...(input.customerName ? { customerName: input.customerName } : {}), items, ...delivery })
    },
    onSuccess: (_order, input) => {
      if (!input.order) setCreateId(newRequestId())
      void invalidateOrders()
    },
    onError: (error) => {
      console.error("Error saving order", error)
      toast.error(localizedError("saveOrder", error))
    },
  }))

  const remove = createMutation(() => ({
    mutationFn: deleteOrder,
    onMutate: (id: string) => setDeletingId(id),
    onSuccess: () => void invalidateOrders(),
    onError: (error) => {
      console.error("Error deleting order", error)
      toast.error(localizedError("deleteOrder", error))
    },
    onSettled: () => setDeletingId(null),
  }))

  const handleApplyFilters = () => {
    const next = toOrderFilters({ customerName: customerName(), createdBy: createdBy(), totalMin: totalMin(), totalMax: totalMax() })
    // "Search" with the same filters on page 1 reloads, as in the React app.
    if (JSON.stringify(next) === JSON.stringify(applied()) && pages.page() === 1) {
      void orders.refetch()
      return
    }
    setApplied(next)
    pages.reset()
  }

  const handleOpenCreateModal = () => {
    setCurrentOrder(null)
    setCurrentOrderItems([])
    setIsModalOpen(true)
  }

  const handleEditClick = async (order: Order) => {
    setCurrentOrder(order)
    try {
      const fresh = await queryClient.fetchQuery({
        queryKey: [...operationKeys.orders, "detail", order.id],
        queryFn: ({ signal }) => getOrder(order.id, signal),
        staleTime: 0,
      })
      setCurrentOrder(fresh)
      setCurrentOrderItems((fresh.items ?? []).map((item) => ({
        id: item.id,
        productId: item.productId,
        quantity: item.quantity,
        name: item.productName,
        unitPriceCents: item.unitPriceCents,
        status: item.status,
      })))
    } catch (error) {
      console.error("Error fetching order details", error)
      toast.error(localizedError("loadOrders", error))
      setCurrentOrderItems([])
    }
    setIsModalOpen(true)
  }

  const handleModalConfirm = async (name: string, items: ConfirmedItem[], delivery?: { isDelivery: boolean; deliveryAddress: string | null }) => {
    // A failure rejects: the modal stays open with what was typed.
    await save.mutateAsync({ order: currentOrder(), customerName: name, items, delivery })
    setIsModalOpen(false)
  }

  const handleDeleteOrder = async (id: string) => {
    if (remove.isPending) return
    if (!(await confirm({ description: tOrders("confirm.delete"), confirmLabel: tCommon("delete"), destructive: true }))) return
    remove.mutate(id)
  }

  // The modal reports these failures (toast) and blocks a second click.
  const handleCloseOrder = async (id: string, paymentMethod: PaymentMethod | null) => {
    await closeOrder(id, paymentMethod)
    await Promise.all([invalidateOrders(), queryClient.invalidateQueries({ queryKey: salesKeys.all }), queryClient.invalidateQueries({ queryKey: salesKeys.reports })])
  }

  const handleChangeItemStatus = async (orderId: string, itemId: string, status: OrderItemStatus) => {
    await setOrderItemStatus(orderId, itemId, status)
    await invalidateOrders()
  }

  const handlePrint = (order: Order) => {
    const dateLabel = formatDateTime(order.updatedAt || order.openedAt || "", activeLocale())
    printReceipt({
      title: tPrinter("receiptTitleOrder", { id: order.id }),
      customerName: order.customerName?.trim() || tCommon("notInformed"),
      dateLabel,
      items: (order.items ?? []).map((item) => ({
        name: item.productName || tOrders("fallback.product"),
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
      })),
      totalCents: order.totalCents,
      totalLabel: tPrinter("receiptTotal"),
      locale: activeLocale(),
    })
  }

  const modalOrder = () => currentOrder()

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
        title={modalOrder() ? tOrders("edit") : tOrders("new")}
        initialClientName={modalOrder()?.customerName || ""}
        initialDelivery={{ isDelivery: modalOrder()?.isDelivery ?? false, deliveryAddress: modalOrder()?.deliveryAddress ?? null }}
        initialItems={currentOrderItems()}
        isEditing={!!modalOrder()}
        onCloseOrder={modalOrder() && !modalOrder()!.isDelivery ? (paymentMethod) => handleCloseOrder(modalOrder()!.id, paymentMethod) : undefined}
        onChangeItemStatus={modalOrder() && modalOrder()!.status !== "DELIVERING" ? (itemId, status) => handleChangeItemStatus(modalOrder()!.id, itemId, status) : undefined}
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
                  when={rows().length > 0}
                  fallback={
                    <TableRow>
                      <TableCell colSpan={6} class="text-center text-muted-foreground py-8">
                        {tOrders("empty")}
                      </TableCell>
                    </TableRow>
                  }
                >
                  <For each={rows()}>
                    {(order, index) => {
                      const summary = () => formatItemsSummary(order, activeLocale(), tOrders("fallback.product"))
                      return (
                        <TableRow class="animate-in fade-in-0 duration-300">
                          <TableCell class="text-center">{formatNumber((pages.page() - 1) * pages.limit() + index() + 1, activeLocale())}</TableCell>
                          <TableCell>
                            <div class="font-medium">{order.customerName || tCommon("notInformed")}</div>
                            <Show when={order.isDelivery}>
                              <div class="text-xs text-muted-foreground">{tOrders(order.status === "DELIVERING" ? "statusDelivering" : "isDelivery")}: {order.deliveryAddress}</div>
                            </Show>
                            <Show when={summary()}>
                              <div class="text-sm text-muted-foreground truncate max-w-[280px]" title={summary()}>
                                {summary()}
                              </div>
                            </Show>
                          </TableCell>
                          <TableCell class="text-muted-foreground">{order.seller?.name || tCommon("notInformed")}</TableCell>
                          <TableCell>{formatDateTime(order.updatedAt || order.openedAt || "", activeLocale())}</TableCell>
                          <TableCell class="text-right">{formatCents(order.totalCents, activeLocale())}</TableCell>
                          <TableCell class="text-right">
                            <div class="flex justify-end gap-2">
                              <IconButton icon={<Printer class="h-4 w-4" />} label={tPrinter("printOrder")} onClick={() => handlePrint(order)} />
                              <IconButton
                                icon={<Pencil class="h-4 w-4" />}
                                label={tOrders("editLabel")}
                                onClick={() => void handleEditClick(order)}
                                disabled={order.status === "DELIVERING"}
                              />
                              <IconButton
                                icon={<Show when={deletingId() === order.id} fallback={<Trash2 class="h-4 w-4" />}><Loader2 class="h-4 w-4 animate-spin" /></Show>}
                                label={tOrders("deleteLabel")}
                                class="text-destructive hover:text-destructive"
                                onClick={() => void handleDeleteOrder(order.id)}
                                disabled={deletingId() === order.id || order.status === "DELIVERING"}
                              />
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
