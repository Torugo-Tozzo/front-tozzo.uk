import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DndContext, PointerSensor, closestCenter, useDroppable, useDraggable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { ChefHat, GripVertical } from 'lucide-react'
import api from '@/services/api'
import { useRealtimeEvents } from '@/hooks/useRealtimeEvents'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Stage = 'REQUESTED' | 'IN_PREPARATION' | 'READY'
type Item = { id: string; productId: string; productName: string; quantity: number; stage: Stage; kitchenReadyAt: string | null }
type Order = { id: string; customerName: string | null; openedAt: string; updatedAt: string; items: Item[] }
const columns: { stage: Stage; title: string }[] = [{ stage: 'REQUESTED', title: 'Aguardando' }, { stage: 'IN_PREPARATION', title: 'Em preparo' }, { stage: 'READY', title: 'Pronto para servir' }]

function KitchenCard({ order, item }: { order: Order; item: Item }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: item.id, data: { order, item } })
  return <div ref={setNodeRef} style={{ transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined }} className={cn('rounded-lg border bg-card p-3 shadow-sm transition-shadow', isDragging && 'z-10 shadow-xl opacity-80')}><div className="flex items-start gap-2"><button type="button" aria-label="Mover item" className="mt-0.5 cursor-grab text-muted-foreground touch-none" {...listeners} {...attributes}><GripVertical className="h-4 w-4" /></button><div className="min-w-0 flex-1"><p className="truncate font-medium">{item.quantity}× {item.productName || 'Produto indisponível'}</p><p className="truncate text-sm text-muted-foreground">{order.customerName || `Pedido ${order.id.slice(0, 6)}`}</p></div></div></div>
}

function KitchenColumn({ stage, title, orders }: { stage: Stage; title: string; orders: Order[] }) {
  const { isOver, setNodeRef } = useDroppable({ id: stage })
  return <div ref={setNodeRef} className={cn('min-h-[360px] rounded-lg border-2 border-dashed p-3 transition-colors', isOver && 'border-primary bg-primary/5')}><div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">{title}</h2><span className="rounded-full bg-muted px-2 py-0.5 text-xs">{orders.reduce((total, order) => total + order.items.length, 0)}</span></div><div className="space-y-3">{orders.flatMap(order => order.items.map(item => <KitchenCard key={item.id} order={order} item={item} />))}</div></div>
}

export default function KitchenPage() {
  const { user } = useAuth()
  const [orders, setOrders] = useState<Order[]>([]), [page, setPage] = useState(1), [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [refreshError, setRefreshError] = useState('')
  const request = useRef(0), inFlight = useRef(false), queued = useRef(false)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const load = useCallback(async () => { if (inFlight.current) { queued.current = true; return }; inFlight.current = true; const token = ++request.current; try { const response = await api.get('/cozinha/pedidos', { params: { page, limit: 50 } }); if (token !== request.current) return; setOrders(response.data.orders); setTotalPages(response.data.totalPages); setError(''); setRefreshError('') } catch { if (orders.length) setRefreshError('Não foi possível atualizar a cozinha.'); else setError('Não foi possível carregar a cozinha.') } finally { inFlight.current = false; setLoading(false); if (queued.current) { queued.current = false; void load() } } }, [page])
  useRealtimeEvents(['orders'], load)
  useEffect(() => { void load(); const timer = setInterval(() => void load(), 15000); const onVisible = () => { if (document.visibilityState === 'visible') void load() }; document.addEventListener('visibilitychange', onVisible); return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); request.current++ } }, [load])
  const grouped = useMemo(() => columns.map(column => ({ ...column, orders: orders.map(order => ({ ...order, items: order.items.filter(item => item.stage === column.stage) })).filter(order => order.items.length) })), [orders])
  const handleDragEnd = async ({ active, over }: DragEndEvent) => { if (!over || !active.data.current?.item || !active.data.current?.order || over.id === active.data.current.item.stage) return; const item = active.data.current.item as Item, order = active.data.current.order as Order; try { await api.patch(`/cozinha/pedidos/${order.id}/items/${item.id}`, { action: 'MOVE', targetStage: over.id, expectedUpdatedAt: order.updatedAt }); await load() } catch { setRefreshError('A comanda mudou. A fila será atualizada pelo SSE.') } }
  if (loading && !orders.length) return <div role="status" className="p-6">Carregando cozinha…</div>
  if (error && !orders.length) return <div className="p-6"><p role="alert">{error}</p></div>
  return <section className="space-y-6"><h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight"><ChefHat className="h-8 w-8" />Cozinha — {user?.establishment?.tradeName || 'Estabelecimento'}</h1><Card><CardHeader><CardTitle>Pedidos da cozinha</CardTitle></CardHeader><CardContent>{refreshError && <p role="alert" className="mb-4 text-destructive">{refreshError}</p>}<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}><div className="grid gap-4 lg:grid-cols-3">{grouped.map(column => <KitchenColumn key={column.stage} stage={column.stage} title={column.title} orders={column.orders} />)}</div></DndContext><div className="mt-4 flex items-center justify-between"><Button variant="outline" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Anterior</Button><span className="text-sm text-muted-foreground">Pedidos desta página · {page}/{Math.max(totalPages, 1)}</span><Button variant="outline" disabled={page >= totalPages} onClick={() => setPage(value => value + 1)}>Próxima</Button></div></CardContent></Card></section>
}
