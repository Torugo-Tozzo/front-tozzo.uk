import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DndContext, PointerSensor, closestCenter, useDroppable, useDraggable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { ChefHat, GripVertical, Info } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import api from '@/services/api'
import { useRealtimeEvents } from '@/hooks/useRealtimeEvents'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatDateTime, formatNumber } from '@/i18n/format'
import { cn } from '@/lib/utils'

type Stage = 'IN_PREPARATION' | 'READY'
type Item = { id: string; productId: string; productName: string; quantity: number; stage: Stage; kitchenReadyAt: string | null }
type KitchenItem = Item & { itemIds: string[] }
type Order = { id: string; customerName: string | null; openedAt: string; updatedAt: string; items: Item[] }
type KitchenOrder = Omit<Order, 'items'> & { items: KitchenItem[] }
type KitchenError = 'loadError' | 'refreshError' | 'conflict'

const columns: Stage[] = ['IN_PREPARATION', 'READY']

function KitchenCard({ order, item, onInfo }: { order: KitchenOrder; item: KitchenItem; onInfo: (order: KitchenOrder, item: KitchenItem) => void }) {
  const { t, i18n } = useTranslation('kitchen')
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: item.id, data: { order, item } })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined }}
      {...listeners}
      {...attributes}
      className={cn('cursor-grab touch-none rounded-lg border bg-card p-3 shadow-sm transition-shadow active:cursor-grabbing', isDragging && 'z-10 shadow-xl opacity-80')}
    >
      <div className="flex items-start gap-2">
        <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{formatNumber(item.quantity, i18n.language)}× {item.productName || t('unavailableProduct')}</p>
          <p className="truncate text-sm text-muted-foreground">{order.customerName || t('orderFallback', { id: order.id.slice(0, 6) })}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t('viewItemInfo')}
          className="h-8 w-8 shrink-0"
          onPointerDown={event => event.stopPropagation()}
          onClick={event => { event.stopPropagation(); onInfo(order, item) }}
        >
          <Info className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function KitchenColumn({ stage, orders, onInfo }: { stage: Stage; orders: KitchenOrder[]; onInfo: (order: KitchenOrder, item: KitchenItem) => void }) {
  const { t, i18n } = useTranslation('kitchen')
  const { isOver, setNodeRef } = useDroppable({ id: stage })

  return (
    <div ref={setNodeRef} className={cn('min-h-[360px] rounded-lg border-2 border-dashed p-3 transition-colors', isOver && 'border-primary bg-primary/5')}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">{t(`stages.${stage}`)}</h2>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{formatNumber(orders.reduce((total, order) => total + order.items.length, 0), i18n.language)}</span>
      </div>
      <div className="space-y-3">
        {orders.flatMap(order => order.items.map(item => <KitchenCard key={item.id} order={order} item={item} onInfo={onInfo} />))}
      </div>
    </div>
  )
}

export default function KitchenPage() {
  const { user } = useAuth()
  const { t, i18n } = useTranslation('kitchen')
  const { t: tCommon } = useTranslation('common')
  const [orders, setOrders] = useState<Order[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<KitchenError | null>(null)
  const [refreshError, setRefreshError] = useState<KitchenError | null>(null)
  const [selectedItem, setSelectedItem] = useState<{ order: KitchenOrder; item: KitchenItem } | null>(null)
  const request = useRef(0)
  const inFlight = useRef(false)
  const queued = useRef(false)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const load = useCallback(async () => {
    if (inFlight.current) { queued.current = true; return }
    inFlight.current = true
    const token = ++request.current
    try {
      const response = await api.get('/cozinha/pedidos', { params: { page, limit: 50 } })
      if (token !== request.current) return
      setOrders(response.data.orders)
      setTotalPages(response.data.totalPages)
      setError(null)
      setRefreshError(null)
    } catch {
      if (orders.length) setRefreshError('refreshError')
      else setError('loadError')
    } finally {
      inFlight.current = false
      setLoading(false)
      if (queued.current) { queued.current = false; void load() }
    }
  }, [page])

  useRealtimeEvents(['orders'], load)
  useEffect(() => {
    void load()
    const timer = setInterval(() => void load(), 15000)
    const onVisible = () => { if (document.visibilityState === 'visible') void load() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); request.current++ }
  }, [load])

  const grouped = useMemo(() => columns.map(stage => ({ stage, orders: orders.map(order => {
    const byProduct = new Map<string, KitchenItem>()
    order.items.filter(item => item.stage === stage).forEach(item => {
      const key = String(item.productId)
      const existing = byProduct.get(key)
      if (existing) {
        existing.quantity += item.quantity
        existing.itemIds.push(item.id)
      } else {
        byProduct.set(key, { ...item, itemIds: [item.id] })
      }
    })
    return { ...order, items: Array.from(byProduct.values()) }
  }).filter(order => order.items.length) })), [orders])

  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    if (!over || !active.data.current?.item || !active.data.current?.order || over.id === active.data.current.item.stage) return
    const item = active.data.current.item as KitchenItem
    const order = active.data.current.order as KitchenOrder
    try {
      await api.patch(`/cozinha/pedidos/${order.id}/items/${item.id}`, {
        action: 'MOVE', itemIds: item.itemIds, targetStage: over.id, expectedUpdatedAt: order.updatedAt,
      })
      await load()
    } catch {
      setRefreshError('conflict')
    }
  }

  if (loading && !orders.length) return <div role="status" className="p-6">{t('loading')}</div>
  if (error && !orders.length) return <div className="p-6"><p role="alert">{t(error)}</p></div>

  return (
    <section className="space-y-6">
      <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
        <ChefHat className="h-8 w-8" />
        {t('pageTitle', { establishment: user?.establishment?.tradeName || t('establishmentFallback') })}
      </h1>
      <Card>
        <CardHeader><CardTitle>{t('boardTitle')}</CardTitle></CardHeader>
        <CardContent>
          {refreshError && <p role="alert" className="mb-4 text-destructive">{t(refreshError)}</p>}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            accessibility={{
              screenReaderInstructions: { draggable: t('dragInstructions') },
              announcements: {
                onDragStart: () => t('dragStart'),
                onDragOver: () => t('dragOver'),
                onDragEnd: () => t('dragEnd'),
                onDragCancel: () => t('dragCancel'),
              },
            }}
          >
            <div className="grid gap-4 lg:grid-cols-2">
              {grouped.map(column => <KitchenColumn key={column.stage} stage={column.stage} orders={column.orders} onInfo={(order, item) => setSelectedItem({ order, item })} />)}
            </div>
          </DndContext>
          <div className="mt-4 flex items-center justify-between">
            <Button variant="outline" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>{tCommon('previous')}</Button>
            <span className="text-sm text-muted-foreground">{t('pageOrders', { page: formatNumber(page, i18n.language), total: formatNumber(Math.max(totalPages, 1), i18n.language) })}</span>
            <Button variant="outline" disabled={page >= totalPages} onClick={() => setPage(value => value + 1)}>{tCommon('next')}</Button>
          </div>
        </CardContent>
      </Card>
      <Dialog open={selectedItem !== null} onOpenChange={open => { if (!open) setSelectedItem(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('infoTitle')}</DialogTitle>
            <DialogDescription>{t('infoDescription')}</DialogDescription>
          </DialogHeader>
          {selectedItem && <dl className="grid gap-3 text-sm">
            <div><dt className="font-medium text-muted-foreground">{t('customer')}</dt><dd>{selectedItem.order.customerName || t('notInformed')}</dd></div>
            <div><dt className="font-medium text-muted-foreground">{t('order')}</dt><dd className="break-all">{selectedItem.order.id}</dd></div>
            <div><dt className="font-medium text-muted-foreground">{t('openedAt')}</dt><dd>{formatDateTime(selectedItem.order.openedAt, i18n.language)}</dd></div>
            <div><dt className="font-medium text-muted-foreground">{t('item')}</dt><dd>{formatNumber(selectedItem.item.quantity, i18n.language)}× {selectedItem.item.productName || t('unavailableProduct')}</dd></div>
            <div><dt className="font-medium text-muted-foreground">{t('stage')}</dt><dd>{t(`stages.${selectedItem.item.stage}`)}</dd></div>
          </dl>}
        </DialogContent>
      </Dialog>
    </section>
  )
}
