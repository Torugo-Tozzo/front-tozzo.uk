import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Pagination } from '@/components/Pagination'
import { servicesApi } from '@/services/api'
import type { ServiceOrder, ServiceOrderStatus } from '@/domain/services'
import { formatCurrencyBRL, formatDateTime } from '@/i18n/format'

const statuses: ServiceOrderStatus[] = ['ABERTA', 'ORCADA', 'APROVADA', 'EM_EXECUCAO', 'CONCLUIDA', 'CANCELADA']

export default function EstimatesPage() {
  const { t, i18n } = useTranslation('estimates')
  const navigate = useNavigate()
  const [orders, setOrders] = useState<ServiceOrder[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [status, setStatus] = useState<ServiceOrderStatus | ''>('')
  const [dueBefore, setDueBefore] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const [customerName, setCustomerName] = useState('')
  const [description, setDescription] = useState('')
  const [createError, setCreateError] = useState(false)
  useEffect(() => {
    let alive = true
    setLoading(true); setError(false)
    servicesApi.listOrders({ page, limit, status: status || undefined, dueBefore: dueBefore || undefined }).then((result) => {
      if (alive) { setOrders(result.data); setTotal(result.total) }
    }).catch((cause) => { console.error('Error loading service orders', cause); if (alive) setError(true) }).finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [page, limit, status, dueBefore, refresh])
  return <main className="space-y-6">
    <header><h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1><p className="mt-1 text-muted-foreground">{t('description')}</p></header>
    <Card><CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3"><CardTitle>{t('title')}</CardTitle><Button onClick={() => { setCreating((value) => !value); setCreateError(false) }}>{creating ? t('cancelEdit') : t('newOrderButton')}</Button></CardHeader><CardContent>{creating && <form className="mb-5 grid gap-3 rounded-md border p-4 md:grid-cols-2" onSubmit={async (event) => { event.preventDefault(); if (!customerName.trim() || !description.trim()) return; setBusy(true); setCreateError(false); try { const order = await servicesApi.createOrder({ customerName: customerName.trim(), description: description.trim() }); navigate(`/dashboard/estimates/${order.id}`) } catch (cause) { console.error('Error creating service order', cause); setCreateError(true) } finally { setBusy(false) } }}><div><label htmlFor="new-order-customer" className="text-sm font-medium">{t('customerName')}</label><Input id="new-order-customer" required value={customerName} onChange={(e) => setCustomerName(e.target.value)} /></div><div><label htmlFor="new-order-description" className="text-sm font-medium">{t('workDescription')}</label><Input id="new-order-description" required value={description} onChange={(e) => setDescription(e.target.value)} /></div>{createError && <p role="alert" className="text-destructive md:col-span-2">{t('createError')}</p>}<div className="md:col-span-2"><Button type="submit" disabled={busy || !customerName.trim() || !description.trim()}>{busy ? t('loading') : t('newOrderButton')}</Button></div></form>}<div className="flex flex-wrap gap-2">
      <select aria-label={t('status')} className="h-10 rounded-md border bg-background px-3" value={status} onChange={(e) => { setStatus(e.target.value as ServiceOrderStatus | ''); setPage(1) }}><option value="">{t('all')}</option>{statuses.map((s) => <option key={s} value={s}>{t(`statuses.${s}`)}</option>)}</select>
      <Input aria-label={t('dueAt')} type="date" value={dueBefore} onChange={(e) => { setDueBefore(e.target.value); setPage(1) }} />
    </div></CardContent><CardContent>
      {loading && <p role="status" className="py-8 text-center">{t('loading')}</p>}
      {error && <div role="alert" className="py-8 text-center"><p>{t('loadError')}</p><Button variant="outline" onClick={() => setRefresh((n) => n + 1)}>{t('retry')}</Button></div>}
      {!loading && !error && orders.length === 0 && <p className="py-12 text-center text-muted-foreground">{t('empty')}</p>}
      {!loading && !error && orders.length > 0 && <><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-3">{t('customerName')}</th><th className="p-3">{t('workDescription')}</th><th className="p-3">{t('dueAt')}</th><th className="p-3">{t('status')}</th><th className="p-3 text-right">{t('total')}</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id} className="border-b"><td className="p-3"><Link className="font-medium underline" to={`/dashboard/estimates/${order.id}`}>{order.customerName}</Link></td><td className="p-3">{order.description}</td><td className="p-3">{order.dueAt ? formatDateTime(order.dueAt, i18n.language) : '—'}</td><td className="p-3">{t(`statuses.${order.status}`)}</td><td className="p-3 text-right">{formatCurrencyBRL(order.total ?? order.items.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0), i18n.language)}</td></tr>)}</tbody></table></div><Pagination currentPage={page} pageSize={limit} totalPages={Math.ceil(total / limit)} hasMore={orders.length === limit} onPageChange={setPage} onPageSizeChange={(n) => { setLimit(n); setPage(1) }} isLoading={loading} /></>}
    </CardContent></Card>
  </main>
}
