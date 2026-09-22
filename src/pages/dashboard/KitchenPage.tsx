import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DndContext, PointerSensor, closestCenter, useDroppable, useDraggable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { ChefHat, GripVertical, Info } from 'lucide-react'
import api from '@/services/api'
import { useRealtimeEvents } from '@/hooks/useRealtimeEvents'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

type Stage = 'REQUESTED' | 'IN_PREPARATION' | 'READY'
type Item = { id: string; productId: string; productName: string; quantity: number; stage: Stage; kitchenReadyAt: string | null }
type Order = { id: string; customerName: string | null; openedAt: string; updatedAt: string; items: Item[] }
const columns: { stage: Stage; title: string }[] = [{ stage: 'REQUESTED', title: 'Aguardando' }, { stage: 'IN_PREPARATION', title: 'Em preparo' }, { stage: 'READY', title: 'Pronto para servir' }]

function KitchenCard({ order, item, onInfo }: { order: Order; item: Item; onInfo: (order: Order, item: Item) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: item.id, data: { order, item } })
  return <div ref={setNodeRef} style={{ transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined }} {...listeners} {...attributes} className={cn('cursor-grab touch-none rounded-lg border bg-card p-3 shadow-sm transition-shadow active:cursor-grabbing', isDragging && 'z-10 shadow-xl opacity-80')}><div className="flex items-start gap-2"><GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><div className="min-w-0 flex-1"><p className="truncate font-medium">{item.quantity}× {item.productName || 'Produto indisponível'}</p><p className="truncate text-sm text-muted-foreground">{order.customerName || `Pedido ${order.id.slice(0, 6)}`}</p></div><Button type="button" variant="ghost" size="icon" aria-label="Ver informações do item" className="h-8 w-8 shrink-0" onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); onInfo(order, item) }}><Info className="h-4 w-4" /></Button></div></div>
}

function KitchenColumn({ stage, title, orders, onInfo }: { stage: Stage; title: string; orders: Order[]; onInfo: (order: Order, item: Item) => void }) {
  const { isOver, setNodeRef } = useDroppable({ id: stage })
  return <div ref={setNodeRef} className={cn('min-h-[360px] rounded-lg border-2 border-dashed p-3 transition-colors', isOver && 'border-primary bg-primary/5')}><div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">{title}</h2><span className="rounded-full bg-muted px-2 py-0.5 text-xs">{orders.reduce((total, order) => total + order.items.length, 0)}</span></div><div className="space-y-3">{orders.flatMap(order => order.items.map(item => <KitchenCard key={item.id} order={order} item={item} onInfo={onInfo} />))}</div></div>
}

export default function KitchenPage() {
  const { user } = useAuth()
  const [orders, setOrders] = useState<Order[]>([]), [page, setPage] = useState(1), [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [refreshError, setRefreshError] = useState('')
  const [selectedItem, setSelectedItem] = useState<{ order: Order; item: Item } | null>(null)
  const request = useRef(0), inFlight = useRef(false), queued = useRef(false)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const load = useCallback(async () => { if (inFlight.current) { queued.current = true; return }; inFlight.current = true; const token = ++request.current; try { const response = await api.get('/cozinha/pedidos', { params: { page, limit: 50 } }); if (token !== request.current) return; setOrders(response.data.orders); setTotalPages(response.data.totalPages); setError(''); setRefreshError('') } catch { if (orders.length) setRefreshError('Não foi possível atualizar a cozinha.'); else setError('Não foi possível carregar a cozinha.') } finally { inFlight.current = false; setLoading(false); if (queued.current) { queued.current = false; void load() } } }, [page])
  useRealtimeEvents(['orders'], load)
  useEffect(() => { void load(); const timer = setInterval(() => void load(), 15000); const onVisible = () => { if (document.visibilityState === 'visible') void load() }; document.addEventListener('visibilitychange', onVisible); return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); request.current++ } }, [load])
  const grouped = useMemo(() => columns.map(column => ({ ...column, orders: orders.map(order => ({ ...order, items: order.items.filter(item => item.stage === column.stage) })).filter(order => order.items.length) })), [orders])
  const handleDragEnd = async ({ active, over }: DragEndEvent) => { if (!over || !active.data.current?.item || !active.data.current?.order || over.id === active.data.current.item.stage) return; const item = active.data.current.item as Item, order = active.data.current.order as Order; try { await api.patch(`/cozinha/pedidos/${order.id}/items/${item.id}`, { action: 'MOVE', targetStage: over.id, expectedUpdatedAt: order.updatedAt }); await load() } catch { setRefreshError('A comanda mudou. A fila será atualizada pelo SSE.') } }
  if (loading && !orders.length) return <div role="status" className="p-6">Carregando cozinha…</div>
  if (error && !orders.length) return <div className="p-6"><p role="alert">{error}</p></div>
  return <section className="space-y-6"><h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight"><ChefHat className="h-8 w-8" />Cozinha — {user?.establishment?.tradeName || 'Estabelecimento'}</h1><Card><CardHeader><CardTitle>Pedidos da cozinha</CardTitle></CardHeader><CardContent>{refreshError && <p role="alert" className="mb-4 text-destructive">{refreshError}</p>}<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}><div className="grid gap-4 lg:grid-cols-3">{grouped.map(column => <KitchenColumn key={column.stage} stage={column.stage} title={column.title} orders={column.orders} onInfo={(order, item) => setSelectedItem({ order, item })} />)}</div></DndContext><div className="mt-4 flex items-center justify-between"><Button variant="outline" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Anterior</Button><span className="text-sm text-muted-foreground">Pedidos desta página · {page}/{Math.max(totalPages, 1)}</span><Button variant="outline" disabled={page >= totalPages} onClick={() => setPage(value => value + 1)}>Próxima</Button></div></CardContent></Card><Dialog open={selectedItem !== null} onOpenChange={open => { if (!open) setSelectedItem(null) }}><DialogContent><DialogHeader><DialogTitle>Informações do pedido</DialogTitle><DialogDescription>Detalhes do item selecionado na cozinha.</DialogDescription></DialogHeader>{selectedItem && <dl className="grid gap-3 text-sm"><div><dt className="font-medium text-muted-foreground">Cliente</dt><dd>{selectedItem.order.customerName || 'Não informado'}</dd></div><div><dt className="font-medium text-muted-foreground">Pedido</dt><dd className="break-all">{selectedItem.order.id}</dd></div><div><dt className="font-medium text-muted-foreground">Feito em</dt><dd>{new Date(selectedItem.order.openedAt).toLocaleString()}</dd></div><div><dt className="font-medium text-muted-foreground">Item</dt><dd>{selectedItem.item.quantity}× {selectedItem.item.productName || 'Produto indisponível'}</dd></div><div><dt className="font-medium text-muted-foreground">Estado</dt><dd>{columns.find(column => column.stage === selectedItem.item.stage)?.title || selectedItem.item.stage}</dd></div></dl>}</DialogContent></Dialog></section>
}
