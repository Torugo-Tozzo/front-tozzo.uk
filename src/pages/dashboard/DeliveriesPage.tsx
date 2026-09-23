import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DndContext, PointerSensor, closestCenter, pointerWithin, useDndContext, useDraggable, useDroppable, useSensor, useSensors, type CollisionDetection, type DragEndEvent } from '@dnd-kit/core'
import { Bike, Check, Eye, GripVertical, LockKeyhole, Pencil, Plus, RotateCcw, UserRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import api, { getErrorCode } from '@/services/api'
import { useAuth } from '@/contexts/AuthContext'
import { useRealtimeEvents } from '@/hooks/useRealtimeEvents'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCurrencyBRL, formatDateTime } from '@/i18n/format'
import { cn } from '@/lib/utils'
import { ProductSelectionModal } from '@/components/ProductSelectionModal'
import type { PaymentMethod } from '@/domain/models'

type Stage = 'WAITING' | 'DELIVERING'
type Driver = { id: string; name: string; phone: string | null; available: boolean }
type DeliveryOrder = { id: string; customerName: string | null; address: string; total: number; openedAt: string; updatedAt: string; stage: Stage; driverId: string | null; driverName: string | null; driverPhone: string | null; externalDriverName: string | null; externalDriverPhone: string | null; items: { id: string; productId: string; unitPriceAtOrder: number | string; name: string; quantity: number; status: string }[] }

const deliveryCollisionDetection: CollisionDetection = args => args.active.data.current?.type === 'driver'
  ? pointerWithin({ ...args, droppableContainers: args.droppableContainers.filter(container => container.data.current?.type === 'order-target' && container.data.current.order?.stage === 'WAITING') })
  : closestCenter(args)

function DriverIdentity({ driver }: { driver: Driver }) {
  const { t } = useTranslation('deliveries')
  return <><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"><UserRound className="h-5 w-5" aria-hidden="true" /></span><span className="min-w-0 text-left"><span className="block truncate font-medium">{driver.name}</span><span className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className={cn('h-2 w-2 rounded-full', driver.available ? 'bg-green-500' : 'bg-amber-500')} />{t(driver.available ? 'available' : 'busy')}</span></span></>
}

function DriverRosterTile({ driver }: { driver: Driver }) {
  const { t } = useTranslation('deliveries')
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `driver:${driver.id}`, data: { type: 'driver', driver }, disabled: !driver.available })
  return <div ref={setNodeRef} {...attributes} {...listeners} aria-disabled={!driver.available} title={driver.available ? t('dragDriver') : t('driverBusy')} style={{ transform: transform ? `translate3d(${transform.x}px,${transform.y}px,0)` : undefined }} className={cn('flex items-center gap-3 rounded-lg border bg-card px-3 py-2 text-sm transition-shadow', driver.available ? 'touch-none cursor-grab hover:border-primary hover:shadow-md active:cursor-grabbing' : 'cursor-not-allowed opacity-55', isDragging && 'relative z-20 shadow-xl')}><DriverIdentity driver={driver} />{driver.available ? <GripVertical className="ml-auto h-4 w-4 text-muted-foreground" aria-hidden="true" /> : <LockKeyhole className="ml-auto h-4 w-4 text-muted-foreground" aria-hidden="true" />}</div>
}

function OrderCard({ order, canManage, onAssign, onMove, onClose, onDetails }: { order: DeliveryOrder; canManage: boolean; onAssign: (order: DeliveryOrder) => void; onMove: (order: DeliveryOrder, stage: Stage) => void; onClose: (order: DeliveryOrder) => void; onDetails: (order: DeliveryOrder) => void }) {
  const { t, i18n } = useTranslation('deliveries')
  const draggable = canManage || order.stage === 'WAITING'
  const { attributes, listeners, setNodeRef: setDraggableRef, transform, isDragging } = useDraggable({ id: `order:${order.id}`, data: { type: 'order', order }, disabled: !draggable })
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({ id: `order-target:${order.id}`, data: { type: 'order-target', order } })
  const { active } = useDndContext()
  const setCardRef = useCallback((node: HTMLElement | null) => { setDraggableRef(node); setDroppableRef(node) }, [setDraggableRef, setDroppableRef])
  const ready = order.items.length > 0 && order.items.every(item => item.status === 'READY' || item.status === 'DELIVERED')
  const assigned = Boolean(order.driverId || order.externalDriverName)
  const driverDropTarget = canManage && order.stage === 'WAITING' && active?.data.current?.type === 'driver'
  return <article ref={setCardRef} {...listeners} style={{ transform: transform ? `translate3d(${transform.x}px,${transform.y}px,0)` : undefined }} className={cn('rounded-lg border bg-card p-3 shadow-sm transition-shadow', draggable && 'touch-none cursor-grab hover:shadow-md active:cursor-grabbing', isDragging && 'relative z-10 opacity-80 shadow-xl', driverDropTarget && 'border-dashed border-primary/60', driverDropTarget && isOver && 'border-2 border-primary bg-primary/5')}>
    <div className="flex gap-2"><span {...attributes} aria-label={t('dragCard')} title={t('dragCard')} className="mt-1 shrink-0 text-muted-foreground"><GripVertical className="h-4 w-4" /></span><div className="min-w-0"><h3 className="font-semibold">{order.customerName || t('orderFallback', { id: order.id.slice(0, 6) })}</h3><p className="break-words text-sm">{order.address}</p></div></div>
    <p className="mt-2 text-xs text-muted-foreground">{formatDateTime(order.openedAt, i18n.language)} · {formatCurrencyBRL(Number(order.total), i18n.language)}</p>
    <p className="mt-1 text-sm">{t('driver')}: {order.driverName || t('unassigned')}{order.driverPhone ? ` · ${order.driverPhone}` : ''}</p>
    <ul className="mt-2 list-inside list-disc text-sm">{order.items.slice(0, 3).map(item => <li key={item.id}>{item.quantity}× {item.name} · {t(item.status === 'READY' || item.status === 'DELIVERED' ? 'ready' : 'preparing')}</li>)}</ul>
    {order.items.length > 3 && <p className="mt-1 text-sm text-muted-foreground" aria-label={t('moreItems', { count: order.items.length - 3 })}>…</p>}
    <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
      <div className="flex min-w-0 justify-start">
        {canManage && order.stage === 'WAITING' && <Button size="sm" variant="outline" className="max-w-full px-2 sm:px-3" aria-label={t(assigned ? 'editDriver' : 'assign')} onPointerDown={event => event.stopPropagation()} onClick={() => onAssign(order)}>{assigned ? <Pencil className="h-4 w-4 shrink-0 sm:mr-1" /> : <Plus className="h-4 w-4 shrink-0 sm:mr-1" />}<span className="hidden truncate sm:inline">{t(assigned ? 'editDriver' : 'assign')}</span></Button>}
        {canManage && order.stage === 'DELIVERING' && <Button size="sm" variant="outline" className="max-w-full px-2 sm:px-3" aria-label={t('returnToWaiting')} onPointerDown={event => event.stopPropagation()} onClick={() => onMove(order, 'WAITING')}><RotateCcw className="h-4 w-4 shrink-0 sm:mr-1" /><span className="hidden truncate sm:inline">{t('returnToWaiting')}</span></Button>}
      </div>
      <Button size="sm" variant="outline" className="px-2 sm:px-3" aria-label={t('viewDetails')} onPointerDown={event => event.stopPropagation()} onClick={() => onDetails(order)}><Eye className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">{t('viewDetails')}</span></Button>
      <div className="flex min-w-0 justify-end">
        {order.stage === 'WAITING' && <Button size="sm" className="max-w-full px-2 sm:px-3" aria-label={t('start')} disabled={!ready || !order.driverName} title={!ready ? t('notReady') : undefined} onPointerDown={event => event.stopPropagation()} onClick={() => onMove(order, 'DELIVERING')}><Bike className="h-4 w-4 shrink-0 sm:mr-1" /><span className="hidden truncate sm:inline">{t('start')}</span></Button>}
        {canManage && order.stage === 'DELIVERING' && <Button size="sm" className="max-w-full px-2 sm:px-3" aria-label={t('finish')} onPointerDown={event => event.stopPropagation()} onClick={() => onClose(order)}><Check className="h-4 w-4 shrink-0 sm:mr-1" /><span className="hidden truncate sm:inline">{t('finish')}</span></Button>}
      </div>
    </div>
  </article>
}

function Column({ stage, orders, canManage, onAssign, onMove, onClose, onDetails }: { stage: Stage; orders: DeliveryOrder[]; canManage: boolean; onAssign: (order: DeliveryOrder) => void; onMove: (order: DeliveryOrder, stage: Stage) => void; onClose: (order: DeliveryOrder) => void; onDetails: (order: DeliveryOrder) => void }) {
  const { t } = useTranslation('deliveries')
  const { setNodeRef, isOver } = useDroppable({ id: `stage:${stage}`, data: { type: 'stage', stage } })
  return <div ref={setNodeRef} className={`min-h-80 rounded-lg border-2 border-dashed p-3 ${isOver ? 'border-primary bg-primary/5' : ''}`}><h2 className="mb-3 font-semibold">{t(`stages.${stage}`)} <span className="text-muted-foreground">({orders.length})</span></h2><div className="space-y-3">{orders.map(order => <OrderCard key={order.id} order={order} canManage={canManage} onAssign={onAssign} onMove={onMove} onClose={onClose} onDetails={onDetails} />)}</div></div>
}

export default function DeliveriesPage() {
  const { user } = useAuth()
  const { t } = useTranslation('deliveries')
  const { t: common } = useTranslation('common')
  const canManage = user?.role !== 'DRIVER'
  const [orders, setOrders] = useState<DeliveryOrder[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [selected, setSelected] = useState<DeliveryOrder | null>(null)
  const [dialog, setDialog] = useState<'assign' | 'finish' | 'details' | null>(null)
  const [driverMode, setDriverMode] = useState<'fixed' | 'external'>('fixed')
  const [driverId, setDriverId] = useState('')
  const [externalName, setExternalName] = useState('')
  const [externalPhone, setExternalPhone] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>('')
  const sequence = useRef(0)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const load = useCallback(async () => {
    const token = ++sequence.current
    try {
      const response = await api.get('/entregas/pedidos', { params: { page, limit: 50 } })
      if (token !== sequence.current) return
      setOrders(response.data.orders ?? [])
      setDrivers(response.data.drivers ?? [])
      setTotalPages(response.data.totalPages ?? 0)
      setError('')
    } catch {
      if (token === sequence.current) setError(t('loadError'))
    } finally { if (token === sequence.current) setLoading(false) }
  }, [page, t])

  useRealtimeEvents(['orders'], load)
  useEffect(() => {
    void load()
    const timer = setInterval(() => void load(), 15000)
    const visible = () => { if (document.visibilityState === 'visible') void load() }
    document.addEventListener('visibilitychange', visible)
    return () => { sequence.current++; clearInterval(timer); document.removeEventListener('visibilitychange', visible) }
  }, [load])

  const columns = useMemo(() => (['WAITING', 'DELIVERING'] as Stage[]).map(stage => ({ stage, orders: orders.filter(order => order.stage === stage) })), [orders])
  const detailItems = useMemo(() => selected?.items.map(item => ({ id: item.id, productId: item.productId, quantity: item.quantity, name: item.name, unitPrice: Number(item.unitPriceAtOrder), status: item.status as 'REQUESTED' | 'IN_PREPARATION' | 'READY' | 'DELIVERED' })) ?? [], [selected])

  const move = async (order: DeliveryOrder, stage: Stage) => {
    if (busy || order.stage === stage) return
    setBusy(true)
    try {
      await api.patch(`/entregas/pedidos/${order.id}`, { action: stage === 'DELIVERING' ? 'START' : 'WAIT', expectedUpdatedAt: order.updatedAt })
      await load()
    } catch (cause) { setError(t(getErrorCode(cause) === 'ORDER_NOT_READY' ? 'notReady' : 'changeError')) }
    finally { setBusy(false) }
  }

  const openAssign = (order: DeliveryOrder) => {
    setSelected(order); setDialog('assign')
    setDriverMode(order.driverId || !order.externalDriverName ? 'fixed' : 'external')
    setDriverId(order.driverId ?? ''); setExternalName(order.externalDriverName ?? ''); setExternalPhone(order.externalDriverPhone ?? '')
  }

  const saveAssignment = async (order: DeliveryOrder, assignment: { driverId: string } | { externalDriverName: string; externalDriverPhone: string }, closeDialog = false) => {
    if (busy) return
    setBusy(true)
    try {
      await api.patch(`/entregas/pedidos/${order.id}`, { action: 'ASSIGN', expectedUpdatedAt: order.updatedAt, ...assignment })
      if (closeDialog) setDialog(null)
      await load()
    } catch (cause) { setError(t(getErrorCode(cause) === 'DRIVER_BUSY' ? 'driverBusy' : 'changeError')) }
    finally { setBusy(false) }
  }

  const assign = async () => {
    if (!selected || busy) return
    if (driverMode === 'fixed') {
      if (!drivers.some(driver => driver.id === driverId && driver.available)) { setError(t('driverRequired')); return }
      await saveAssignment(selected, { driverId }, true)
    } else {
      if (!externalName.trim() || !externalPhone.trim()) { setError(t('driverRequired')); return }
      await saveAssignment(selected, { externalDriverName: externalName.trim(), externalDriverPhone: externalPhone.trim() }, true)
    }
  }

  const finish = async () => {
    if (!selected || busy) return
    setBusy(true)
    try {
      await api.post(`/pedidos/${selected.id}/status`, { isOpen: false, paymentMethod: paymentMethod || null })
      setDialog(null); await load()
    } catch { setError(t('closeError')) }
    finally { setBusy(false) }
  }

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over) return
    const source = active.data.current
    const target = over.data.current
    if (source?.type === 'driver' && target?.type === 'order-target') {
      const driver = source.driver as Driver
      const order = target.order as DeliveryOrder
      if (canManage && driver.available && order.stage === 'WAITING') void saveAssignment(order, { driverId: driver.id })
    } else if (source?.type === 'order') {
      const stage = target?.type === 'stage' ? target.stage : target?.type === 'order-target' ? (target.order as DeliveryOrder).stage : null
      if (stage === 'WAITING' || stage === 'DELIVERING') void move(source.order as DeliveryOrder, stage)
    }
  }

  if (loading && !orders.length) return <div role="status">{t('loading')}</div>
  return <section className="space-y-5">
    <h1 className="flex items-center gap-2 text-3xl font-bold"><Bike className="h-8 w-8" />{t('pageTitle', { establishment: user?.establishment?.tradeName || t('establishmentFallback') })}</h1>
    {error && <p role="alert" className="text-destructive">{error}</p>}
    <DndContext sensors={sensors} collisionDetection={deliveryCollisionDetection} onDragEnd={onDragEnd}>
    <Card><CardHeader><CardTitle>{t('boardTitle')}</CardTitle></CardHeader><CardContent>
      <div className="grid gap-4 lg:grid-cols-2">{columns.map(column => <Column key={column.stage} {...column} canManage={canManage} onAssign={openAssign} onMove={move} onDetails={order => { setSelected(order); setDialog('details') }} onClose={order => { setSelected(order); setPaymentMethod(''); setDialog('finish') }} />)}</div>
      <div className="mt-4 flex items-center justify-between"><Button variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>{common('previous')}</Button><span>{page}/{Math.max(totalPages, 1)}</span><Button variant="outline" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>{common('next')}</Button></div>
    </CardContent></Card>
    {canManage && <Card><CardHeader><CardTitle>{t('driversTitle')}</CardTitle></CardHeader><CardContent className="flex flex-wrap gap-2">{drivers.length ? drivers.map(driver => <DriverRosterTile key={driver.id} driver={driver} />) : <p>{t('noDrivers')}</p>}</CardContent></Card>}
    </DndContext>
    <Dialog open={dialog === 'assign'} onOpenChange={open => { if (!open && !busy) setDialog(null) }}><DialogContent><DialogHeader><DialogTitle>{t(selected?.driverId || selected?.externalDriverName ? 'editDriver' : 'assignTitle')}</DialogTitle><DialogDescription>{selected?.address}</DialogDescription></DialogHeader>
      <div className="space-y-3"><div className="flex gap-4"><label><input type="radio" checked={driverMode === 'fixed'} onChange={() => setDriverMode('fixed')} /> {t('fixedDriver')}</label><label><input type="radio" checked={driverMode === 'external'} onChange={() => setDriverMode('external')} /> {t('externalDriver')}</label></div>
      {driverMode === 'fixed' ? <div role="group" aria-label={t('fixedDriver')} className="grid max-h-60 gap-2 overflow-y-auto sm:grid-cols-2">{drivers.length ? drivers.map(driver => <button key={driver.id} type="button" disabled={!driver.available} aria-pressed={driverId === driver.id} title={!driver.available ? t('driverBusy') : undefined} onClick={() => setDriverId(driver.id)} className={cn('flex items-center gap-3 rounded-lg border p-2 text-sm transition-colors', driverId === driver.id ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:border-primary/60', driver.available ? 'cursor-pointer' : 'cursor-not-allowed opacity-55')}><DriverIdentity driver={driver} />{!driver.available && <LockKeyhole className="ml-auto h-4 w-4 shrink-0" aria-hidden="true" />}</button>) : <p className="text-sm text-muted-foreground">{t('noDrivers')}</p>}</div> : <><div><Label htmlFor="external-name">{t('externalName')}</Label><Input id="external-name" value={externalName} onChange={event => setExternalName(event.target.value)} maxLength={120} placeholder={t('externalExample')} /></div><div><Label htmlFor="external-phone">{t('externalPhone')}</Label><Input id="external-phone" type="tel" value={externalPhone} onChange={event => setExternalPhone(event.target.value)} maxLength={40} /></div></>}
      </div><DialogFooter><Button disabled={busy || driverMode === 'fixed' && !drivers.some(driver => driver.id === driverId && driver.available)} onClick={() => void assign()}>{t('saveDriver')}</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={dialog === 'finish'} onOpenChange={open => { if (!open && !busy) setDialog(null) }}><DialogContent><DialogHeader><DialogTitle>{t('finishTitle')}</DialogTitle><DialogDescription>{t('finishDescription')}</DialogDescription></DialogHeader><div><Label htmlFor="delivery-payment">{t('paymentMethod')}</Label><select id="delivery-payment" className="w-full rounded border bg-background p-2" value={paymentMethod} onChange={event => setPaymentMethod(event.target.value as PaymentMethod | '')}><option value="">{t('notInformed')}</option><option value="CASH">{t('payment.CASH')}</option><option value="PIX">{t('payment.PIX')}</option><option value="CREDIT_CARD">{t('payment.CREDIT_CARD')}</option><option value="DEBIT_CARD">{t('payment.DEBIT_CARD')}</option><option value="ON_ACCOUNT">{t('payment.ON_ACCOUNT')}</option></select></div><DialogFooter><Button disabled={busy} onClick={() => void finish()}>{t('confirmFinish')}</Button></DialogFooter></DialogContent></Dialog>
    <ProductSelectionModal isOpen={dialog === 'details'} onClose={() => setDialog(null)} onConfirm={async () => {}} readOnly allowDelivery title={t('detailsTitle')} description={t('detailsDescription')} initialClientName={selected?.customerName ?? ''} initialDelivery={{ isDelivery: true, deliveryAddress: selected?.address ?? null }} initialItems={detailItems} />
  </section>
}
