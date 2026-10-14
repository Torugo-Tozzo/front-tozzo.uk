import { createEffect, createMemo, createSignal, For, on, Show } from "solid-js"
import { createMutation, createQuery, useQueryClient } from "@tanstack/solid-query"
import {
  closestCenter,
  createDraggable,
  createDroppable,
  DragDropProvider,
  DragDropSensors,
  useDragDropContext,
  type CollisionDetector,
  type DragEvent,
} from "@thisbeyond/solid-dnd"
import { Bike, Check, ChevronLeft, ChevronRight, Eye, GripVertical, LockKeyhole, Pencil, Plus, RotateCcw, UserRound } from "lucide-solid"

import { apiErrorOf } from "@/api/errors"
import {
  closeOrder,
  deliveryAction,
  listDeliveryBoard,
  operationKeys,
  type BoardDriver,
  type DeliveryActionRequest,
  type Order,
  type OrderItem,
  type PaymentMethod,
} from "@/api/orders"
import { loadedData } from "@/api/query"
import { salesKeys } from "@/api/sales"
import { ProductSelectionModal } from "@/components/ProductSelectionModal"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/contexts/AuthContext"
import { formatDateTime, formatNumber } from "@/i18n/format"
import { useTranslation } from "@/i18n/solid"
import { formatCents } from "@/lib/money"
import { cn } from "@/lib/utils"

type Stage = "WAITING" | "DELIVERING"
type Driver = BoardDriver
/** An order of the board as the React screen read it (the Bun's delivery view). */
interface DeliveryOrder {
  id: string
  customerName: string | null
  address: string
  totalCents: number
  openedAt: string
  updatedAt: string
  stage: Stage
  driverId: string | null
  driverName: string | null
  driverPhone: string | null
  externalDriverName: string | null
  externalDriverPhone: string | null
  items: OrderItem[]
}
type Assignment = { driverId: string } | { externalDriverName: string; externalDriverPhone: string } | Record<string, never>
type DeliveryError = "loadError" | "changeError" | "closeError" | "driverRequired" | "driverBusy" | "notReady" | "conflictError"

const ordersPerColumnPage = 10
const PAYMENT_METHODS: PaymentMethod[] = ["CASH", "PIX", "CREDIT_CARD", "DEBIT_CARD", "ON_ACCOUNT"]

// The driver shown is the staff driver or, failing that, the third-party one
// (the Bun's driverName/driverPhone).
function toDeliveryOrder(order: Order): DeliveryOrder {
  const delivery = order.delivery
  return {
    id: order.id,
    customerName: order.customerName,
    address: order.deliveryAddress ?? "",
    totalCents: order.totalCents,
    openedAt: order.openedAt,
    updatedAt: order.updatedAt,
    stage: delivery?.stage ?? "WAITING",
    driverId: delivery?.driver?.id ?? null,
    driverName: delivery?.driver?.name ?? delivery?.externalDriverName ?? null,
    driverPhone: delivery?.driver?.phone ?? delivery?.externalDriverPhone ?? null,
    externalDriverName: delivery?.externalDriverName ?? null,
    externalDriverPhone: delivery?.externalDriverPhone ?? null,
    items: order.items ?? [],
  }
}

const isReady = (item: OrderItem) => item.status === "READY" || item.status === "DELIVERED"

/** The /v1 code of a failed delivery action, as the message the React screen showed. */
function actionErrorKey(code: string): DeliveryError {
  if (code === "ORDER_NOT_READY") return "notReady"
  if (code === "DELIVERY_CONFLICT") return "conflictError"
  if (code === "DRIVER_BUSY") return "driverBusy"
  return "changeError"
}

// A dragged driver lands only on a waiting order under it (dnd-kit's
// pointerWithin); an order goes to the closest column or card, never itself.
const deliveryCollisionDetector: CollisionDetector = (draggable, droppables, context) => {
  if (draggable.data.type === "driver") {
    const center = draggable.transformed.center
    return droppables.find((droppable) => {
      if (droppable.data.type !== "order-target" || droppable.data.order?.stage !== "WAITING") return false
      const { left, right, top, bottom } = droppable.layout
      return center.x >= left && center.x <= right && center.y >= top && center.y <= bottom
    }) ?? null
  }
  return closestCenter(draggable, droppables.filter((droppable) => droppable.data.order?.id !== draggable.data.order?.id), context)
}

function DriverIdentity(props: { driver: Driver }) {
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

function DriverRosterTile(props: { driver: Driver }) {
  const { t } = useTranslation("deliveries")
  // eslint-disable-next-line solid/reactivity -- a tile is recreated with each board load (new objects).
  const draggable = createDraggable(`driver:${props.driver.id}`, { type: "driver", driver: props.driver })
  return (
    <div
      ref={(element) => { if (props.driver.available) draggable(element) }}
      aria-disabled={!props.driver.available}
      title={props.driver.available ? t("dragDriver") : t("driverBusy")}
      class={cn("flex items-center gap-3 rounded-lg border bg-card px-3 py-2 text-sm transition-shadow", props.driver.available ? "touch-none cursor-grab hover:border-primary hover:shadow-md active:cursor-grabbing" : "cursor-not-allowed opacity-55", draggable.isActiveDraggable && "relative z-20 shadow-xl")}
    >
      <DriverIdentity driver={props.driver} />
      <Show when={props.driver.available} fallback={<LockKeyhole class="ml-auto h-4 w-4 text-muted-foreground" aria-hidden="true" />}>
        <GripVertical class="ml-auto h-4 w-4 text-muted-foreground" aria-hidden="true" />
      </Show>
    </div>
  )
}

interface CardActions {
  canManage: boolean
  onAssign: (order: DeliveryOrder) => void
  onMove: (order: DeliveryOrder, stage: Stage) => void
  onClose: (order: DeliveryOrder) => void
  onDetails: (order: DeliveryOrder) => void
}

// Native listener: a click on a button must not start a drag of the card
// (the card's pointerdown listener is native too, so a delegated one is late).
const stopDrag = (event: PointerEvent) => event.stopPropagation()

function OrderCard(props: { order: DeliveryOrder } & CardActions) {
  const { t, language } = useTranslation("deliveries")
  const context = useDragDropContext()
  // eslint-disable-next-line solid/reactivity -- a card is recreated with each board load (new objects).
  const draggable = createDraggable(`order:${props.order.id}`, { type: "order", order: props.order })
  // eslint-disable-next-line solid/reactivity -- same.
  const droppable = createDroppable(`order-target:${props.order.id}`, { type: "order-target", order: props.order })
  const canDrag = () => props.canManage || props.order.stage === "WAITING"
  const assigned = () => Boolean(props.order.driverId || props.order.externalDriverName)
  const driverDropTarget = () => props.canManage && props.order.stage === "WAITING" && context?.[0].active.draggable?.data.type === "driver"

  return (
    <article
      ref={(element) => {
        droppable(element, () => ({ skipTransform: true }))
        if (canDrag()) draggable(element)
      }}
      class={cn("rounded-lg border bg-card p-3 shadow-sm transition-shadow", canDrag() && "touch-none cursor-grab hover:shadow-md active:cursor-grabbing", draggable.isActiveDraggable && "relative z-10 opacity-80 shadow-xl", driverDropTarget() && "border-dashed border-primary/60", driverDropTarget() && droppable.isActiveDroppable && "border-2 border-primary bg-primary/5")}
    >
      <div class="flex gap-2">
        <span aria-label={t("dragCard")} title={t("dragCard")} class="mt-1 shrink-0 text-muted-foreground"><GripVertical class="h-4 w-4" /></span>
        <div class="min-w-0">
          <h3 class="font-semibold">{props.order.customerName || t("orderFallback", { id: props.order.id.slice(0, 6) })}</h3>
          <p class="break-words text-sm">{props.order.address}</p>
        </div>
      </div>
      <p class="mt-2 text-xs text-muted-foreground">{formatDateTime(props.order.openedAt, language())} · {formatCents(props.order.totalCents, language())}</p>
      <p class="mt-1 text-sm">{t("driver")}: {props.order.driverName || t("notInformed")}{props.order.driverPhone ? ` · ${props.order.driverPhone}` : ""}</p>
      <ul class="mt-2 list-inside list-disc text-sm">
        <For each={props.order.items.slice(0, 3)}>{(item) => <li>{item.quantity}× {item.productName} · {t(isReady(item) ? "ready" : "preparing")}</li>}</For>
      </ul>
      <Show when={props.order.items.length > 3}>
        <p class="mt-1 text-sm text-muted-foreground" aria-label={t("moreItems", { count: props.order.items.length - 3 })}>…</p>
      </Show>
      <div class="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div class="flex min-w-0 justify-start">
          <Show when={props.canManage && props.order.stage === "WAITING"}>
            <Button size="sm" variant="outline" class="max-w-full px-2 sm:px-3" aria-label={t(assigned() ? "editDriver" : "assign")} on:pointerdown={stopDrag} onClick={() => props.onAssign(props.order)}>
              <Show when={assigned()} fallback={<Plus class="h-4 w-4 shrink-0 sm:mr-1" />}><Pencil class="h-4 w-4 shrink-0 sm:mr-1" /></Show>
              <span class="hidden truncate sm:inline">{t("driver")}</span>
            </Button>
          </Show>
          <Show when={props.canManage && props.order.stage === "DELIVERING"}>
            <Button size="sm" variant="outline" class="max-w-full px-2 sm:px-3" aria-label={t("returnToWaiting")} on:pointerdown={stopDrag} onClick={() => props.onMove(props.order, "WAITING")}>
              <RotateCcw class="h-4 w-4 shrink-0 sm:mr-1" /><span class="hidden truncate sm:inline">{t("returnToWaiting")}</span>
            </Button>
          </Show>
        </div>
        <Button size="sm" variant="outline" class="px-2 sm:px-3" aria-label={t("viewDetails")} on:pointerdown={stopDrag} onClick={() => props.onDetails(props.order)}>
          <Eye class="h-4 w-4 sm:mr-1" /><span class="hidden sm:inline">{t("viewDetails")}</span>
        </Button>
        <div class="flex min-w-0 justify-end">
          <Show when={props.order.stage === "WAITING"}>
            <Button size="sm" class="max-w-full px-2 sm:px-3" aria-label={t("start")} disabled={!props.order.items.length} on:pointerdown={stopDrag} onClick={() => props.onMove(props.order, "DELIVERING")}>
              <Bike class="h-4 w-4 shrink-0 sm:mr-1" /><span class="hidden truncate sm:inline">{t("start")}</span>
            </Button>
          </Show>
          <Show when={props.canManage && props.order.stage === "DELIVERING"}>
            <Button size="sm" class="max-w-full px-2 sm:px-3" aria-label={t("finish")} on:pointerdown={stopDrag} onClick={() => props.onClose(props.order)}>
              <Check class="h-4 w-4 shrink-0 sm:mr-1" /><span class="hidden truncate sm:inline">{t("finish")}</span>
            </Button>
          </Show>
        </div>
      </div>
    </article>
  )
}

function Column(props: { stage: Stage; orders: DeliveryOrder[]; page: number; onPageChange: (page: number) => void } & CardActions) {
  const { t, language } = useTranslation("deliveries")
  const { t: tCommon } = useTranslation("common")
  // eslint-disable-next-line solid/reactivity -- the stage of a column never changes.
  const droppable = createDroppable(`stage:${props.stage}`, { type: "stage", stage: props.stage })
  const totalPages = () => Math.max(1, Math.ceil(props.orders.length / ordersPerColumnPage))
  const currentPage = () => Math.min(props.page, totalPages())
  const visibleOrders = () => props.orders.slice((currentPage() - 1) * ordersPerColumnPage, currentPage() * ordersPerColumnPage)
  const stageLabel = () => t(`stages.${props.stage}`)

  return (
    <div ref={(element) => droppable(element, () => ({ skipTransform: true }))} class={`flex min-h-80 flex-col rounded-lg border-2 border-dashed p-3 ${droppable.isActiveDroppable ? "border-primary bg-primary/5" : ""}`}>
      <h2 class="mb-3 font-semibold">{stageLabel()} <span class="text-muted-foreground">({formatNumber(props.orders.length, language())})</span></h2>
      <div class="flex-1 space-y-3">
        <For each={visibleOrders()}>
          {(order) => <OrderCard order={order} canManage={props.canManage} onAssign={props.onAssign} onMove={props.onMove} onClose={props.onClose} onDetails={props.onDetails} />}
        </For>
      </div>
      <div class="mt-auto flex items-center justify-between gap-2 border-t border-dashed pt-3">
        <Button type="button" variant="outline" size="sm" aria-label={t("previousOrders", { stage: stageLabel() })} disabled={currentPage() <= 1} onClick={() => props.onPageChange(currentPage() - 1)}><ChevronLeft class="mr-1 h-4 w-4" />{tCommon("previous")}</Button>
        <span class="text-xs text-muted-foreground" aria-live="polite">{t("pageOrders", { page: formatNumber(currentPage(), language()), total: formatNumber(totalPages(), language()) })}</span>
        <Button type="button" variant="outline" size="sm" aria-label={t("nextOrders", { stage: stageLabel() })} disabled={currentPage() >= totalPages()} onClick={() => props.onPageChange(currentPage() + 1)}>{tCommon("next")}<ChevronRight class="ml-1 h-4 w-4" /></Button>
      </div>
    </div>
  )
}

export default function DeliveriesPage() {
  const { user } = useAuth()
  const { t } = useTranslation("deliveries")
  const { t: common } = useTranslation("common")
  const queryClient = useQueryClient()
  const canManage = () => user()?.role !== "DRIVER"
  const [columnPages, setColumnPages] = createSignal<Record<Stage, number>>({ WAITING: 1, DELIVERING: 1 })
  const [actionError, setActionError] = createSignal<DeliveryError | null>(null)
  const [selected, setSelected] = createSignal<DeliveryOrder | null>(null)
  const [dialog, setDialog] = createSignal<"assign" | "finish" | "details" | "confirmReady" | null>(null)
  const [driverMode, setDriverMode] = createSignal<"fixed" | "external">("fixed")
  const [driverId, setDriverId] = createSignal("")
  const [externalName, setExternalName] = createSignal("")
  const [externalPhone, setExternalPhone] = createSignal("")
  const [paymentMethod, setPaymentMethod] = createSignal<PaymentMethod | "">("")

  const board = createQuery(() => ({
    queryKey: [...operationKeys.delivery, "board"],
    queryFn: ({ signal }) => listDeliveryBoard(signal),
    // Realtime (order.changed) is the main path; the React board also polled every 15 s.
    refetchInterval: 15_000,
  }))
  const orders = createMemo(() => (loadedData(board)?.orders ?? []).map(toDeliveryOrder))
  const drivers = () => loadedData(board)?.drivers ?? []
  // A new load clears the last message, like the React board.
  createEffect(on(() => board.dataUpdatedAt, () => setActionError(null), { defer: true }))
  const error = () => (actionError() ? t(actionError()!) : board.isError ? t("loadError") : "")

  const columns = createMemo(() => (["WAITING", "DELIVERING"] as Stage[]).map((stage) => ({ stage, orders: orders().filter((order) => order.stage === stage) })))
  const detailItems = () => selected()?.items.map((item) => ({ id: item.id, productId: item.productId, quantity: item.quantity, name: item.productName, unitPriceCents: item.unitPriceCents, status: item.status })) ?? []

  const reload = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: operationKeys.delivery }),
    queryClient.invalidateQueries({ queryKey: operationKeys.orders }),
    queryClient.invalidateQueries({ queryKey: operationKeys.kitchen }),
  ])

  const action = createMutation(() => ({
    mutationFn: (input: { order: DeliveryOrder; body: Omit<DeliveryActionRequest, "expectedUpdatedAt">; closeDialog: boolean }) =>
      deliveryAction(input.order.id, { ...input.body, expectedUpdatedAt: input.order.updatedAt }),
    onSuccess: async (_order, input) => {
      if (input.closeDialog) setDialog(null)
      await reload()
    },
    onError: async (cause, input) => {
      const code = apiErrorOf(cause).code
      // The order changed (or is not ready any more): show the new board first.
      if (input.body.action !== "ASSIGN" && (code === "DELIVERY_CONFLICT" || code === "ORDER_NOT_READY")) {
        setDialog(null)
        await reload()
      }
      setActionError(input.body.action === "ASSIGN" && code === "ORDER_NOT_READY" ? "changeError" : actionErrorKey(code))
    },
  }))
  const close = createMutation(() => ({
    mutationFn: (input: { order: DeliveryOrder; paymentMethod: PaymentMethod | null }) => closeOrder(input.order.id, input.paymentMethod),
    onSuccess: async () => {
      setDialog(null)
      await Promise.all([reload(), queryClient.invalidateQueries({ queryKey: salesKeys.all }), queryClient.invalidateQueries({ queryKey: salesKeys.reports })])
    },
    onError: () => setActionError("closeError"),
  }))
  // One write at a time: each one changes the order version (updatedAt).
  const busy = () => action.isPending || close.isPending

  const move = (order: DeliveryOrder, stage: Stage, confirmReady = false) => {
    if (busy() || order.stage === stage) return
    if (stage === "DELIVERING" && !confirmReady && order.items.some((item) => !isReady(item))) {
      setSelected(order)
      setDialog("confirmReady")
      return
    }
    action.mutate({ order, body: { action: stage === "DELIVERING" ? "START" : "WAIT", ...(confirmReady ? { confirmReady: true } : {}) }, closeDialog: true })
  }

  const openAssign = (order: DeliveryOrder) => {
    setActionError(null)
    setSelected(order)
    setDialog("assign")
    setDriverMode(order.driverId || !order.externalDriverName ? "fixed" : "external")
    setDriverId(order.driverId ?? "")
    setExternalName(order.externalDriverName ?? "")
    setExternalPhone(order.externalDriverPhone ?? "")
  }

  const saveAssignment = (order: DeliveryOrder, assignment: Assignment, closeDialog = false) => {
    if (busy()) return
    action.mutate({ order, body: { action: "ASSIGN", ...assignment }, closeDialog })
  }

  const fixedDriverAvailable = () => drivers().some((driver) => driver.id === driverId() && driver.available)

  const assign = () => {
    const order = selected()
    if (!order || busy()) return
    if (driverMode() === "fixed") {
      if (!fixedDriverAvailable()) { setActionError("driverRequired"); return }
      saveAssignment(order, { driverId: driverId() }, true)
    } else {
      if (!externalName().trim()) { setActionError("driverRequired"); return }
      saveAssignment(order, { externalDriverName: externalName().trim(), externalDriverPhone: externalPhone().trim() }, true)
    }
  }

  const finish = () => {
    const order = selected()
    if (!order || busy()) return
    close.mutate({ order, paymentMethod: paymentMethod() || null })
  }

  const onDragEnd = ({ draggable, droppable }: DragEvent) => {
    if (!droppable) return
    const source = draggable.data
    const target = droppable.data
    if (source.type === "driver" && target.type === "order-target") {
      const driver = source.driver as Driver
      const order = target.order as DeliveryOrder
      if (canManage() && driver.available && order.stage === "WAITING") saveAssignment(order, { driverId: driver.id })
    } else if (source.type === "order") {
      const stage = target.type === "stage" ? target.stage : target.type === "order-target" ? (target.order as DeliveryOrder).stage : null
      if (stage === "WAITING" || stage === "DELIVERING") move(source.order as DeliveryOrder, stage)
    }
  }

  const closeUnlessBusy = (open: boolean) => { if (!open && !busy()) setDialog(null) }
  const selectedAssigned = () => Boolean(selected()?.driverId || selected()?.externalDriverName)

  return (
    <Show when={!board.isPending} fallback={<div role="status">{t("loading")}</div>}>
      <section class="space-y-5">
        <h1 class="flex items-center gap-2 text-3xl font-bold"><Bike class="h-8 w-8" />{t("pageTitle", { establishment: user()?.establishment?.tradeName || t("establishmentFallback") })}</h1>
        <Show when={error()}><p role="alert" class="text-destructive">{error()}</p></Show>
        <DragDropProvider onDragEnd={onDragEnd} collisionDetector={deliveryCollisionDetector}>
          <DragDropSensors />
          <Card>
            <CardHeader><CardTitle>{t("boardTitle")}</CardTitle></CardHeader>
            <CardContent>
              <div class="grid gap-4 lg:grid-cols-2">
                <For each={columns()}>
                  {(column) => (
                    <Column
                      stage={column.stage}
                      orders={column.orders}
                      page={columnPages()[column.stage]}
                      onPageChange={(nextPage) => setColumnPages((current) => ({ ...current, [column.stage]: nextPage }))}
                      canManage={canManage()}
                      onAssign={openAssign}
                      onMove={move}
                      onDetails={(order) => { setSelected(order); setDialog("details") }}
                      onClose={(order) => { setSelected(order); setPaymentMethod(""); setDialog("finish") }}
                    />
                  )}
                </For>
              </div>
            </CardContent>
          </Card>
          <Show when={canManage()}>
            <Card>
              <CardHeader><CardTitle>{t("driversTitle")}</CardTitle></CardHeader>
              <CardContent class="flex flex-wrap gap-2">
                <Show when={drivers().length} fallback={<p>{t("noDrivers")}</p>}>
                  <For each={drivers()}>{(driver) => <DriverRosterTile driver={driver} />}</For>
                </Show>
              </CardContent>
            </Card>
          </Show>
        </DragDropProvider>

        <Dialog open={dialog() === "assign"} onOpenChange={closeUnlessBusy}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t(selectedAssigned() ? "editDriver" : "assignTitle")}</DialogTitle>
              <DialogDescription>{selected()?.address}</DialogDescription>
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
              <Button variant="outline" disabled={busy()} onClick={() => setDialog(null)}>{common("cancel")}</Button>
              <Show when={selectedAssigned()}>
                {/* An ASSIGN with no driver clears the assignment (/v1). */}
                <Button variant="outline" disabled={busy()} onClick={() => { const order = selected(); if (order) saveAssignment(order, {}, true) }}>{t("removeDriver")}</Button>
              </Show>
              <Button disabled={busy() || (driverMode() === "fixed" && !fixedDriverAvailable())} onClick={assign}>{t("saveDriver")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={dialog() === "confirmReady"} onOpenChange={closeUnlessBusy}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("confirmReadyTitle")}</DialogTitle>
              <DialogDescription>{t("confirmReadyDescription")}</DialogDescription>
            </DialogHeader>
            <ul class="list-inside list-disc text-sm">
              <For each={selected()?.items.filter((item) => !isReady(item)) ?? []}>{(item) => <li>{item.quantity}× {item.productName}</li>}</For>
            </ul>
            <DialogFooter>
              <Button variant="outline" disabled={busy()} onClick={() => setDialog(null)}>{common("cancel")}</Button>
              <Button disabled={busy()} onClick={() => { const order = selected(); if (order) move(order, "DELIVERING", true) }}>{t("confirmReadyAction")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={dialog() === "finish"} onOpenChange={closeUnlessBusy}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("finishTitle")}</DialogTitle>
              <DialogDescription>{t("finishDescription")}</DialogDescription>
            </DialogHeader>
            <div>
              <Label for="delivery-payment">{t("paymentMethod")}</Label>
              <select id="delivery-payment" class="w-full rounded border bg-background p-2" value={paymentMethod()} onChange={(event) => setPaymentMethod(event.currentTarget.value as PaymentMethod | "")}>
                <option value="">{t("notInformed")}</option>
                <For each={PAYMENT_METHODS}>{(method) => <option value={method}>{t(`payment.${method}`)}</option>}</For>
              </select>
            </div>
            <DialogFooter>
              <Button disabled={busy()} onClick={finish}>{t("confirmFinish")}</Button>
            </DialogFooter>
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
          initialDelivery={{ isDelivery: true, deliveryAddress: selected()?.address ?? null }}
          initialItems={detailItems()}
        />
      </section>
    </Show>
  )
}
