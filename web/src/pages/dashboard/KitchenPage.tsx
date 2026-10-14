import { createEffect, createMemo, createSignal, For, on, Show } from "solid-js"
import { createMutation, createQuery, useQueryClient } from "@tanstack/solid-query"
import { closestCenter, createDraggable, createDroppable, DragDropProvider, DragDropSensors, type DragEvent } from "@thisbeyond/solid-dnd"
import { ChefHat, ChevronLeft, ChevronRight, GripVertical, Info } from "lucide-solid"

import { kitchenAction, listKitchenOrders, operationKeys, type KitchenItem, type KitchenOrder } from "@/api/orders"
import { loadedData } from "@/api/query"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useAuth } from "@/contexts/AuthContext"
import { formatDateTime, formatNumber } from "@/i18n/format"
import { useTranslation } from "@/i18n/solid"
import { cn } from "@/lib/utils"

type Stage = KitchenItem["stage"]
/** The items of one product in one order and stage, shown as a single card. */
type BoardItem = KitchenItem & { itemIds: string[] }
type BoardOrder = Omit<KitchenOrder, "items"> & { items: BoardItem[] }
type Selected = { order: BoardOrder; item: BoardItem }

const columns: Stage[] = ["IN_PREPARATION", "READY"]
const itemsPerColumnPage = 10
const INSTRUCTIONS_ID = "kitchen-dnd-instructions"

/** The column after (+1) or before (-1) `stage`, if any. */
const stageAt = (stage: Stage, step: number): Stage => columns[Math.min(columns.length - 1, Math.max(0, columns.indexOf(stage) + step))]

interface KeyboardMove {
  picked: () => Selected | null
  target: () => Stage | null
  onKeyDown: (event: KeyboardEvent, selected: Selected) => void
}

function KitchenCard(props: { order: BoardOrder; item: BoardItem; onInfo: (selected: Selected) => void; keyboard: KeyboardMove }) {
  const { t, language } = useTranslation("kitchen")
  // eslint-disable-next-line solid/reactivity -- a card is recreated with each board load (new objects).
  const draggable = createDraggable(props.item.id, { order: props.order, item: props.item })
  const picked = () => props.keyboard.picked()?.item.id === props.item.id

  return (
    <div
      ref={(element) => draggable(element)}
      role="button"
      tabIndex={0}
      aria-describedby={INSTRUCTIONS_ID}
      aria-pressed={picked() ? true : undefined}
      onKeyDown={(event) => props.keyboard.onKeyDown(event, { order: props.order, item: props.item })}
      class={cn("cursor-grab touch-none rounded-lg border bg-card p-3 shadow-sm transition-shadow active:cursor-grabbing", (draggable.isActiveDraggable || picked()) && "z-10 shadow-xl opacity-80")}
    >
      <div class="flex items-start gap-2">
        <GripVertical class="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div class="min-w-0 flex-1">
          <p class="truncate font-medium">{formatNumber(props.item.quantity, language())}× {props.item.productName || t("unavailableProduct")}</p>
          <p class="truncate text-sm text-muted-foreground">{props.order.customerName || t("orderFallback", { id: props.order.id.slice(0, 6) })}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t("viewItemInfo")}
          class="h-8 w-8 shrink-0"
          // Native (not delegated) listener: it must stop the event before the
          // card's own pointerdown listener starts a drag.
          on:pointerdown={(event: PointerEvent) => event.stopPropagation()}
          onClick={(event) => { event.stopPropagation(); props.onInfo({ order: props.order, item: props.item }) }}
        >
          <Info class="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function KitchenColumn(props: { stage: Stage; orders: BoardOrder[]; page: number; onPageChange: (page: number) => void; onInfo: (selected: Selected) => void; keyboard: KeyboardMove }) {
  const { t, language } = useTranslation("kitchen")
  const { t: tCommon } = useTranslation("common")
  // eslint-disable-next-line solid/reactivity -- the stage of a column never changes.
  const droppable = createDroppable(props.stage, { stage: props.stage })
  const items = () => props.orders.flatMap((order) => order.items.map((item) => ({ order, item })))
  const totalPages = () => Math.max(1, Math.ceil(items().length / itemsPerColumnPage))
  const currentPage = () => Math.min(props.page, totalPages())
  const visibleItems = () => items().slice((currentPage() - 1) * itemsPerColumnPage, currentPage() * itemsPerColumnPage)
  const stageLabel = () => t(`stages.${props.stage}`)
  const isOver = () => droppable.isActiveDroppable || (props.keyboard.picked() !== null && props.keyboard.target() === props.stage)

  return (
    <div ref={(element) => droppable(element, () => ({ skipTransform: true }))} class={cn("flex min-h-[360px] flex-col rounded-lg border-2 border-dashed p-3 transition-colors", isOver() && "border-primary bg-primary/5")}>
      <div class="mb-3 flex items-center justify-between">
        <h2 class="font-semibold">{stageLabel()}</h2>
        <span class="rounded-full bg-muted px-2 py-0.5 text-xs">{formatNumber(props.orders.reduce((total, order) => total + order.items.length, 0), language())}</span>
      </div>
      <div class="flex-1 space-y-3">
        <For each={visibleItems()}>{(entry) => <KitchenCard order={entry.order} item={entry.item} onInfo={props.onInfo} keyboard={props.keyboard} />}</For>
      </div>
      <div class="mt-auto flex items-center justify-between gap-2 border-t border-dashed pt-3">
        <Button type="button" variant="outline" size="sm" aria-label={t("previousItems", { stage: stageLabel() })} disabled={currentPage() <= 1} onClick={() => props.onPageChange(currentPage() - 1)}>
          <ChevronLeft class="mr-1 h-4 w-4" />{tCommon("previous")}
        </Button>
        <span class="text-xs text-muted-foreground" aria-live="polite">{t("pageItems", { page: formatNumber(currentPage(), language()), total: formatNumber(totalPages(), language()) })}</span>
        <Button type="button" variant="outline" size="sm" aria-label={t("nextItems", { stage: stageLabel() })} disabled={currentPage() >= totalPages()} onClick={() => props.onPageChange(currentPage() + 1)}>
          {tCommon("next")}<ChevronRight class="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

/** The items of each order grouped by product within a stage, like the React board. */
function groupByStage(orders: KitchenOrder[]) {
  return columns.map((stage) => ({
    stage,
    orders: orders.map((order) => {
      const byProduct = new Map<string, BoardItem>()
      for (const item of order.items ?? []) {
        if (item.stage !== stage) continue
        const existing = byProduct.get(item.productId)
        if (existing) {
          existing.quantity += item.quantity
          existing.itemIds.push(item.id)
        } else {
          byProduct.set(item.productId, { ...item, itemIds: [item.id] })
        }
      }
      return { ...order, items: Array.from(byProduct.values()) }
    }).filter((order) => order.items.length > 0),
  }))
}

export default function KitchenPage() {
  const { user } = useAuth()
  const { t, language } = useTranslation("kitchen")
  const queryClient = useQueryClient()
  const [columnPages, setColumnPages] = createSignal<Record<Stage, number>>({ IN_PREPARATION: 1, READY: 1 })
  const [conflict, setConflict] = createSignal(false)
  const [selectedItem, setSelectedItem] = createSignal<Selected | null>(null)
  const [announcement, setAnnouncement] = createSignal("")
  const [picked, setPicked] = createSignal<Selected | null>(null)
  const [target, setTarget] = createSignal<Stage | null>(null)

  const board = createQuery(() => ({
    queryKey: [...operationKeys.kitchen, "board"],
    queryFn: ({ signal }) => listKitchenOrders(signal),
    // Realtime (order.changed) is the main path; the React board also polled every 15 s.
    refetchInterval: 15_000,
  }))
  const orders = () => loadedData(board) ?? []
  const grouped = createMemo(() => groupByStage(orders()))
  // A new load clears the conflict message, like the React board.
  createEffect(on(() => board.dataUpdatedAt, () => setConflict(false), { defer: true }))

  const move = createMutation(() => ({
    mutationFn: (input: { order: BoardOrder; item: BoardItem; targetStage: Stage }) => kitchenAction(input.order.id, {
      action: "MOVE",
      itemIds: input.item.itemIds,
      targetStage: input.targetStage,
      expectedUpdatedAt: input.order.updatedAt,
    }),
    // Like the React board: the message stays until the next load (the event
    // of the change that caused the conflict, or the 15 s poll).
    onError: () => setConflict(true),
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: operationKeys.kitchen }),
      queryClient.invalidateQueries({ queryKey: operationKeys.orders }),
      queryClient.invalidateQueries({ queryKey: operationKeys.delivery }),
    ]),
  }))

  const moveTo = (selected: Selected, targetStage: Stage) => {
    // One move at a time: the order version (updatedAt) changes with each one.
    if (move.isPending || targetStage === selected.item.stage) return
    move.mutate({ ...selected, targetStage })
  }

  const handleDragEnd = ({ draggable, droppable }: DragEvent) => {
    const selected = draggable.data as Selected
    if (!droppable || !selected?.item) return
    moveTo(selected, droppable.id as Stage)
  }

  // The keyboard alternative to dragging (dnd-kit's keyboard sensor, which the
  // React board announced): Space/Enter picks the item up, the arrows choose
  // the column, Space/Enter drops it and Escape cancels.
  const cancelKeyboardMove = () => {
    if (!picked()) return
    setPicked(null)
    setTarget(null)
    setAnnouncement(t("dragCancel"))
  }
  const keyboard: KeyboardMove = {
    picked,
    target,
    onKeyDown: (event, selected) => {
      if (event.target !== event.currentTarget) return
      const current = picked()
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault()
        if (!current || current.item.id !== selected.item.id) {
          setPicked(selected)
          setTarget(selected.item.stage)
          setAnnouncement(t("dragStart"))
          return
        }
        const destination = target()
        setPicked(null)
        setTarget(null)
        if (!destination || destination === current.item.stage) {
          setAnnouncement(t("dragCancel"))
          return
        }
        setAnnouncement(t("dragEnd"))
        moveTo(current, destination)
        return
      }
      if (!current) return
      if (event.key === "Escape") {
        event.preventDefault()
        cancelKeyboardMove()
        return
      }
      const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0
      if (!step) return
      event.preventDefault()
      setTarget(stageAt(target() ?? current.item.stage, step))
      setAnnouncement(t("dragOver"))
    },
  }

  const title = () => t("pageTitle", { establishment: user()?.establishment?.tradeName || t("establishmentFallback") })
  const refreshError = () => (conflict() ? t("conflict") : board.isError ? t("refreshError") : "")

  return (
    <Show when={!board.isPending} fallback={<div role="status" class="p-6">{t("loading")}</div>}>
      <Show when={!(board.isError && orders().length === 0)} fallback={<div class="p-6"><p role="alert">{t("loadError")}</p></div>}>
        <section class="space-y-6">
          <h1 class="flex items-center gap-2 text-3xl font-bold tracking-tight">
            <ChefHat class="h-8 w-8" />
            {title()}
          </h1>
          <Card>
            <CardHeader><CardTitle>{t("boardTitle")}</CardTitle></CardHeader>
            <CardContent>
              <Show when={refreshError()}>
                <p role="alert" class="mb-4 text-destructive">{refreshError()}</p>
              </Show>
              <DragDropProvider onDragStart={() => setAnnouncement(t("dragStart"))} onDragOver={() => setAnnouncement(t("dragOver"))} onDragEnd={(event) => { setAnnouncement(event.droppable ? t("dragEnd") : t("dragCancel")); handleDragEnd(event) }} collisionDetector={closestCenter}>
                <DragDropSensors />
                <div class="grid gap-4 lg:grid-cols-2" onFocusOut={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) cancelKeyboardMove() }}>
                  <For each={grouped()}>
                    {(column) => (
                      <KitchenColumn
                        stage={column.stage}
                        orders={column.orders}
                        page={columnPages()[column.stage]}
                        onPageChange={(nextPage) => setColumnPages((current) => ({ ...current, [column.stage]: nextPage }))}
                        onInfo={setSelectedItem}
                        keyboard={keyboard}
                      />
                    )}
                  </For>
                </div>
              </DragDropProvider>
              {/* The instructions and announcements of dnd-kit's accessibility layer. */}
              <div id={INSTRUCTIONS_ID} style={{ display: "none" }}>{t("dragInstructions")} {t("keyboardInstructions")}</div>
              <div role="status" aria-live="assertive" aria-atomic="true" class="sr-only">{announcement()}</div>
            </CardContent>
          </Card>
          <Dialog open={selectedItem() !== null} onOpenChange={(open) => { if (!open) setSelectedItem(null) }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("infoTitle")}</DialogTitle>
                <DialogDescription>{t("infoDescription")}</DialogDescription>
              </DialogHeader>
              <Show when={selectedItem()}>
                {(selected) => (
                  <dl class="grid gap-3 text-sm">
                    <div><dt class="font-medium text-muted-foreground">{t("customer")}</dt><dd>{selected().order.customerName || t("notInformed")}</dd></div>
                    <div><dt class="font-medium text-muted-foreground">{t("order")}</dt><dd class="break-all">{selected().order.id}</dd></div>
                    <div><dt class="font-medium text-muted-foreground">{t("openedAt")}</dt><dd>{formatDateTime(selected().order.openedAt, language())}</dd></div>
                    <div><dt class="font-medium text-muted-foreground">{t("item")}</dt><dd>{formatNumber(selected().item.quantity, language())}× {selected().item.productName || t("unavailableProduct")}</dd></div>
                    <div><dt class="font-medium text-muted-foreground">{t("stage")}</dt><dd>{t(`stages.${selected().item.stage}`)}</dd></div>
                  </dl>
                )}
              </Show>
            </DialogContent>
          </Dialog>
        </section>
      </Show>
    </Show>
  )
}
