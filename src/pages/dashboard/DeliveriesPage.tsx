import { createEffect, createMemo, createSignal, createUniqueId, For, Match, on, Show, Switch } from "solid-js"
import { createQuery, useQueryClient } from "@tanstack/solid-query"
import { createDraggable, createDroppable, DragDropProvider, DragDropSensors, useDragDropContext, type DragEvent } from "@thisbeyond/solid-dnd"
import { Bike, Check, ChevronLeft, ChevronRight, Eye, GripVertical, LockKeyhole, Pencil, Plus, RotateCcw, UserRound } from "lucide-solid"

import { deliveryAction, deliveryKeys, listDeliveryBoard, type BoardDriver, type DeliveryAction, type DeliveryOrder, type DeliveryStage } from "@/api/delivery"
import { apiErrorOf } from "@/api/errors"
import { kitchenKeys } from "@/api/kitchen"
import { closeOrder, orderKeys, saleKeys, type PaymentMethod } from "@/api/orders"
import { loadedData } from "@/api/query"
import { ProductSelectionModal } from "@/components/ProductSelectionModal"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/contexts/AuthContext"
import { formatDateTime, formatNumber } from "@/i18n/format"
import { useTranslation } from "@/i18n/solid"
import { closestCenterAmong, createDragCancel, createKeyboardMove, pointerWithinAmong, type DropResult } from "@/lib/board-dnd"
import { formatCents } from "@/lib/money"
import { cn } from "@/lib/utils"

const STAGES: readonly DeliveryStage[] = ["WAITING", "DELIVERING"]
const ORDERS_PER_COLUMN_PAGE = 10
// SSE (realtime.ts) is the main path; the React app also polled every 15 s.
const REFRESH_MS = 15_000
const PAYMENT_METHODS: readonly PaymentMethod[] = ["CASH", "PIX", "CREDIT_CARD", "DEBIT_CARD", "ON_ACCOUNT"]

type DialogKind = "assign" | "finish" | "details" | "confirmReady"
type Keyboard = ReturnType<typeof createKeyboardMove<DeliveryStage>>

const stageOf = (order: DeliveryOrder): DeliveryStage => order.delivery?.stage ?? "WAITING"
const isReady = (status: string) => status === "READY" || status === "DELIVERED"
const driverName = (order: DeliveryOrder) => order.delivery?.driver?.name ?? order.delivery?.externalDriverName ?? null
const driverPhone = (order: DeliveryOrder) => order.delivery?.driver?.phone ?? order.delivery?.externalDriverPhone ?? null
const isAssigned = (order: DeliveryOrder | null) => !!(order?.delivery?.driver || order?.delivery?.externalDriverName)

// A driver lands only on the waiting order under the pointer (React's
// pointerWithin): released anywhere else, nothing happens. An order lands on
// the closest column or card (closestCenter).
const driverTarget = pointerWithinAmong((data) => data.type === "order-target" && stageOf(data.order as DeliveryOrder) === "WAITING")
const orderTarget = closestCenterAmong(() => true)
const collisionDetector = (...args: Parameters<typeof orderTarget>) =>
  args[0].data.type === "driver" ? driverTarget(...args) : orderTarget(...args)

function DriverIdentity(props: { driver: BoardDriver }) {
  const { t } = useTranslation("deliveries")
  return (
    <>
      <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"><UserRound class="h-5 w-5" aria-hidden="true" /></span>
      <span class="min-w-0 text-left">
        <span class="block truncate font-medium">{props.driver.name}</span>
        <span class="flex items-center gap-1.5 text-xs text-muted-foreground"><span class={cn("h-2 w-2 rounded-full", props.driver.available ? "bg-green-500" : "bg-amber-500")} />{t(props.driver.available ? "available" : "busy")}</span>
      </span>
    </>
  )
}

function DraggableDriverTile(props: { driver: BoardDriver }) {
  const { t } = useTranslation("deliveries")
  // `use:draggable` reads this name (solid-dnd directive). Created only for an
  // available driver: a draggable that is never bound warns on cleanup.
  const draggable = createDraggable(`driver:${props.driver.id}`, { type: "driver", get driver() { return props.driver } })
  void draggable
  return (
    <div use:draggable aria-disabled={false} title={t("dragDriver")} class={cn("flex items-center gap-3 rounded-lg border bg-card px-3 py-2 text-sm transition-shadow touch-none cursor-grab hover:border-primary hover:shadow-md active:cursor-grabbing", draggable.isActiveDraggable && "relative z-20 shadow-xl")}>
      <DriverIdentity driver={props.driver} />
      <GripVertical class="ml-auto h-4 w-4 text-muted-foreground" aria-hidden="true" />
    </div>
  )
}

function DriverRosterTile(props: { driver: BoardDriver }) {
  const { t } = useTranslation("deliveries")
  return (
    <Show
      when={props.driver.available}
      fallback={
        <div aria-disabled="true" title={t("driverBusy")} class="flex items-center gap-3 rounded-lg border bg-card px-3 py-2 text-sm transition-shadow cursor-not-allowed opacity-55">
          <DriverIdentity driver={props.driver} />
          <LockKeyhole class="ml-auto h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </div>
      }
    >
      <DraggableDriverTile driver={props.driver} />
    </Show>
  )
}

function OrderCard(props: {
  order: DeliveryOrder
  canManage: boolean
  describedBy: string
  keyboard: Keyboard
  onAssign: (order: DeliveryOrder) => void
  onMove: (order: DeliveryOrder, stage: DeliveryStage) => DropResult
  onClose: (order: DeliveryOrder) => void
  onDetails: (order: DeliveryOrder) => void
}) {
  const { t, language } = useTranslation("deliveries")
  const [dnd] = useDragDropContext()!
  const stage = () => stageOf(props.order)
  const canDrag = () => props.canManage || stage() === "WAITING"
  // `use:draggable` / `use:droppable` read these names (solid-dnd directives).
  const draggable = createDraggable(`order:${props.order.id}`, { type: "order", get order() { return props.order } })
  const droppable = createDroppable(`order-target:${props.order.id}`, { type: "order-target", get order() { return props.order } })
  void draggable
  void droppable
  const key = () => props.order.id
  const lifted = () => draggable.isActiveDraggable || props.keyboard.isPicked(key())
  const driverDropTarget = () => props.canManage && stage() === "WAITING" && dnd.active.draggable?.data.type === "driver"
  const items = () => props.order.items ?? []
  // solid-dnd has no "disabled": a card that cannot move (a DRIVER's card out
  // for delivery) stops the pointer before the drag sensor, in the capture phase.
  const blockDrag = (element: HTMLElement) => {
    element.addEventListener("pointerdown", (event) => { if (!canDrag()) event.stopPropagation() }, { capture: true })
  }

  return (
    <article
      use:draggable
      use:droppable={{ skipTransform: true }}
      ref={blockDrag}
      class={cn(
        "rounded-lg border bg-card p-3 shadow-sm transition-shadow",
        canDrag() && "touch-none cursor-grab hover:shadow-md active:cursor-grabbing",
        lifted() && "relative z-10 opacity-80 shadow-xl",
        driverDropTarget() && "border-dashed border-primary/60",
        driverDropTarget() && droppable.isActiveDroppable && "border-2 border-primary bg-primary/5",
      )}
    >
      <div class="flex gap-2">
        <span
          role="button"
          tabIndex={canDrag() ? 0 : -1}
          data-dnd-key={key()}
          aria-roledescription="draggable"
          aria-describedby={props.describedBy}
          aria-disabled={!canDrag()}
          aria-pressed={props.keyboard.isPicked(key())}
          aria-label={t("dragCard")}
          title={t("dragCard")}
          class="mt-1 shrink-0 text-muted-foreground"
          onKeyDown={(event) => { if (canDrag()) props.keyboard.keyDown(key(), stage(), (to) => props.onMove(props.order, to))(event) }}
          onBlur={props.keyboard.blur(key())}
        >
          <GripVertical class="h-4 w-4" />
        </span>
        <div class="min-w-0"><h3 class="font-semibold">{props.order.customerName || t("orderFallback", { id: props.order.id.slice(0, 6) })}</h3><p class="break-words text-sm">{props.order.deliveryAddress}</p></div>
      </div>
      <p class="mt-2 text-xs text-muted-foreground">{formatDateTime(props.order.openedAt, language())} · {formatCents(props.order.totalCents, language())}</p>
      <p class="mt-1 text-sm">{t("driver")}: {driverName(props.order) || t("notInformed")}{driverPhone(props.order) ? ` · ${driverPhone(props.order)}` : ""}</p>
      <ul class="mt-2 list-inside list-disc text-sm">
        <For each={items().slice(0, 3)}>{(item) => <li>{item.quantity}× {item.productName} · {t(isReady(item.status) ? "ready" : "preparing")}</li>}</For>
      </ul>
      <Show when={items().length > 3}><p class="mt-1 text-sm text-muted-foreground" aria-label={t("moreItems", { count: items().length - 3 })}>…</p></Show>
      <div class="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div class="flex min-w-0 justify-start">
          <Show when={props.canManage && stage() === "WAITING"}>
            <Button size="sm" variant="outline" class="max-w-full px-2 sm:px-3" aria-label={t(isAssigned(props.order) ? "editDriver" : "assign")} on:pointerdown={(event) => event.stopPropagation()} onClick={() => props.onAssign(props.order)}>
              <Show when={isAssigned(props.order)} fallback={<Plus class="h-4 w-4 shrink-0 sm:mr-1" />}><Pencil class="h-4 w-4 shrink-0 sm:mr-1" /></Show>
              <span class="hidden truncate sm:inline">{t("driver")}</span>
            </Button>
          </Show>
          <Show when={props.canManage && stage() === "DELIVERING"}>
            <Button size="sm" variant="outline" class="max-w-full px-2 sm:px-3" aria-label={t("returnToWaiting")} on:pointerdown={(event) => event.stopPropagation()} onClick={() => props.onMove(props.order, "WAITING")}>
              <RotateCcw class="h-4 w-4 shrink-0 sm:mr-1" /><span class="hidden truncate sm:inline">{t("returnToWaiting")}</span>
            </Button>
          </Show>
        </div>
        <Button size="sm" variant="outline" class="px-2 sm:px-3" aria-label={t("viewDetails")} on:pointerdown={(event) => event.stopPropagation()} onClick={() => props.onDetails(props.order)}>
          <Eye class="h-4 w-4 sm:mr-1" /><span class="hidden sm:inline">{t("viewDetails")}</span>
        </Button>
        <div class="flex min-w-0 justify-end">
          <Show when={stage() === "WAITING"}>
            <Button size="sm" class="max-w-full px-2 sm:px-3" aria-label={t("start")} disabled={!items().length} on:pointerdown={(event) => event.stopPropagation()} onClick={() => props.onMove(props.order, "DELIVERING")}>
              <Bike class="h-4 w-4 shrink-0 sm:mr-1" /><span class="hidden truncate sm:inline">{t("start")}</span>
            </Button>
          </Show>
          <Show when={props.canManage && stage() === "DELIVERING"}>
            <Button size="sm" class="max-w-full px-2 sm:px-3" aria-label={t("finish")} on:pointerdown={(event) => event.stopPropagation()} onClick={() => props.onClose(props.order)}>
              <Check class="h-4 w-4 shrink-0 sm:mr-1" /><span class="hidden truncate sm:inline">{t("finish")}</span>
            </Button>
          </Show>
        </div>
      </div>
    </article>
  )
}

function Column(props: {
  stage: DeliveryStage
  orders: DeliveryOrder[]
  page: number
  onPageChange: (page: number) => void
  canManage: boolean
  describedBy: string
  keyboard: Keyboard
  onAssign: (order: DeliveryOrder) => void
  onMove: (order: DeliveryOrder, stage: DeliveryStage) => DropResult
  onClose: (order: DeliveryOrder) => void
  onDetails: (order: DeliveryOrder) => void
}) {
  const { t, language } = useTranslation("deliveries")
  const { t: tCommon } = useTranslation("common")
  // `use:droppable` reads this name (solid-dnd directive).
  const droppable = createDroppable(`stage:${props.stage}`, { type: "stage", stage: props.stage })
  void droppable
  const totalPages = () => Math.max(1, Math.ceil(props.orders.length / ORDERS_PER_COLUMN_PAGE))
  const currentPage = () => Math.min(props.page, totalPages())
  const visible = () => props.orders.slice((currentPage() - 1) * ORDERS_PER_COLUMN_PAGE, currentPage() * ORDERS_PER_COLUMN_PAGE)
  const isOver = () => droppable.isActiveDroppable || props.keyboard.isTarget(props.stage)

  return (
    <div use:droppable={{ skipTransform: true }} class={`flex min-h-80 flex-col rounded-lg border-2 border-dashed p-3 ${isOver() ? "border-primary bg-primary/5" : ""}`}>
      <h2 class="mb-3 font-semibold">{t(`stages.${props.stage}`)} <span class="text-muted-foreground">({formatNumber(props.orders.length, language())})</span></h2>
      <div class="flex-1 space-y-3">
        <For each={visible()}>
          {(order) => <OrderCard order={order} canManage={props.canManage} describedBy={props.describedBy} keyboard={props.keyboard} onAssign={props.onAssign} onMove={props.onMove} onClose={props.onClose} onDetails={props.onDetails} />}
        </For>
      </div>
      <div class="mt-auto flex items-center justify-between gap-2 border-t border-dashed pt-3">
        <Button type="button" variant="outline" size="sm" aria-label={t("previousOrders", { stage: t(`stages.${props.stage}`) })} disabled={currentPage() <= 1} onClick={() => props.onPageChange(currentPage() - 1)}><ChevronLeft class="mr-1 h-4 w-4" />{tCommon("previous")}</Button>
        <span class="text-xs text-muted-foreground" aria-live="polite">{t("pageOrders", { page: formatNumber(currentPage(), language()), total: formatNumber(totalPages(), language()) })}</span>
        <Button type="button" variant="outline" size="sm" aria-label={t("nextOrders", { stage: t(`stages.${props.stage}`) })} disabled={currentPage() >= totalPages()} onClick={() => props.onPageChange(currentPage() + 1)}>{tCommon("next")}<ChevronRight class="ml-1 h-4 w-4" /></Button>
      </div>
    </div>
  )
}

// The order changed under the screen: the board is read again.
const RELOAD_CODES = new Set(["DELIVERY_CONFLICT", "ORDER_NOT_READY", "DELIVERY_ALREADY_STARTED", "DELIVERY_NOT_STARTED", "ORDER_NOT_DELIVERABLE", "ORDER_NOT_FOUND", "DRIVER_BUSY", "DRIVER_NOT_FOUND"])
const MESSAGE_BY_CODE: Record<string, string> = {
  ORDER_NOT_READY: "notReady",
  DRIVER_BUSY: "driverBusy",
  DELIVERY_CONFLICT: "conflictError",
  DELIVERY_ALREADY_STARTED: "conflictError",
  DELIVERY_NOT_STARTED: "conflictError",
}

/** The delivery board (React DeliveriesPage): waiting and delivering orders, drivers, assign, start, wait and finish. */
export default function DeliveriesPage() {
  const { user } = useAuth()
  const { t } = useTranslation("deliveries")
  const { t: tCommon } = useTranslation("common")
  const queryClient = useQueryClient()
  const canManage = () => user()?.role !== "DRIVER"
  const describedBy = `deliveries-dnd-${createUniqueId()}`
  const [columnPages, setColumnPages] = createSignal<Record<DeliveryStage, number>>({ WAITING: 1, DELIVERING: 1 })
  // The message stays until the board is read again after it (React's load() cleared it).
  const [errorState, setErrorState] = createSignal<{ message: string; until: number } | null>(null)
  const [busy, setBusy] = createSignal(false)
  // The order as it was when its dialog opened: its updatedAt is the version
  // the dialog's action sends, so a change made since answers DELIVERY_CONFLICT.
  const [selected, setSelected] = createSignal<DeliveryOrder | null>(null)
  const [dialog, setDialog] = createSignal<DialogKind | null>(null)
  const [driverMode, setDriverMode] = createSignal<"fixed" | "external">("fixed")
  const [driverId, setDriverId] = createSignal("")
  const [externalName, setExternalName] = createSignal("")
  const [externalPhone, setExternalPhone] = createSignal("")
  const [paymentMethod, setPaymentMethod] = createSignal<PaymentMethod | "">("")

  const board = createQuery(() => ({
    queryKey: deliveryKeys.board,
    queryFn: ({ signal }) => listDeliveryBoard(signal),
    refetchInterval: REFRESH_MS,
    reconcile: "id",
  }))
  const orders = () => loadedData(board)?.orders ?? []
  const drivers = () => loadedData(board)?.drivers ?? []
  const hasData = () => loadedData(board) !== undefined
  const error = () => {
    const state = errorState()
    return state && board.dataUpdatedAt <= state.until ? state.message : ""
  }
  const setError = (message: string) => setErrorState(message ? { message, until: board.dataUpdatedAt } : null)
  const loadError = () => (board.isError && !error() ? t("loadError") : "")
  const shownError = () => error() || loadError()
  // A plain copy: the board's orders are reconciled in place.
  const snapshot = (order: DeliveryOrder): DeliveryOrder => JSON.parse(JSON.stringify(order))
  const openDialog = (order: DeliveryOrder, kind: DialogKind) => {
    setSelected(snapshot(order))
    setDialog(kind)
  }

  // An acting dialog whose order left the board or changed column closes and says so.
  // (The board is reconciled in place: the stages are read here, not the array.)
  const placement = createMemo(() => orders().map((order) => `${order.id}:${stageOf(order)}`).join("|"))
  createEffect(on(() => [dialog(), placement()] as const, ([kind]) => {
    const order = selected()
    if (busy() || !order || (kind !== "assign" && kind !== "confirmReady" && kind !== "finish")) return
    const live = orders().find((item) => item.id === order.id)
    if (live && stageOf(live) === stageOf(order)) return
    setDialog(null)
    setError(t("conflictError"))
  }))

  const columns = createMemo(() => STAGES.map((stage) => ({ stage, orders: orders().filter((order) => stageOf(order) === stage) })))
  const detailItems = () => (selected()?.items ?? []).map((item) => ({
    id: item.id, productId: item.productId, quantity: item.quantity, name: item.productName, unitPriceCents: item.unitPriceCents, status: item.status,
  }))

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: deliveryKeys.all }),
      queryClient.invalidateQueries({ queryKey: kitchenKeys.all }),
      queryClient.invalidateQueries({ queryKey: orderKeys.all }),
    ])
  }

  /** Runs a delivery action once at a time; on a refused one, says why and reads the board again. */
  const act = async (order: DeliveryOrder, action: DeliveryAction, onDone?: () => void): Promise<boolean> => {
    if (busy()) return false
    setBusy(true)
    try {
      await deliveryAction(order.id, order.updatedAt, action)
      setError("")
      onDone?.()
      await refresh()
      return true
    } catch (cause) {
      const code = apiErrorOf(cause).code
      console.error("Error changing delivery", cause)
      if (RELOAD_CODES.has(code)) {
        if (code !== "DRIVER_BUSY") setDialog(null)
        await refresh()
      }
      setError(t((MESSAGE_BY_CODE[code] ?? "changeError") as never))
      return false
    } finally {
      setBusy(false)
    }
  }

  const move = (order: DeliveryOrder, stage: DeliveryStage, confirmReady = false): DropResult => {
    if (busy() || stageOf(order) === stage) return false
    if (stage === "DELIVERING" && !confirmReady && (order.items ?? []).some((item) => !isReady(item.status))) {
      openDialog(order, "confirmReady")
      return undefined
    }
    return act(order, stage === "DELIVERING" ? { action: "START", ...(confirmReady ? { confirmReady: true } : {}) } : { action: "WAIT" }, () => setDialog(null))
  }

  const openAssign = (order: DeliveryOrder) => {
    setError("")
    openDialog(order, "assign")
    const delivery = order.delivery
    setDriverMode(delivery?.driver || !delivery?.externalDriverName ? "fixed" : "external")
    setDriverId(delivery?.driver?.id ?? "")
    setExternalName(delivery?.externalDriverName ?? "")
    setExternalPhone(delivery?.externalDriverPhone ?? "")
  }

  const assign = () => {
    const order = selected()
    if (!order || busy()) return
    if (driverMode() === "fixed") {
      if (!drivers().some((driver) => driver.id === driverId() && driver.available)) { setError(t("driverRequired")); return }
      void act(order, { action: "ASSIGN", driverId: driverId() }, () => setDialog(null))
    } else {
      const name = externalName().trim()
      if (!name) { setError(t("driverRequired")); return }
      const phone = externalPhone().trim()
      void act(order, { action: "ASSIGN", externalDriverName: name, ...(phone ? { externalDriverPhone: phone } : {}) }, () => setDialog(null))
    }
  }

  const unassign = () => {
    const order = selected()
    if (!order || busy()) return
    void act(order, { action: "UNASSIGN" }, () => setDialog(null))
  }

  const finish = async () => {
    const order = selected()
    if (!order || busy()) return
    setBusy(true)
    try {
      await closeOrder(order.id, paymentMethod() || null)
      setDialog(null)
      void queryClient.invalidateQueries({ queryKey: saleKeys.all })
      await refresh()
    } catch (cause) {
      console.error("Error closing delivery order", cause)
      setError(t("closeError"))
    } finally {
      setBusy(false)
    }
  }

  const dragCancel = createDragCancel()
  const onDragEnd = ({ draggable, droppable }: DragEvent) => {
    if (dragCancel.wasCancelled() || !droppable) return
    const source = draggable.data
    const target = droppable.data
    if (source.type === "driver" && target.type === "order-target") {
      const driver = source.driver as BoardDriver
      const order = target.order as DeliveryOrder
      if (canManage() && driver.available && stageOf(order) === "WAITING") void act(order, { action: "ASSIGN", driverId: driver.id })
    } else if (source.type === "order") {
      const stage = target.type === "stage" ? (target.stage as DeliveryStage) : target.type === "order-target" ? stageOf(target.order as DeliveryOrder) : null
      if (stage) void move(source.order as DeliveryOrder, stage)
    }
  }

  const keyboard = createKeyboardMove<DeliveryStage>({
    stages: STAGES,
    messages: {
      picked: () => tCommon("dnd.picked"),
      over: (stage) => tCommon("dnd.over", { column: t(`stages.${stage}`) }),
      dropped: () => tCommon("dnd.dropped"),
      cancelled: () => tCommon("dnd.cancelled"),
    },
  })

  const closeDialog = (open: boolean) => { if (!open && !busy()) setDialog(null) }

  return (
    <Switch>
      <Match when={!hasData() && board.isPending}>
        <div role="status">{t("loading")}</div>
      </Match>
      <Match when={true}>
        <section class="space-y-5">
          <h1 class="flex items-center gap-2 text-3xl font-bold"><Bike class="h-8 w-8" />{t("pageTitle", { establishment: user()?.establishment?.tradeName || t("establishmentFallback") })}</h1>
          <Show when={shownError()}><p role="alert" class="text-destructive">{shownError()}</p></Show>
          {/* What dnd-kit rendered for screen readers: the instructions and a live region. */}
          <div id={describedBy} style={{ display: "none" }}>{t("dragCard")}. {tCommon("dnd.keyboardInstructions")}</div>
          <div role="status" aria-live="assertive" aria-atomic="true" class="sr-only">{keyboard.announcement()}</div>
          <DragDropProvider onDragEnd={onDragEnd} collisionDetector={collisionDetector}>
            <DragDropSensors>
              <dragCancel.DragCancel />
              <Card><CardHeader><CardTitle>{t("boardTitle")}</CardTitle></CardHeader><CardContent>
                <div class="grid gap-4 lg:grid-cols-2">
                  {/* STAGES, not columns(): a refetch must not remount the columns (and drop a picked card's focus). */}
                  <For each={STAGES}>
                    {(stage) => (
                      <Column
                        stage={stage}
                        orders={columns().find((column) => column.stage === stage)!.orders}
                        page={columnPages()[stage]}
                        onPageChange={(page) => setColumnPages((current) => ({ ...current, [stage]: page }))}
                        canManage={canManage()}
                        describedBy={describedBy}
                        keyboard={keyboard}
                        onAssign={openAssign}
                        onMove={move}
                        onDetails={(order) => openDialog(order, "details")}
                        onClose={(order) => { setPaymentMethod(""); openDialog(order, "finish") }}
                      />
                    )}
                  </For>
                </div>
              </CardContent></Card>
              <Show when={canManage()}>
                <Card><CardHeader><CardTitle>{t("driversTitle")}</CardTitle></CardHeader><CardContent class="flex flex-wrap gap-2">
                  <Show when={drivers().length} fallback={<p>{t("noDrivers")}</p>}>
                    <For each={drivers()}>{(driver) => <DriverRosterTile driver={driver} />}</For>
                  </Show>
                </CardContent></Card>
              </Show>
            </DragDropSensors>
          </DragDropProvider>

          <Dialog open={dialog() === "assign"} onOpenChange={closeDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t(isAssigned(selected()) ? "editDriver" : "assignTitle")}</DialogTitle>
                <DialogDescription>{selected()?.deliveryAddress}</DialogDescription>
              </DialogHeader>
              <Show when={error()}><p role="alert" class="text-sm text-destructive">{error()}</p></Show>
              <div class="space-y-3">
                <div class="flex gap-4">
                  <label><input type="radio" checked={driverMode() === "fixed"} onChange={() => setDriverMode("fixed")} /> {t("fixedDriver")}</label>
                  <label><input type="radio" checked={driverMode() === "external"} onChange={() => setDriverMode("external")} /> {t("externalDriver")}</label>
                </div>
                <Show
                  when={driverMode() === "fixed"}
                  fallback={
                    <>
                      <div><Label for="external-name">{t("externalName")}</Label><Input id="external-name" value={externalName()} onInput={(event) => setExternalName(event.currentTarget.value)} maxLength={120} placeholder={t("externalExample")} /></div>
                      <div><Label for="external-phone">{t("externalPhone")}</Label><Input id="external-phone" type="tel" value={externalPhone()} onInput={(event) => setExternalPhone(event.currentTarget.value)} maxLength={40} /></div>
                    </>
                  }
                >
                  <div role="group" aria-label={t("fixedDriver")} class="grid max-h-60 gap-2 overflow-y-auto sm:grid-cols-2">
                    <Show when={drivers().length} fallback={<p class="text-sm text-muted-foreground">{t("noDrivers")}</p>}>
                      <For each={drivers()}>
                        {(driver) => (
                          <button
                            type="button"
                            disabled={!driver.available}
                            aria-pressed={driverId() === driver.id}
                            title={!driver.available ? t("driverBusy") : undefined}
                            onClick={() => setDriverId(driver.id)}
                            class={cn("flex items-center gap-3 rounded-lg border p-2 text-sm transition-colors", driverId() === driver.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:border-primary/60", driver.available ? "cursor-pointer" : "cursor-not-allowed opacity-55")}
                          >
                            <DriverIdentity driver={driver} />
                            <Show when={!driver.available}><LockKeyhole class="ml-auto h-4 w-4 shrink-0" aria-hidden="true" /></Show>
                          </button>
                        )}
                      </For>
                    </Show>
                  </div>
                </Show>
              </div>
              <DialogFooter>
                <Button variant="outline" disabled={busy()} onClick={() => setDialog(null)}>{tCommon("cancel")}</Button>
                <Show when={isAssigned(selected())}>
                  <Button variant="outline" disabled={busy()} onClick={unassign}>{t("removeDriver")}</Button>
                </Show>
                <Button disabled={busy() || (driverMode() === "fixed" && !drivers().some((driver) => driver.id === driverId() && driver.available))} onClick={assign}>{t("saveDriver")}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={dialog() === "confirmReady"} onOpenChange={closeDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("confirmReadyTitle")}</DialogTitle>
                <DialogDescription>{t("confirmReadyDescription")}</DialogDescription>
              </DialogHeader>
              <ul class="list-inside list-disc text-sm">
                <For each={(selected()?.items ?? []).filter((item) => !isReady(item.status))}>{(item) => <li>{item.quantity}× {item.productName}</li>}</For>
              </ul>
              <DialogFooter>
                <Button variant="outline" disabled={busy()} onClick={() => setDialog(null)}>{tCommon("cancel")}</Button>
                <Button disabled={busy()} onClick={() => { const order = selected(); if (order) void move(order, "DELIVERING", true) }}>{t("confirmReadyAction")}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={dialog() === "finish"} onOpenChange={closeDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("finishTitle")}</DialogTitle>
                <DialogDescription>{t("finishDescription")}</DialogDescription>
              </DialogHeader>
              <div>
                <Label for="delivery-payment">{t("paymentMethod")}</Label>
                <select id="delivery-payment" class="w-full rounded border bg-background p-2" value={paymentMethod()} onChange={(event) => setPaymentMethod(event.currentTarget.value as PaymentMethod | "")}>
                  <option value="">{t("notInformed")}</option>
                  <For each={PAYMENT_METHODS}>{(method) => <option value={method}>{t(`payment.${method}` as never)}</option>}</For>
                </select>
              </div>
              <DialogFooter><Button disabled={busy()} onClick={() => void finish()}>{t("confirmFinish")}</Button></DialogFooter>
            </DialogContent>
          </Dialog>

          <ProductSelectionModal
            isOpen={dialog() === "details"}
            onClose={() => setDialog(null)}
            onConfirm={async () => {}}
            readOnly
            allowDelivery
            title={t("detailsTitle")}
            description={t("detailsDescription")}
            initialClientName={selected()?.customerName ?? ""}
            initialDelivery={{ isDelivery: true, deliveryAddress: selected()?.deliveryAddress ?? null }}
            initialItems={detailItems()}
          />
        </section>
      </Match>
    </Switch>
  )
}
