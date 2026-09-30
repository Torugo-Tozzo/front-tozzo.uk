import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { servicesApi, type ServiceOrderQuoteInput } from '@/services/api'
import { serviceOrderTotal, type ServiceOffering, type ServiceOrder } from '@/domain/services'
import type { Product } from '@/domain/models'
import api from '@/services/api'
import { parseListResponse } from '@/services/parseResponse'
import { formatCurrencyBRL, formatDateTime } from '@/i18n/format'
import { useConfirm } from '@/contexts/ConfirmContext'

type DraftLine = { key: string; kind: 'product' | 'service'; id: string; quantity: number; unitPrice: number; name: string }
export default function ServiceOrderPage() {
  const { id } = useParams()
  const { t, i18n } = useTranslation('estimates')
  const confirm = useConfirm()
  const [order, setOrder] = useState<ServiceOrder | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [offerings, setOfferings] = useState<ServiceOffering[]>([])
  const [lines, setLines] = useState<DraftLine[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [customerName, setCustomerName] = useState('')
  const [description, setDescription] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [responsibleId, setResponsibleId] = useState('')
  const [employees, setEmployees] = useState<{id:string|number;name:string}[]>([])

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true); setError('')
    try {
      const [data, productResponse, serviceResult, userResponse] = await Promise.all([
        servicesApi.getOrder(id), api.get('/produtos?page=1&limit=100&search='), servicesApi.list({ page: 1, limit: 100, active: true }), api.get('/usuarios?page=1&limit=100&search='),
      ])
      setOrder(data); setCustomerName(data.customerName); setDescription(data.description); setDueAt(data.dueAt?.slice(0, 10) ?? ''); setResponsibleId(data.responsibleId == null ? '' : String(data.responsibleId))
      setLines(data.items.map((item, index) => ({ key: String(item.id ?? index), kind: item.productId ? 'product' : 'service', id: String(item.productId ?? item.serviceOfferingId), quantity: item.quantity, unitPrice: item.unitPrice, name: item.description })))
      setProducts(parseListResponse<Product>(productResponse).data); setOfferings(serviceResult.data)
      const users = parseListResponse<{id:string|number;name:string}>(userResponse).data; setEmployees(users)
    } catch (cause) { console.error('Error loading service order', cause); setError(t('loadError')) }
    finally { setLoading(false) }
  }, [id, t])
  useEffect(() => { void load() }, [load])
  const mutate = async (action: () => Promise<unknown>) => {
    setBusy(true); setError('')
    try { await action(); await load() }
    catch (cause) { console.error('Error updating service order', cause); const status = (cause as {response?:{status?:number}})?.response?.status; setError(status === 409 ? t('conflict') : t('saveError')) }
    finally { setBusy(false) }
  }
  const saveDetails = () => order && mutate(async () => { const updated = await servicesApi.updateOrder(order.id, { customerName, description, dueAt: dueAt || null, responsibleId: responsibleId || null, expectedUpdatedAt: order.updatedAt }); setOrder(updated); setEditing(false) })
  const saveQuote = () => order && mutate(async () => { const payload: ServiceOrderQuoteInput[] = lines.map((line) => ({ [line.kind === 'product' ? 'productId' : 'serviceOfferingId']: line.id, quantity: line.quantity, unitPrice: line.unitPrice })); const updated = await servicesApi.replaceQuote(order.id, order.updatedAt, payload); setOrder(updated) })
  const addLine = (kind: DraftLine['kind'], value: string) => {
    if (!value) return
    const catalog = kind === 'product' ? products.find((item) => String(item.id) === value) : offerings.find((item) => String(item.id) === value)
    if (!catalog) return
    const price = kind === 'product' ? Number((catalog as Product).price) : Number((catalog as ServiceOffering).referencePrice ?? 0)
    setLines((previous) => [...previous, { key: `${kind}-${value}-${Date.now()}`, kind, id: value, quantity: 1, unitPrice: price, name: catalog.name }])
  }
  const action = (verb: 'aprovar'|'iniciar'|'fechar'|'cancelar'|'reabrir') => order && mutate(async () => { const result = await servicesApi.action(order.id, verb, order.updatedAt); if (verb === 'fechar' && result.sale) sessionStorage.setItem('tozzo-last-service-sale', String(result.sale.id)) })
  const askClose = async () => { if (order && await confirm({ description: t('confirmClose'), confirmLabel: t('close'), destructive: false })) await action('fechar') }
  if (loading) return <p role="status" className="py-12 text-center">{t('loading')}</p>
  if (!order) return <main><Link to="/dashboard/estimates" className="underline">{t('back')}</Link><p role="alert">{error || t('loadError')}</p></main>
  const canQuote = order.status === 'ABERTA' || order.status === 'ORCADA'
  return <main className="space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><Link to="/dashboard/estimates" className="text-sm underline">{t('back')}</Link><h1 className="mt-2 text-3xl font-bold">{order.customerName}</h1><p className="text-muted-foreground">{order.description}</p></div><span className="rounded-full border px-3 py-1">{t(`statuses.${order.status}`)}</span></header>
    {error && <div role="alert" className="rounded-md border border-destructive p-3 text-destructive">{error} <Button variant="outline" size="sm" onClick={() => void load()}>{t('reload')}</Button></div>}
    <Card><CardHeader className="flex flex-row items-center justify-between"><CardTitle>{t('details')}</CardTitle>{!editing && <Button variant="outline" onClick={() => setEditing(true)} disabled={busy || ['CONCLUIDA','CANCELADA'].includes(order.status)}>{t('editDetails')}</Button>}</CardHeader><CardContent className="grid gap-4 md:grid-cols-2">
      <div><Label htmlFor="order-customer">{t('customerName')}</Label><Input id="order-customer" disabled={!editing} value={customerName} onChange={(e) => setCustomerName(e.target.value)} /></div><div><Label htmlFor="order-description">{t('workDescription')}</Label><Input id="order-description" disabled={!editing} value={description} onChange={(e) => setDescription(e.target.value)} /></div><div><Label htmlFor="order-due">{t('dueAt')}</Label><Input id="order-due" type="date" disabled={!editing} value={dueAt} onChange={(e) => setDueAt(e.target.value)} /></div><div><Label htmlFor="order-responsible">{t('responsible')}</Label><select id="order-responsible" disabled={!editing} className="h-10 w-full rounded-md border bg-background px-3" value={responsibleId} onChange={(e) => setResponsibleId(e.target.value)}><option value="">{t('noResponsible')}</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select></div>
      {editing && <div className="flex gap-2 md:col-span-2"><Button onClick={() => void saveDetails()} disabled={busy}>{t('saveDetails')}</Button><Button variant="outline" onClick={() => { setEditing(false); void load() }}>{t('cancelEdit')}</Button></div>}
    </CardContent></Card>
    <Card><CardHeader><CardTitle>{t('quote')}</CardTitle></CardHeader><CardContent className="space-y-4">
      {canQuote && <div className="flex flex-wrap gap-2"><select aria-label={t('addProduct')} className="h-10 rounded-md border bg-background px-3" defaultValue="" onChange={(e) => { addLine('product', e.target.value); e.target.value = '' }}><option value="">{t('addProduct')}</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select><select aria-label={t('addService')} className="h-10 rounded-md border bg-background px-3" defaultValue="" onChange={(e) => { addLine('service', e.target.value); e.target.value = '' }}><option value="">{t('addService')}</option>{offerings.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>}
      {lines.length === 0 && <p className="text-muted-foreground">{t('emptyItems')}</p>}
      {lines.map((line, index) => <div key={line.key} className="grid items-end gap-2 border-b pb-3 md:grid-cols-[1fr_100px_140px_auto]"><div><span className="text-xs text-muted-foreground">{t(line.kind)}</span><p>{line.name}</p></div><div><Label htmlFor={`qty-${line.key}`}>{t('quantity')}</Label><Input id={`qty-${line.key}`} type="number" min="1" step="1" disabled={!canQuote} value={line.quantity} onChange={(e) => setLines(lines.map((item, i) => i === index ? {...item, quantity: Math.max(1, Number(e.target.value))} : item))} /></div><div><Label htmlFor={`price-${line.key}`}>{t('unitPrice')}</Label><Input id={`price-${line.key}`} type="number" min="0" step="any" disabled={!canQuote} value={line.unitPrice} onChange={(e) => setLines(lines.map((item, i) => i === index ? {...item, unitPrice: Number(e.target.value)} : item))} /></div>{canQuote && <Button variant="outline" onClick={() => setLines(lines.filter((item) => item.key !== line.key))}>{t('remove')}</Button>}</div>)}
      <p className="text-right text-lg font-semibold">{t('total')}: {formatCurrencyBRL(serviceOrderTotalSafe(lines), i18n.language)}</p>
      {canQuote && <div className="flex flex-wrap gap-2"><Button disabled={busy || lines.length === 0} onClick={() => void saveQuote()}>{t('saveQuote')}</Button>{order.status === 'ORCADA' && <Button disabled={busy} onClick={() => void action('aprovar')}>{t('approve')}</Button>}</div>}
    </CardContent></Card>
    <Card><CardHeader><CardTitle>{t('history')}</CardTitle></CardHeader><CardContent><ol className="space-y-3">{(order.events ?? []).map((event) => <li key={event.id} className="border-l-2 pl-3"><p>{event.action} · {t(`statuses.${event.toStatus}`)}</p><time className="text-xs text-muted-foreground">{formatDateTime(event.createdAt, i18n.language)}</time></li>)}</ol>{order.sale && <p className="mt-4">{t('linkedSale')}: #{order.sale.id}</p>}</CardContent></Card>
    <div className="flex flex-wrap gap-2">{order.status === 'APROVADA' && <Button disabled={busy} onClick={() => void action('iniciar')}>{t('start')}</Button>}{order.status === 'EM_EXECUCAO' && <Button disabled={busy} onClick={() => void askClose()}>{t('close')}</Button>}{!['CONCLUIDA','CANCELADA'].includes(order.status) && <Button variant="outline" disabled={busy} onClick={() => void action('cancelar')}>{t('cancelOrder')}</Button>}{['CONCLUIDA','CANCELADA'].includes(order.status) && <Button variant="outline" disabled={busy} onClick={() => void action('reabrir')}>{t('reopen')}</Button>}</div>
  </main>
}
function serviceOrderTotalSafe(lines: DraftLine[]) { try { return serviceOrderTotal(lines.map((line) => ({ productId: line.kind === 'product' ? line.id : null, serviceOfferingId: line.kind === 'service' ? line.id : null, description: line.name, quantity: line.quantity, unitPrice: line.unitPrice }))) } catch { return 0 } }
