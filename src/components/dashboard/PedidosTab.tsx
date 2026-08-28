import { useState, useEffect, useRef, useCallback } from "react"
import { useTranslation } from "react-i18next"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { IconButton } from "@/components/ui/icon-button"
import { printReceipt } from "@/components/receipt/printReceipt"
import { FiltersBar } from "@/components/dashboard/FiltersBar"
import { Printer, Pencil, Trash2, Loader2 } from "lucide-react"
import api, { getErrorCode } from "@/services/api"
import { parseListResponse } from "@/services/parseResponse"
import { toast } from "sonner"
import { ProductSelectionModal } from "@/components/ProductSelectionModal"
import { Pagination } from "@/components/Pagination"
import { Skeleton } from "@/components/ui/skeleton"
import { useRealtimeEvents } from "@/hooks/useRealtimeEvents"
import { useMinLoadingDuration } from "@/hooks/useMinLoadingDuration"
import { useConfirm } from "@/contexts/ConfirmContext"
import { formatCurrencyBRL, formatDateTime, formatNumber } from "@/i18n/format"
import { normalizeLocale } from "@/i18n/locale"
import { getErrorTranslationKey, type ErrorContext } from "@/i18n/error-keys"
import type { Order, OrderItem, OrderItemStatus } from "@/domain/models"

type OrderFilters = {
  customerName: string
  createdBy: string
  totalMin: string
  totalMax: string
}

type CurrentOrderItem = {
  id?: number | string
  productId: number | string
  quantity: number
  unitPrice?: number
  name?: string
  status?: OrderItemStatus
}

function isOrdersEqual(a: Order[], b: Order[]) {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const ai = a[i]
    const bi = b[i]
    if (ai.id !== bi.id) return false
    if (ai.isOpen !== bi.isOpen) return false
    if ((ai.updatedAt || ai.openedAt) !== (bi.updatedAt || bi.openedAt)) return false
    if (ai.total !== bi.total) return false
    if ((ai.items?.length ?? 0) !== (bi.items?.length ?? 0)) return false
    for (let j = 0; j < (ai.items?.length ?? 0); j++) {
      const aiItem = ai.items?.[j]
      const biItem = bi.items?.[j]
      if (aiItem?.id !== biItem?.id || aiItem?.status !== biItem?.status || aiItem?.quantity !== biItem?.quantity) return false
    }
  }
  return true
}

function formatItemsSummary(items?: OrderItem[], locale?: string, fallbackProduct?: string): string {
  if (!items || items.length === 0) return ""
  return items.map((item) => formatNumber(item.quantity, locale) + "x " + (item.product?.name ?? fallbackProduct)).join(", ")
}

function buildOrderParams(page: number, limit: number, f: OrderFilters) {
  const params: any = { page, limit }
  if (f.customerName) params.customerName = f.customerName
  if (f.createdBy) params.createdBy = f.createdBy
  if (f.totalMin) params.totalMin = parseFloat(f.totalMin)
  if (f.totalMax) params.totalMax = parseFloat(f.totalMax)
  return params
}

export function PedidosTab() {
  const { i18n } = useTranslation()
  const { t: tAuth } = useTranslation("auth")
  const { t: tCommon } = useTranslation("common")
  const { t: tErrors } = useTranslation("errors")
  const { t: tOrders } = useTranslation("orders")
  const { t: tPrinter } = useTranslation("printer")
  const activeLocale = normalizeLocale(i18n.language)
  const localizedError = (context: ErrorContext, error: unknown) => {
    const translation = getErrorTranslationKey(context, getErrorCode(error))
    return translation.namespace === "auth"
      ? tAuth(translation.key)
      : tErrors(translation.key)
  }
  const confirm = useConfirm()
  const [page, setPage] = useState<number>(1)
  const [limit, setLimit] = useState<number>(10)
  const [orders, setOrders] = useState<Order[]>([])
  const [totalPages, setTotalPages] = useState<number>(0)
  const [hasMore, setHasMore] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState(false)
  const showSkeleton = useMinLoadingDuration(isLoading)
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false)
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null)
  const [currentOrderItems, setCurrentOrderItems] = useState<CurrentOrderItem[]>([])
  const [deletingId, setDeletingId] = useState<number | string | null>(null)
  const ordersRef = useRef<Order[]>([])

  const [customerName, setCustomerName] = useState("")
  const [createdBy, setCreatedBy] = useState("")
  const [totalMin, setTotalMin] = useState("")
  const [totalMax, setTotalMax] = useState("")

  const filterRef = useRef<OrderFilters>({ customerName, createdBy, totalMin, totalMax })
  useEffect(() => {
    filterRef.current = { customerName, createdBy, totalMin, totalMax }
  }, [customerName, createdBy, totalMin, totalMax])

  const loadOrdersRaw = useCallback(async () => {
    const params = buildOrderParams(page, limit, { customerName, createdBy, totalMin, totalMax })

    const response = await api.get(`/pedidos`, { params })

    const { data, total } = parseListResponse<Order>(response, 'orders')
    return { data, total }
  }, [page, limit, customerName, createdBy, totalMin, totalMax])

  const fetchOrders = useCallback(async () => {
    setIsLoading(true)
    try {
      const { data, total } = await loadOrdersRaw()
      setOrders(data)
      ordersRef.current = data

      if (total > 0) {
        setTotalPages(Math.ceil(total / limit))
        setHasMore(page < Math.ceil(total / limit))
      } else {
        setTotalPages(0)
        setHasMore(data.length === limit)
      }
    } catch (error) {
      console.error("Error fetching orders", error)
      toast.error(localizedError("loadOrders", error))
    } finally {
      setIsLoading(false)
    }
  }, [loadOrdersRaw, limit, page])

  const poll = useCallback(async () => {
    try {
      const f = filterRef.current
      const params = buildOrderParams(page, limit, f)
      const response = await api.get(`/pedidos`, { params })
      const { data } = parseListResponse<Order>(response, 'orders')

      const previous = ordersRef.current || []
      if (!isOrdersEqual(previous, data)) {
        setOrders(data)
        ordersRef.current = data
      }
    } catch (err) {
      console.error('[PedidosTab] Error polling orders', err)
    }
  }, [page, limit])

  useRealtimeEvents(['orders'], poll)

  // Filtros (cliente/criado-por/total/data) so aplicam ao clicar em
  // "Filtrar" (handleApplyFilters) - so page/limit disparam refetch automatico,
  // igual ao padrao ja usado em VendasTab.
  useEffect(() => {
    fetchOrders()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit])

  // Fallback: SSE eh o caminho principal (useRealtimeEvents acima), esse
  // interval mais espaçado so cobre o caso de conexao SSE falhar silenciosamente.
  useEffect(() => {
    let interval: number | null = null

    const startPolling = () => {
      if (interval != null) return
      poll()
      interval = window.setInterval(poll, 60000)
    }

    const stopPolling = () => {
      if (interval != null) {
        clearInterval(interval)
        interval = null
      }
    }

    const handleVisibilityChange = () => {
      const visibility = (typeof document !== 'undefined' && document.visibilityState) || 'unknown'
      if (visibility === 'visible') {
        startPolling()
      } else {
        stopPolling()
      }
    }

    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      startPolling()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleVisibilityChange)
    window.addEventListener('blur', handleVisibilityChange)

    return () => {
      stopPolling()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleVisibilityChange)
      window.removeEventListener('blur', handleVisibilityChange)
    }
  }, [poll])

  const handleOpenCreateModal = () => {
    setCurrentOrder(null)
    setCurrentOrderItems([])
    setIsModalOpen(true)
  }

  const handleApplyFilters = () => {
    setPage(1)
    fetchOrders()
  }

  const handleEditClick = async (order: Order) => {
    setCurrentOrder(order)
    try {
      const response = await api.get(`/pedidos`, { params: { id: order.id } })

      const { data } = parseListResponse<Order>(response, 'orders')
      const orderData = data[0]

      if (orderData && orderData.items) {
        const items = orderData.items.map((item: OrderItem) => ({
          id: item.id,
          productId: item.productId ?? (item.product ? item.product.id : undefined),
          quantity: Number(item.quantity) || 0,
          name: item.product?.name,
          unitPrice: item.unitPriceAtOrder != null ? Number(item.unitPriceAtOrder) : (item.product ? Number(item.product.price || 0) : undefined),
          status: item.status,
        })).filter((item) => item.productId != null && item.productId !== '')
        setCurrentOrderItems(items)
      } else {
        setCurrentOrderItems([])
      }
    } catch (error) {
      console.error("Error fetching order details", error)
      toast.error(localizedError("loadOrders", error))
      setCurrentOrderItems([])
    }
    setIsModalOpen(true)
  }

  const handleModalConfirm = async (customerName: string, items: { productId: number | string; quantity: number; unitPrice?: number }[]) => {
    try {
      if (currentOrder) {
        await api.put(`/pedidos/${currentOrder.id}`, { customerName, items })
      } else {
        await api.post("/pedidos", { customerName, items })
      }

      fetchOrders()
      setIsModalOpen(false)
    } catch (error) {
      console.error("Error saving order", error)
      toast.error(localizedError("saveOrder", error))
    }
  }

  const handleDeleteOrder = async (id: number | string) => {
    if (!(await confirm({ description: tOrders("confirm.delete"), confirmLabel: tCommon("delete"), destructive: true }))) return
    setDeletingId(id)
    try {
      await api.delete(`/pedidos/${id}`)
      fetchOrders()
    } catch (error) {
      console.error("Error deleting order", error)
      toast.error(localizedError("deleteOrder", error))
    } finally {
      setDeletingId(null)
    }
  }

  const handleCloseOrder = async (id: number | string) => {
    await api.post(`/pedidos/${id}/status`, { isOpen: false })
    await fetchOrders()
  }

  const handleChangeItemStatus = async (
    orderId: number | string,
    itemId: number | string,
    newStatus: OrderItemStatus,
  ) => {
    await api.patch(`/pedidos/${orderId}/items/${itemId}`, { status: newStatus })
    await fetchOrders()
  }

  return (
    <div className="space-y-4">
      <FiltersBar
        customerName={{ value: customerName, onChange: setCustomerName }}
        createdBy={{ value: createdBy, onChange: setCreatedBy }}
        totalRange={{ min: totalMin, max: totalMax, onMinChange: setTotalMin, onMaxChange: setTotalMax }}
        primaryAction={{ label: tOrders("new"), onClick: handleOpenCreateModal }}
        onFilter={handleApplyFilters}
        isLoading={isLoading}
      />

      <ProductSelectionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleModalConfirm}
        title={currentOrder ? tOrders("edit") : tOrders("new")}
        initialClientName={currentOrder?.customerName || ""}
        initialItems={currentOrderItems}
        isEditing={!!currentOrder}
        onCloseOrder={currentOrder ? () => handleCloseOrder(currentOrder.id) : undefined}
        onChangeItemStatus={currentOrder ? (itemId, status) => handleChangeItemStatus(currentOrder.id, itemId, status) : undefined}
      />

      <Card>
        <CardHeader>
          <CardTitle>{tOrders("recent")}</CardTitle>
        </CardHeader>
        <CardContent>
          <span className="sr-only" role="status">{showSkeleton ? tCommon("loading") : ""}</span>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px] text-center">{tCommon("index")}</TableHead>
                <TableHead>{tCommon("customer")}</TableHead>
                <TableHead>{tCommon("createdBy")}</TableHead>
                <TableHead>{tCommon("date")}</TableHead>
                <TableHead className="text-right">{tCommon("total")}</TableHead>
                <TableHead className="text-right">{tCommon("actions.label")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {showSkeleton ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="animate-in fade-in-0 duration-300">
                    <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[120px]" /></TableCell>
                    <TableCell className="text-right justify-end flex"><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell className="text-right justify-end flex gap-2">
                      <Skeleton className="h-8 w-8" />
                      <Skeleton className="h-8 w-8" />
                      <Skeleton className="h-8 w-8" />
                    </TableCell>
                  </TableRow>
                ))
              ) : orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    {tOrders("empty")}
                  </TableCell>
                </TableRow>
              ) : (
                orders.map((order, index) => (
                  <TableRow key={order.id} className="animate-in fade-in-0 duration-300">
                    <TableCell className="text-center">{formatNumber((page - 1) * limit + index + 1, activeLocale)}</TableCell>
                    <TableCell>
                      <div className="font-medium">{order.customerName || tCommon("notInformed")}</div>
                      {formatItemsSummary(order.items, activeLocale, tOrders("fallback.product")) && (
                        <div
                          className="text-sm text-muted-foreground truncate max-w-[280px]"
                          title={formatItemsSummary(order.items, activeLocale, tOrders("fallback.product"))}
                        >
                          {formatItemsSummary(order.items, activeLocale, tOrders("fallback.product"))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{order.seller?.name || tCommon("notInformed")}</TableCell>
                    <TableCell>{formatDateTime(order.updatedAt || order.openedAt || '', activeLocale)}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrencyBRL(order.total, activeLocale)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <IconButton
                          icon={<Printer className="h-4 w-4" />}
                          label={tPrinter("printOrder")}
                          onClick={() =>
                            printReceipt({
                              title: tPrinter("receiptTitleOrder", { id: order.id }),
                              customerName: order.customerName?.trim() || tCommon("notInformed"),
                              dateLabel: formatDateTime(order.updatedAt || order.openedAt || '', activeLocale),
                              items: (order.items ?? []).map((item) => ({
                                name: item.product?.name ?? tOrders("fallback.product"),
                                quantity: item.quantity,
                                unitPrice: item.unitPriceAtOrder ?? item.product?.price ?? 0,
                              })),
                              total: order.total,
                              totalLabel: tPrinter("receiptTotal"),
                              locale: activeLocale,
                            })
                          }
                        />
                        <IconButton icon={<Pencil className="h-4 w-4" />} label={tOrders("editLabel")} onClick={() => handleEditClick(order)} />
                        <IconButton
                          icon={deletingId === order.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          label={tOrders("deleteLabel")}
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDeleteOrder(order.id)}
                          disabled={deletingId === order.id}
                        />
                      </div>
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
            isLoading={isLoading}
          />
        </CardContent>
      </Card>
    </div>
  )
}
