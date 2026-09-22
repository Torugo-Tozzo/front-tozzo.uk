import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChefHat, RefreshCw } from 'lucide-react'
import api from '@/services/api'
import { useRealtimeEvents } from '@/hooks/useRealtimeEvents'
import { Button } from '@/components/ui/button'

type Stage = 'REQUESTED' | 'IN_PREPARATION' | 'READY'
type Item = { id: string; productId: string; productName: string; quantity: number; stage: Stage; kitchenReadyAt: string | null }
type Order = { id: string; customerName: string | null; openedAt: string; updatedAt: string; items: Item[] }

export default function KitchenPage() {
  const [orders, setOrders] = useState<Order[]>([]), [page, setPage] = useState(1), [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [refreshError, setRefreshError] = useState('')
  const request = useRef(0), inFlight = useRef(false), queued = useRef(false)
  const load = useCallback(async () => {
    if (inFlight.current) { queued.current = true; return }
    inFlight.current = true; const token = ++request.current
    try { const response = await api.get('/cozinha/pedidos', { params: { page, limit: 50 } }); if (token !== request.current) return
      setOrders(response.data.orders); setTotalPages(response.data.totalPages); setError(''); setRefreshError('')
    } catch { if (orders.length) setRefreshError('Não foi possível atualizar a cozinha.'); else setError('Não foi possível carregar a cozinha.')
    } finally { inFlight.current = false; setLoading(false); if (queued.current) { queued.current = false; void load() } }
  }, [page])
  useRealtimeEvents(['orders'], load)
  useEffect(() => { void load(); const timer = setInterval(() => void load(), 15000); const onVisible = () => { if (document.visibilityState === 'visible') void load() }; document.addEventListener('visibilitychange', onVisible); return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); request.current++ } }, [load])
  const action = async (order: Order, item: Item) => { try { await api.patch(`/cozinha/pedidos/${order.id}/items/${item.id}`, { action: item.stage === 'REQUESTED' ? 'START' : 'READY', expectedUpdatedAt: order.updatedAt }); await load() } catch { setRefreshError('A comanda mudou. Atualize para tentar novamente.') } }
  const columns = useMemo(() => ['REQUESTED', 'IN_PREPARATION', 'READY'].map(stage => ({ stage, orders: orders.map(order => ({ ...order, items: order.items.filter(item => item.stage === stage) })).filter(order => order.items.length) })), [orders])
  if (loading && !orders.length) return <div role="status" className="p-6">Carregando cozinha…</div>
  if (error && !orders.length) return <div className="p-6"><p role="alert">{error}</p><Button onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" />Tentar novamente</Button></div>
  return <section className="space-y-4"><div className="flex items-center justify-between"><h1 className="text-2xl font-semibold flex items-center gap-2"><ChefHat />Cozinha</h1><Button variant="outline" onClick={() => void load()}>Atualizar</Button></div>{refreshError && <p role="alert" className="text-destructive">{refreshError}</p>}<div className="grid gap-4 md:grid-cols-3">{columns.map(column => <div key={column.stage} className="space-y-3"><h2 className="font-semibold">{column.stage === 'REQUESTED' ? 'Aguardando' : column.stage === 'IN_PREPARATION' ? 'Em preparo' : 'Prontos para servir'}</h2>{column.orders.map(order => <div key={order.id} className="rounded-lg border bg-card p-4 space-y-2"><p className="font-medium">{order.customerName || `Pedido ${order.id.slice(0, 6)}`}</p>{order.items.map(item => <div key={item.id} className="flex items-center justify-between gap-2"><span>{item.quantity}× {item.productName || 'Produto indisponível'}</span>{item.stage === 'READY' ? <span>Pronto para servir</span> : <Button size="sm" onClick={() => void action(order, item)}>{item.stage === 'REQUESTED' ? 'Iniciar preparo' : 'Marcar pronto'}</Button>}</div>)}</div>)}</div>)}</div><div className="flex justify-between"><Button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Anterior</Button><span>Pedidos desta página · {page}/{Math.max(totalPages, 1)}</span><Button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Próxima</Button></div></section>
}
