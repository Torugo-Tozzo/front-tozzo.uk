import { createMemo, createSignal, createUniqueId, For, Match, Show, Switch } from "solid-js"
import { createMutation, createQuery, useQueryClient } from "@tanstack/solid-query"
import { closestCenter, createDraggable, createDroppable, DragDropProvider, DragDropSensors, type DragEvent } from "@thisbeyond/solid-dnd"
import { ChefHat, ChevronLeft, ChevronRight, GripVertical, Info } from "lucide-solid"

import { kitchenKeys, listKitchenBoard, moveKitchenItems, type KitchenItem, type KitchenOrder, type KitchenStage } from "@/api/kitchen"
import { deliveryKeys } from "@/api/delivery"
import { orderKeys } from "@/api/orders"
import { loadedData } from "@/api/query"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useAuth } from "@/contexts/AuthContext"
import { formatDateTime, formatNumber } from "@/i18n/format"
import { useTranslation } from "@/i18n/solid"
import { createDragCancel, createKeyboardMove, type DropResult } from "@/lib/board-dnd"
import { cn } from "@/lib/utils"

/** Items of one product in one order and stage, shown as a single card (like the React app). */
type BoardItem = KitchenItem & { itemIds: string[] }
type BoardOrder = Omit<KitchenOrder, "items"> & { items: BoardItem[] }
type Entry = { order: BoardOrder; item: BoardItem }

const STAGES: readonly KitchenStage[] = ["IN_PREPARATION", "READY"]
const ITEMS_PER_COLUMN_PAGE = 10
// SSE (realtime.ts) is the main path; the React app also polled every 15 s.
const REFRESH_MS = 15_000

function KitchenCard(props: {
  /** Looked up by id: a refetch updates the card in place instead of remounting it. */
  entry: Entry
  describedBy: string
  keyboard: ReturnType<typeof createKeyboardMove<KitchenStage>>
  onDrop: (entry: Entry, to: KitchenStage) => DropResult
  onInfo: (entry: Entry) => void
}) {
  const { t, language } = useTranslation("kitchen")
  const textId = createUniqueId()
  // `use:draggable` reads this name (solid-dnd directive). The data is read
  // at drop time, so it is a getter over the current props.
  const draggable = createDraggable(props.entry.item.id, { get entry() { return props.entry } })
  void draggable
  const key = () => props.entry.item.id
  const lifted = () => draggable.isActiveDraggable || props.keyboard.isPicked(key())

  return (
    <div
      use:draggable
      data-board-card
      class={cn("cursor-grab touch-none rounded-lg border bg-card p-3 shadow-sm transition-shadow active:cursor-grabbing", lifted() && "z-10 shadow-xl opacity-80")}
    >
      <div class="flex items-start gap-2">
        {/* The keyboard handle: the card itself holds the Info button, so it is
            not a button (no nested interactive elements). Same box as the icon. */}
        <span
          role="button"
          tabIndex={0}
          data-dnd-key={key()}
          aria-roledescription="draggable"
          aria-labelledby={textId}
          aria-describedby={props.describedBy}
          aria-pressed={props.keyboard.isPicked(key())}
          onKeyDown={(event) => props.keyboard.keyDown(key(), props.entry.item.stage, (to) => props.onDrop(props.entry, to))(event)}
          onBlur={props.keyboard.blur(key())}
          class="mt-0.5 flex shrink-0 text-muted-foreground"
        >
          <GripVertical class="h-4 w-4" />
        </span>
        <div class="min-w-0 flex-1">
          <p id={textId} class="truncate font-medium">{formatNumber(props.entry.item.quantity, language())}× {props.entry.item.productName || t("unavailableProduct")}</p>
          <p class="truncate text-sm text-muted-foreground">{props.entry.order.customerName || t("orderFallback", { id: props.entry.order.id.slice(0, 6) })}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t("viewItemInfo")}
          class="h-8 w-8 shrink-0"
          // Native listener: it must stop the event before the card's drag sensor sees it.
          on:pointerdown={(event) => event.stopPropagation()}
          onClick={(event) => { event.stopPropagation(); props.onInfo(props.entry) }}
        >
          <Info class="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function KitchenColumn(props: {
  stage: KitchenStage
  orders: BoardOrder[]
  page: number
  onPageChange: (page: number) => void
  describedBy: string
  keyboard: ReturnType<typeof createKeyboardMove<KitchenStage>>
  onDrop: (entry: Entry, to: KitchenStage) => DropResult
  onInfo: (entry: Entry) => void
}) {
  const { t, language } = useTranslation("kitchen")
  const { t: tCommon } = useTranslation("common")
  // `use:droppable` reads this name (solid-dnd directive).
  const droppable = createDroppable(props.stage, { stage: props.stage })
  void droppable
  const entries = createMemo(() => props.orders.flatMap((order) => order.items.map((item) => ({ order, item }))))
  const byId = createMemo(() => new Map(entries().map((entry) => [entry.item.id, entry])))
  const totalPages = () => Math.max(1, Math.ceil(entries().length / ITEMS_PER_COLUMN_PAGE))
  const currentPage = () => Math.min(props.page, totalPages())
  // Ids (strings) keep each card mounted across refetches; the entry behind it is looked up.
  const visibleIds = () => entries().slice((currentPage() - 1) * ITEMS_PER_COLUMN_PAGE, currentPage() * ITEMS_PER_COLUMN_PAGE).map((entry) => entry.item.id)
  const isOver = () => droppable.isActiveDroppable || props.keyboard.isTarget(props.stage)

  return (
    <div use:droppable={{ skipTransform: true }} class={cn("flex min-h-[360px] flex-col rounded-lg border-2 border-dashed p-3 transition-colors", isOver() && "border-primary bg-primary/5")}>
      <div class="mb-3 flex items-center justify-between">
        <h2 class="font-semibold">{t(`stages.${props.stage}`)}</h2>
        <span class="rounded-full bg-muted px-2 py-0.5 text-xs">{formatNumber(props.orders.reduce((total, order) => total + order.items.length, 0), language())}</span>
      </div>
      <div class="flex-1 space-y-3">
        <For each={visibleIds()}>
          {(id) => <Show when={byId().get(id)}>{(entry) => <KitchenCard entry={entry()} describedBy={props.describedBy} keyboard={props.keyboard} onDrop={props.onDrop} onInfo={props.onInfo} />}</Show>}
        </For>
      </div>
      <div class="mt-auto flex items-center justify-between gap-2 border-t border-dashed pt-3">
        <Button type="button" variant="outline" size="sm" aria-label={t("previousItems", { stage: t(`stages.${props.stage}`) })} disabled={currentPage() <= 1} onClick={() => props.onPageChange(currentPage() - 1)}>
          <ChevronLeft class="mr-1 h-4 w-4" />{tCommon("previous")}
        </Button>
        <span class="text-xs text-muted-foreground" aria-live="polite">{t("pageItems", { page: formatNumber(currentPage(), language()), total: formatNumber(totalPages(), language()) })}</span>
        <Button type="button" variant="outline" size="sm" aria-label={t("nextItems", { stage: t(`stages.${props.stage}`) })} disabled={currentPage() >= totalPages()} onClick={() => props.onPageChange(currentPage() + 1)}>
          {tCommon("next")}<ChevronRight class="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

/** The kitchen board (React KitchenPage): items by stage, moved by drag or keyboard. */
export default function KitchenPage() {
  const { user } = useAuth()
  const { t, language } = useTranslation("kitchen")
  const { t: tCommon } = useTranslation("common")
  const queryClient = useQueryClient()
  const describedBy = `kitchen-dnd-${createUniqueId()}`
  const [columnPages, setColumnPages] = createSignal<Record<KitchenStage, number>>({ IN_PREPARATION: 1, READY: 1 })
  const [selected, setSelected] = createSignal<Entry | null>(null)
  // A failed move: the message stays until the board is read again after the reload.
  const [conflictUntil, setConflictUntil] = createSignal<number | null>(null)

  const board = createQuery(() => ({
    queryKey: kitchenKeys.board,
    queryFn: ({ signal }) => listKitchenBoard(signal),
    refetchInterval: REFRESH_MS,
    reconcile: "id",
  }))

  const orders = () => loadedData(board) ?? []
  const hasData = () => loadedData(board) !== undefined
  const notice = (): "conflict" | "refreshError" | null => {
    const until = conflictUntil()
    if (until !== null && board.dataUpdatedAt <= until) return "conflict"
    return board.isError && hasData() ? "refreshError" : null
  }

  const grouped = createMemo(() => STAGES.map((stage) => ({
    stage,
    orders: orders().map((order) => {
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
      return { ...order, items: [...byProduct.values()] }
    }).filter((order) => order.items.length > 0),
  })))

  const move = createMutation(() => ({
    mutationFn: (input: { entry: Entry; to: KitchenStage }) => moveKitchenItems(input.entry.order.id, {
      itemIds: input.entry.item.itemIds,
      targetStage: input.to,
      expectedUpdatedAt: input.entry.order.updatedAt,
    }),
    // Waits for the board read again: a next move must carry the new version.
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: kitchenKeys.all }),
      // An item's stage changes the order (status) and the delivery readiness.
      queryClient.invalidateQueries({ queryKey: orderKeys.all }),
      queryClient.invalidateQueries({ queryKey: deliveryKeys.all }),
    ]),
    onError: async (error) => {
      // Like the React app, any refused move (KITCHEN_CONFLICT, the order out
      // for delivery, an item gone...) says the order changed; the board is read again.
      console.error("Error moving kitchen items", error)
      setConflictUntil(Number.MAX_SAFE_INTEGER)
      await board.refetch()
      setConflictUntil(board.dataUpdatedAt)
    },
  }))

  /** One move at a time; resolves true once it went through and the board was read again. */
  const drop = (entry: Entry, to: KitchenStage): DropResult => {
    if (move.isPending || entry.item.stage === to) return false
    return move.mutateAsync({ entry, to }).then(() => true, () => false)
  }

  const dragCancel = createDragCancel()
  const onDragEnd = ({ draggable, droppable }: DragEvent) => {
    if (dragCancel.wasCancelled()) return
    const entry = draggable.data.entry as Entry | undefined
    const to = droppable?.data.stage as KitchenStage | undefined
    if (entry && to) void drop(entry, to)
  }

  const keyboard = createKeyboardMove<KitchenStage>({
    stages: STAGES,
    messages: {
      picked: () => t("dragStart"),
      over: (stage) => tCommon("dnd.over", { column: t(`stages.${stage}`) }),
      dropped: () => t("dragEnd"),
      cancelled: () => t("dragCancel"),
    },
  })

  return (
    <Switch>
      <Match when={!hasData() && board.isPending}>
        <div role="status" class="p-6">{t("loading")}</div>
      </Match>
      <Match when={!hasData() && board.isError}>
        <div class="p-6"><p role="alert">{t("loadError")}</p></div>
      </Match>
      <Match when={true}>
        <section class="space-y-6">
          <h1 class="flex items-center gap-2 text-3xl font-bold tracking-tight">
            <ChefHat class="h-8 w-8" />
            {t("pageTitle", { establishment: user()?.establishment?.tradeName || t("establishmentFallback") })}
          </h1>
          <Card>
            <CardHeader><CardTitle>{t("boardTitle")}</CardTitle></CardHeader>
            <CardContent>
              <Show when={notice()}>{(key) => <p role="alert" class="mb-4 text-destructive">{t(key())}</p>}</Show>
              {/* What dnd-kit rendered for screen readers: the instructions and a live region. */}
              <div id={describedBy} style={{ display: "none" }}>{t("dragInstructions")} {tCommon("dnd.keyboardInstructions")}</div>
              <div role="status" aria-live="assertive" aria-atomic="true" class="sr-only">{keyboard.announcement()}</div>
              <DragDropProvider onDragEnd={onDragEnd} collisionDetector={closestCenter}>
                <DragDropSensors>
                  <dragCancel.DragCancel />
                  <div class="grid gap-4 lg:grid-cols-2">
                    {/* STAGES, not grouped(): a refetch must not remount the columns (and drop a picked card's focus). */}
                    <For each={STAGES}>
                      {(stage) => (
                        <KitchenColumn
                          stage={stage}
                          orders={grouped().find((column) => column.stage === stage)!.orders}
                          page={columnPages()[stage]}
                          onPageChange={(page) => setColumnPages((current) => ({ ...current, [stage]: page }))}
                          describedBy={describedBy}
                          keyboard={keyboard}
                          onDrop={drop}
                          onInfo={setSelected}
                        />
                      )}
                    </For>
                  </div>
                </DragDropSensors>
              </DragDropProvider>
            </CardContent>
          </Card>
          <Dialog open={selected() !== null} onOpenChange={(open) => { if (!open) setSelected(null) }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("infoTitle")}</DialogTitle>
                <DialogDescription>{t("infoDescription")}</DialogDescription>
              </DialogHeader>
              <Show when={selected()}>
                {(entry) => (
                  <dl class="grid gap-3 text-sm">
                    <div><dt class="font-medium text-muted-foreground">{t("customer")}</dt><dd>{entry().order.customerName || t("notInformed")}</dd></div>
                    <div><dt class="font-medium text-muted-foreground">{t("order")}</dt><dd class="break-all">{entry().order.id}</dd></div>
                    <div><dt class="font-medium text-muted-foreground">{t("openedAt")}</dt><dd>{formatDateTime(entry().order.openedAt, language())}</dd></div>
                    <div><dt class="font-medium text-muted-foreground">{t("item")}</dt><dd>{formatNumber(entry().item.quantity, language())}× {entry().item.productName || t("unavailableProduct")}</dd></div>
                    <div><dt class="font-medium text-muted-foreground">{t("stage")}</dt><dd>{t(`stages.${entry().item.stage}`)}</dd></div>
                  </dl>
                )}
              </Show>
            </DialogContent>
          </Dialog>
        </section>
      </Match>
    </Switch>
  )
}
