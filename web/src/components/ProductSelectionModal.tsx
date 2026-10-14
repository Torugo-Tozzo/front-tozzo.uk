import { createEffect, createSignal, For, on, Show, untrack } from "solid-js"
import { createQuery, keepPreviousData } from "@tanstack/solid-query"
import { loadedData, onQueryError } from "@/api/query"
import { ChevronLeft, ChevronRight, Loader2, Minus, Plus, Trash2 } from "lucide-solid"
import { toast } from "solid-sonner"

import { catalogKeys, listProducts, listProductTypes, type Product } from "@/api/catalog"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusSelect } from "@/components/ui/status-select"
import { useConfirm } from "@/contexts/ConfirmContext"
import type { OrderItemStatus } from "@/domain/models"
import { useErrorMessage } from "@/i18n/error-message"
import { formatCount, formatNumber } from "@/i18n/format"
import { getCatalogLabel } from "@/i18n/labels"
import { normalizeLocale } from "@/i18n/locale"
import { useTranslation } from "@/i18n/solid"
import { createCursorPages, totalPagesOf } from "@/lib/cursor-pages"
import { createDebounced } from "@/lib/min-loading"
import { formatCents } from "@/lib/money"

export type PaymentMethod = "CASH" | "PIX" | "CREDIT_CARD" | "DEBIT_CARD" | "ON_ACCOUNT"
const PAYMENT_METHODS: readonly PaymentMethod[] = ["CASH", "PIX", "CREDIT_CARD", "DEBIT_CARD", "ON_ACCOUNT"]

/** An item of the order or sale being edited. Money in integer cents. */
export type SelectedItem = {
  id?: string
  productId: string
  quantity: number
  name: string
  unitPriceCents: number
  status?: OrderItemStatus
  localKey: string
}

export type ConfirmedItem = { id?: string; productId: string; quantity: number; unitPriceCents: number }

export interface ProductSelectionModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (customerName: string, items: ConfirmedItem[], delivery?: { isDelivery: boolean; deliveryAddress: string | null }) => Promise<void>
  title: string
  description?: string
  initialClientName?: string
  initialDelivery?: { isDelivery: boolean; deliveryAddress: string | null }
  allowDelivery?: boolean
  initialItems?: { id?: string; productId: string; quantity: number; unitPriceCents?: number; name?: string; status?: OrderItemStatus }[]
  isEditing?: boolean
  mergeSameProducts?: boolean
  onCloseOrder?: (paymentMethod: PaymentMethod | null) => Promise<void>
  onChangeItemStatus?: (itemId: string, newStatus: OrderItemStatus) => Promise<void> | void
  onCancelSale?: () => Promise<void>
  readOnly?: boolean
  additionalReadOnlyItems?: { description: string; quantity: number; unitPriceCents: number }[]
}

const PRODUCTS_PAGE_SIZE = 20

/**
 * Picks products for an order, a sale or a quote (orders S4, services S5). It
 * pages the catalog on the server (20 at a time, by name and type), never the
 * whole list. Nothing is saved here: onConfirm gets the items.
 */
export function ProductSelectionModal(props: ProductSelectionModalProps) {
  const confirm = useConfirm()
  const { t: tCommon, language } = useTranslation("common")
  const { t: tErrors } = useTranslation("errors")
  const { t: tOrders } = useTranslation("orders")
  const { t: tDeliveries } = useTranslation("deliveries")
  const { t: tProducts } = useTranslation("products")
  const { t: tSales } = useTranslation("sales")
  const localizedError = useErrorMessage()
  const activeLocale = () => normalizeLocale(language())
  const unitCountMessages = () => ({
    zero: tCommon("unitCount.zero"),
    one: tCommon("unitCount.one"),
    two: tCommon("unitCount.two"),
    few: tCommon("unitCount.few"),
    many: tCommon("unitCount.many"),
    other: tCommon("unitCount.other"),
  })

  const [selectedItems, setSelectedItems] = createSignal<SelectedItem[]>([])
  const [clientName, setClientName] = createSignal("")
  const [isDelivery, setIsDelivery] = createSignal(false)
  const [deliveryAddress, setDeliveryAddress] = createSignal("")
  const [paymentMethod, setPaymentMethod] = createSignal<PaymentMethod | null>(null)
  const [isLoading, setIsLoading] = createSignal(false)
  const [isClosingOrder, setIsClosingOrder] = createSignal(false)
  const [isCancellingSale, setIsCancellingSale] = createSignal(false)
  const [updatingItemStatusId, setUpdatingItemStatusId] = createSignal<string | null>(null)
  const [searchTerm, setSearchTerm] = createSignal("")
  const [productTypeFilter, setProductTypeFilter] = createSignal("")
  const debouncedSearch = createDebounced(searchTerm)
  const pages = createCursorPages(PRODUCTS_PAGE_SIZE)
  let draftCounter = 0

  // Reset the form and take the caller's items each time the modal opens. The
  // names and prices come from the caller (order or sale), not from the
  // catalog page, so an item outside the current page still shows.
  createEffect(on(() => props.isOpen, (open) => {
    if (!open) return
    untrack(() => {
      setClientName(props.initialClientName ?? "")
      setIsDelivery(props.initialDelivery?.isDelivery ?? false)
      setDeliveryAddress(props.initialDelivery?.deliveryAddress ?? "")
      setSearchTerm("")
      setProductTypeFilter("")
      pages.reset()
      setSelectedItems((props.initialItems ?? [])
        .filter((item) => item.productId != null)
        .map((item) => ({
          id: item.id,
          localKey: item.id != null ? String(item.id) : `draft-${item.productId}`,
          productId: item.productId,
          quantity: item.quantity,
          name: item.name ?? tProducts("selection.fallbackProduct"),
          unitPriceCents: item.unitPriceCents ?? 0,
          status: item.status,
        })))
    })
  }))

  const browsing = () => props.isOpen && !props.readOnly

  // Product types for the category filter (few: the whole list at once).
  const types = createQuery(() => ({
    queryKey: [...catalogKeys.productTypes, { includeInactive: false, search: "" }],
    queryFn: ({ signal }) => listProductTypes({}, signal),
    enabled: browsing(),
  }))
  const products = createQuery(() => ({
    queryKey: [...catalogKeys.products, { search: debouncedSearch(), productTypeId: productTypeFilter(), cursor: pages.cursor(), limit: PRODUCTS_PAGE_SIZE }],
    queryFn: ({ signal }) => listProducts({ search: debouncedSearch(), productTypeId: productTypeFilter(), cursor: pages.cursor(), limit: PRODUCTS_PAGE_SIZE }, signal),
    enabled: browsing(),
    placeholderData: keepPreviousData,
  }))

  onQueryError(types, (error) => {
    console.error("Error fetching product types", error)
    toast.error(localizedError("loadProductTypes", error))
  })
  onQueryError(products, (error) => {
    console.error("Error fetching products", error)
    toast.error(localizedError("loadProducts", error))
  })

  // The skeleton shows while the search waits for its debounce too, so the
  // empty message does not flash before the request.
  const isProductsLoading = () => products.isPending || products.isPlaceholderData || searchTerm() !== debouncedSearch()
  const productPage = () => (products.isError ? undefined : loadedData(products))
  const productRows = () => productPage()?.items ?? []
  const productsTotalPages = () => totalPagesOf(productPage()?.total ?? 0, PRODUCTS_PAGE_SIZE)
  const typeList = () => loadedData(types) ?? []

  const handleAddItem = (product: Product) => {
    setSelectedItems((previous) => {
      if (props.mergeSameProducts) {
        const existing = previous.find((item) => item.productId === product.id)
        if (existing) return previous.map((item) => item.localKey === existing.localKey ? { ...item, quantity: item.quantity + 1 } : item)
      }
      draftCounter += 1
      return [...previous, { productId: product.id, quantity: 1, name: product.name, unitPriceCents: product.priceCents, localKey: `draft-${draftCounter}-${previous.length}` }]
    })
  }

  const handleRemoveItem = (localKey: string) => {
    setSelectedItems((previous) => previous.filter((item) => item.localKey !== localKey))
  }

  const handleUpdateQuantity = (localKey: string, delta: number) => {
    setSelectedItems((previous) => previous.map((item) => item.localKey === localKey ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item))
  }

  const handleChangeItemStatus = async (itemId: string, newStatus: OrderItemStatus) => {
    if (!props.onChangeItemStatus) return
    setUpdatingItemStatusId(itemId)
    try {
      await props.onChangeItemStatus(itemId, newStatus)
      setSelectedItems((previous) => previous.map((item) => item.id === itemId ? { ...item, status: newStatus } : item))
    } catch (error) {
      console.error("Error changing order item status", error)
      toast.error(localizedError("changeOrderItemStatus", error))
    } finally {
      setUpdatingItemStatusId(null)
    }
  }

  const handleConfirm = async () => {
    if (isLoading()) return
    if (selectedItems().length === 0 && !props.isEditing) {
      // "products" is also a namespace (nsSeparator "."), so the key is read as-is.
      toast.warning(tErrors("products.selectItems", { nsSeparator: false }))
      return
    }
    if (isDelivery() && !deliveryAddress().trim()) {
      toast.warning(tOrders("deliveryAddressRequired"))
      return
    }

    setIsLoading(true)
    try {
      const items = selectedItems().map(({ id, productId, quantity, unitPriceCents }) => ({ ...(id != null ? { id } : {}), productId, quantity, unitPriceCents }))
      if (props.allowDelivery) {
        await props.onConfirm(clientName().trim(), items, { isDelivery: isDelivery(), deliveryAddress: isDelivery() ? deliveryAddress().trim() : null })
      } else {
        await props.onConfirm(clientName().trim(), items)
      }
      props.onClose()
    } catch (error) {
      // The caller reports the failure; the form keeps what was typed.
      console.error("Error confirming", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCloseOrder = async () => {
    const closeOrder = props.onCloseOrder
    if (!closeOrder || !(await confirm(tOrders("confirm.close")))) return
    setIsClosingOrder(true)
    try {
      await closeOrder(paymentMethod())
      props.onClose()
    } catch (error) {
      console.error("Error closing order", error)
      toast.error(localizedError("closeOrder", error))
    } finally {
      setIsClosingOrder(false)
    }
  }

  const handleCancelSale = async () => {
    const cancelSale = props.onCancelSale
    if (!cancelSale) return
    if (!(await confirm({ description: tSales("confirm.cancel"), confirmLabel: tSales("cancel"), destructive: true }))) return
    setIsCancellingSale(true)
    try {
      await cancelSale()
      props.onClose()
    } catch (error) {
      console.error("Error cancelling sale", error)
      toast.error(localizedError("cancelSale", error))
    } finally {
      setIsCancellingSale(false)
    }
  }

  const totalCents = () => selectedItems().reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0)
    + (props.additionalReadOnlyItems ?? []).reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0)

  const typeOptions = () => ["all", ...typeList().map((type) => type.id)]
  const typeLabel = (value: string) => {
    if (value === "all") return tProducts("selection.allCategories")
    const type = typeList().find((item) => item.id === value)
    return type ? getCatalogLabel(type.id, type.description, activeLocale()) : ""
  }

  return (
    <Dialog open={props.isOpen} onOpenChange={(open) => { if (!open) props.onClose() }}>
      <DialogContent class="w-[80vw] max-w-[80vw] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{props.title}</DialogTitle>
          <DialogDescription>{props.description ?? tProducts("selection.description")}</DialogDescription>
        </DialogHeader>

        <div class="flex-1 overflow-y-auto py-4 space-y-6">
          <div class="space-y-2">
            <Label for="client">{tCommon("customer")}</Label>
            <Input id="client" placeholder={tProducts("selection.clientPlaceholder")} value={clientName()} onInput={(e) => setClientName(e.currentTarget.value)} disabled={props.readOnly} />
          </div>
          <Show when={props.allowDelivery && !props.readOnly}>
            <div class="space-y-2">
              <label class="flex items-center gap-2 text-sm"><input type="checkbox" checked={isDelivery()} onChange={(event) => setIsDelivery(event.currentTarget.checked)} />{tOrders("isDelivery")}</label>
              <Show when={isDelivery()}>
                <div class="space-y-1"><Label for="delivery-address">{tOrders("deliveryAddress")}</Label><Input id="delivery-address" value={deliveryAddress()} onInput={(event) => setDeliveryAddress(event.currentTarget.value)} maxLength={500} /></div>
              </Show>
            </div>
          </Show>
          <Show when={props.allowDelivery && props.readOnly && isDelivery()}>
            <div class="space-y-1"><Label>{tOrders("deliveryAddress")}</Label><p class="break-words text-sm">{deliveryAddress()}</p></div>
          </Show>

          <div class={`grid ${props.readOnly ? "grid-cols-1" : "md:grid-cols-2"} gap-6`}>
            <Show when={!props.readOnly}>
              <div class="space-y-4 border rounded-lg p-4">
                <h3 class="font-semibold">{tProducts("selection.available")}</h3>
                <div class="flex gap-2">
                  <Input
                    placeholder={tProducts("selection.searchPlaceholder")}
                    value={searchTerm()}
                    onInput={(e) => { setSearchTerm(e.currentTarget.value); pages.reset() }}
                    class="flex-1"
                  />
                  <Select<string>
                    options={typeOptions()}
                    value={productTypeFilter() || "all"}
                    onChange={(value) => { setProductTypeFilter(!value || value === "all" ? "" : value); pages.reset() }}
                    placeholder={tProducts("selection.categoryPlaceholder")}
                    itemComponent={(item) => <SelectItem item={item.item}>{typeLabel(item.item.rawValue)}</SelectItem>}
                  >
                    <SelectTrigger class="w-[150px]" aria-label={tProducts("selection.categoryPlaceholder")}>
                      <SelectValue<string>>{(state) => typeLabel(state.selectedOption())}</SelectValue>
                    </SelectTrigger>
                    <SelectContent />
                  </Select>
                </div>
                <div class="h-[300px] overflow-y-auto space-y-2">
                  <Show
                    when={!isProductsLoading()}
                    fallback={
                      <For each={[0, 1, 2, 3, 4, 5]}>
                        {() => (
                          <div class="flex items-center justify-between p-2 border rounded">
                            <div class="space-y-2">
                              <Skeleton class="h-4 w-[150px] bg-gray-200 dark:bg-gray-700" />
                              <Skeleton class="h-3 w-[80px] bg-gray-200 dark:bg-gray-700" />
                            </div>
                            <Skeleton class="h-8 w-8 rounded-md bg-gray-200 dark:bg-gray-700" />
                          </div>
                        )}
                      </For>
                    }
                  >
                    <Show when={productRows().length > 0} fallback={<p class="text-gray-500 dark:text-gray-400 text-center py-8">{tProducts("selection.noProducts")}</p>}>
                      <div class="space-y-2 animate-in fade-in-0 duration-200">
                        <For each={productRows()}>
                          {(product) => (
                            <div
                              class="flex items-center justify-between p-2 border rounded hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                              onClick={() => handleAddItem(product)}
                            >
                              <div>
                                <p class="font-medium">{product.name}</p>
                                <p class="text-sm text-gray-500">{formatCents(product.priceCents, activeLocale())}</p>
                              </div>
                              <Button size="sm" variant="ghost" aria-label={tProducts("selection.addProduct")}>
                                <Plus class="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </For>
                      </div>
                    </Show>
                  </Show>
                </div>
                {/* Always rendered (disabled on one page): otherwise the panel
                    changes height with the filter and the modal jumps. */}
                <div class="flex items-center justify-between pt-1 h-7">
                  <span class="text-xs text-muted-foreground">
                    {productsTotalPages() > 0 && tCommon("pageOf", {
                      page: formatNumber(pages.page(), activeLocale()),
                      total: formatNumber(productsTotalPages(), activeLocale()),
                    })}
                  </span>
                  <div class="flex gap-1">
                    <Button
                      size="icon"
                      variant="outline"
                      class="h-7 w-7"
                      aria-label={tCommon("previous")}
                      title={tCommon("previous")}
                      onClick={() => pages.goTo(pages.page() - 1, null)}
                      disabled={pages.page() <= 1 || isProductsLoading()}
                    >
                      <ChevronLeft class="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      class="h-7 w-7"
                      aria-label={tCommon("next")}
                      title={tCommon("next")}
                      onClick={() => pages.goTo(pages.page() + 1, productPage()?.nextCursor)}
                      disabled={pages.page() >= productsTotalPages() || isProductsLoading()}
                    >
                      <ChevronRight class="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </Show>

            <div class="space-y-4 border rounded-lg p-4 bg-gray-50 dark:bg-gray-900/50">
              <h3 class="font-semibold">{tProducts("selection.selected")}</h3>
              <div class="h-[300px] overflow-y-auto space-y-2">
                <Show when={selectedItems().length > 0} fallback={<p class="text-gray-500 dark:text-gray-400 text-center py-8">{tProducts("selection.noItems")}</p>}>
                  <For each={selectedItems()}>
                    {(item) => (
                      <div class="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded shadow-sm border dark:border-gray-700">
                        <div class="flex-1">
                          <p class="font-medium">{item.name}</p>
                          <p class="text-sm text-gray-500 dark:text-gray-400">
                            {formatNumber(item.quantity, activeLocale())} x {formatCents(item.unitPriceCents, activeLocale())}
                          </p>
                        </div>
                        <div class="flex items-center gap-2">
                          <Show when={!props.readOnly && props.onChangeItemStatus && item.id != null && item.status}>
                            <StatusSelect
                              value={item.status!}
                              ariaLabel={`${tProducts("selection.itemStatus")}: ${item.name}`}
                              disabled={updatingItemStatusId() === item.id || isLoading() || isClosingOrder()}
                              onValueChange={(newStatus) => void handleChangeItemStatus(item.id!, newStatus)}
                            />
                          </Show>
                          <Show
                            when={!props.readOnly}
                            fallback={<span class="font-bold px-4">{formatCount(item.quantity, unitCountMessages(), activeLocale())}</span>}
                          >
                            <Button
                              size="icon"
                              variant="outline"
                              class="h-6 w-6"
                              aria-label={tProducts("selection.decreaseQuantity")}
                              title={tProducts("selection.decreaseQuantity")}
                              onClick={() => handleUpdateQuantity(item.localKey, -1)}
                            >
                              <Minus class="h-3 w-3" />
                            </Button>
                            <span class="w-4 text-center">{formatNumber(item.quantity, activeLocale())}</span>
                            <Button
                              size="icon"
                              variant="outline"
                              class="h-6 w-6"
                              aria-label={tProducts("selection.increaseQuantity")}
                              title={tProducts("selection.increaseQuantity")}
                              onClick={() => handleUpdateQuantity(item.localKey, 1)}
                            >
                              <Plus class="h-3 w-3" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              class="h-6 w-6 text-red-500"
                              aria-label={tProducts("selection.removeItem")}
                              title={tProducts("selection.removeItem")}
                              onClick={() => handleRemoveItem(item.localKey)}
                            >
                              <Trash2 class="h-4 w-4" />
                            </Button>
                          </Show>
                        </div>
                      </div>
                    )}
                  </For>
                </Show>
                <Show when={props.readOnly}>
                  <For each={props.additionalReadOnlyItems ?? []}>
                    {(item) => (
                      <div class="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded shadow-sm border dark:border-gray-700">
                        <div class="flex-1"><p class="font-medium">{item.description}</p><p class="text-sm text-gray-500 dark:text-gray-400">{formatNumber(item.quantity, activeLocale())} x {formatCents(item.unitPriceCents, activeLocale())}</p></div>
                        <span class="font-bold px-4">{formatCount(item.quantity, unitCountMessages(), activeLocale())}</span>
                      </div>
                    )}
                  </For>
                </Show>
              </div>
              <div class="pt-4 border-t flex justify-between items-center font-bold text-lg text-gray-900 dark:text-gray-100">
                <span>{tCommon("total")}:</span>
                <span>{formatCents(totalCents(), activeLocale())}</span>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter class="flex justify-between sm:justify-between">
          <Show when={props.isEditing && !props.readOnly && props.onCloseOrder}>
            <div class="mr-auto">
              <label class="mr-2 text-sm" for="payment-method">{tDeliveries("paymentMethod")}</label>
              <select
                id="payment-method"
                class="mr-2 rounded border bg-background px-2 py-2 text-sm"
                value={paymentMethod() ?? ""}
                onChange={(event) => setPaymentMethod((event.currentTarget.value || null) as PaymentMethod | null)}
                disabled={isClosingOrder()}
              >
                <option value="">{tProducts("selection.paymentNotInformed")}</option>
                <For each={PAYMENT_METHODS}>{(method) => <option value={method}>{tDeliveries(`payment.${method}` as never)}</option>}</For>
              </select>
              <Button variant="outline" onClick={() => void handleCloseOrder()} disabled={isLoading() || isClosingOrder() || updatingItemStatusId() != null}>
                <Show when={isClosingOrder()}><Loader2 class="mr-2 h-4 w-4 animate-spin" /></Show>
                {tOrders("close")}
              </Button>
            </div>
          </Show>
          <div class="flex gap-2 ml-auto">
            <Show when={props.readOnly && props.onCancelSale}>
              <div class="mr-auto">
                <Button
                  variant="ghost"
                  class="text-destructive hover:text-destructive"
                  onClick={() => void handleCancelSale()}
                  disabled={isCancellingSale() || isLoading() || isClosingOrder()}
                >
                  <Show when={isCancellingSale()} fallback={tSales("cancelButton")}>
                    <Loader2 class="mr-2 h-4 w-4 animate-spin" />
                    {tSales("cancelling")}
                  </Show>
                </Button>
              </div>
            </Show>
            <Button variant="outline" onClick={() => props.onClose()} disabled={isLoading() || isClosingOrder()}>
              {props.readOnly ? tCommon("close") : tCommon("cancel")}
            </Button>
            <Show when={!props.readOnly}>
              <Button onClick={() => void handleConfirm()} disabled={isLoading() || isClosingOrder()}>
                <Show when={isLoading()} fallback={tCommon("confirm")}>
                  <Loader2 class="mr-2 h-4 w-4 animate-spin" />
                  {tCommon("saving")}
                </Show>
              </Button>
            </Show>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
