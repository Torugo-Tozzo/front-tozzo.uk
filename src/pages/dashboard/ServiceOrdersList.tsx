import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Eye, Pencil, Trash2 } from 'lucide-react';
import { useConfirm } from '@/contexts/ConfirmContext';
import { useRealtimeEvents } from '@/hooks/useRealtimeEvents';
import { Pagination } from '@/components/Pagination';
import { servicesApi } from '@/services/api';
import type { ServiceOrder, ServiceOrderStatus } from '@/domain/services';
import { formatCurrencyBRL, formatDateTime } from '@/i18n/format';
const statuses: ServiceOrderStatus[] = ['ABERTA', 'ORCADA', 'APROVADA', 'EM_EXECUCAO', 'CONCLUIDA', 'CANCELADA'];
export default function ServiceOrdersList({ stage }: {
    stage: 'estimates' | 'services';
}) {
    const execution = stage === 'services';
    const confirm = useConfirm();
    const basePath = execution ? '/dashboard/service-orders' : '/dashboard/estimates';
    const { t, i18n } = useTranslation('estimates');
    const navigate = useNavigate();
    const [orders, setOrders] = useState<ServiceOrder[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [openOnly, setOpenOnly] = useState(execution);
    const [actionError, setActionError] = useState('');
    const [status, setStatus] = useState<ServiceOrderStatus | ''>('');
    const [dueBefore, setDueBefore] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [creating, setCreating] = useState(false);
    const [busy, setBusy] = useState(false);
    const [refresh, setRefresh] = useState(0);
    const [customerName, setCustomerName] = useState('');
    const [description, setDescription] = useState('');
    const [createError, setCreateError] = useState(false);
    useEffect(() => {
        let alive = true;
        setLoading(true);
        setError(false);
        servicesApi.listOrders({ stage, open: openOnly ? true : undefined, page, limit, status: status || undefined, dueBefore: dueBefore || undefined }).then((result) => {
            if (alive) {
                setOrders(result.data);
                setTotal(result.total);
            }
        }).catch((cause) => { console.error('Error loading service orders', cause); if (alive)
            setError(true); }).finally(() => { if (alive)
            setLoading(false); });
        return () => { alive = false; };
    }, [stage, openOnly, page, limit, status, dueBefore, refresh]);
    useRealtimeEvents(['service-orders'], () => setRefresh((value) => value + 1));
    const deleteQuote = async (order: ServiceOrder) => {
        if (!await confirm({ description: t('confirmDeleteQuote'), confirmLabel: t('deleteQuote'), destructive: true }))
            return;
        setBusy(true);
        setActionError('');
        try {
            await servicesApi.deleteOrder(order.id, order.updatedAt);
            setRefresh((value) => value + 1);
        }
        catch (cause) {
            setActionError((cause as {
                response?: {
                    status?: number;
                };
            }).response?.status === 409 ? t('conflict') : t('saveError'));
        }
        finally {
            setBusy(false);
        }
    };
    return <main className="min-w-0 space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">{t(execution ? 'executionTitle' : 'title')}</h1>
        <p className="mt-1 text-muted-foreground">{t(execution ? 'executionDescription' : 'description')}</p>
      </header>
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle>{t(execution ? 'executionTitle' : 'title')}</CardTitle>
          {!execution && <Button onClick={() => { setCreating((value) => !value); setCreateError(false); }}>{creating ? t('cancelEdit') : t('newOrderButton')}</Button>}
        </CardHeader>
        <CardContent>
          {creating && <form className="mb-5 grid gap-3 rounded-md border p-4 md:grid-cols-2" onSubmit={async (event) => { event.preventDefault(); if (!customerName.trim() || !description.trim())
            return; setBusy(true); setCreateError(false); try {
            const order = await servicesApi.createOrder({ customerName: customerName.trim(), description: description.trim() });
            navigate(`/dashboard/estimates/${order.id}`);
        }
        catch (cause) {
            console.error('Error creating service order', cause);
            setCreateError(true);
        }
        finally {
            setBusy(false);
        } }}>
            <div>
              <label htmlFor="new-order-customer" className="text-sm font-medium">{t('customerName')}</label>
              <Input id="new-order-customer" required value={customerName} onChange={(e) => setCustomerName(e.target.value)}/>
            </div>
            <div>
              <label htmlFor="new-order-description" className="text-sm font-medium">{t('workDescription')}</label>
              <textarea rows={5} className="w-full rounded-md border bg-background p-3" id="new-order-description" required value={description} onChange={(e) => setDescription(e.target.value)}/>
            </div>
            {createError && <p role="alert" className="text-destructive md:col-span-2">{t('createError')}</p>}
            <div className="md:col-span-2">
              <Button type="submit" disabled={busy || !customerName.trim() || !description.trim()}>{busy ? t('loading') : t('newOrderButton')}</Button>
            </div>
          </form>}
          <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,220px)_minmax(0,220px)_minmax(0,1fr)]">
            <div className="min-w-0 space-y-1">
              <label htmlFor="service-orders-status" className="block text-sm font-medium">{t('status')}</label>
              <select id="service-orders-status" className="h-10 w-full min-w-0 rounded-md border bg-background px-3" value={status} onChange={(e) => { setStatus(e.target.value as ServiceOrderStatus | ''); setPage(1); }}>
                <option value="">{t('all')}</option>
                {statuses.map((s) => <option key={s} value={s}>{t(`statuses.${s}`)}</option>)}
              </select>
            </div>
            <div className="min-w-0 space-y-1">
              <label htmlFor="service-orders-due-date" className="block text-sm font-medium">{t('dueAt')}</label>
              <Input id="service-orders-due-date" className="min-w-0 max-w-full" type="date" value={dueBefore} onChange={(e) => { setDueBefore(e.target.value); setPage(1); }}/>
            </div>
            <label className="flex min-w-0 items-center gap-2 text-sm sm:col-span-2 xl:col-span-1 xl:self-end xl:py-3">
              <input type="checkbox" className="shrink-0" checked={openOnly} onChange={(event) => { setOpenOnly(event.target.checked); setPage(1); }}/>
              {t('openOnly')}
            </label>
          </div>
        </CardContent>
        <CardContent>
      {actionError && <p role="alert" className="text-destructive">{actionError}</p>}
      {loading && <p role="status" className="py-8 text-center">{t('loading')}</p>}
      {error && <div role="alert" className="py-8 text-center">
            <p>{t('loadError')}</p>
            <Button variant="outline" onClick={() => setRefresh((n) => n + 1)}>{t('retry')}</Button>
          </div>}
      {!loading && !error && orders.length === 0 && <p className="py-12 text-center text-muted-foreground">{t(execution ? 'executionEmpty' : 'empty')}</p>}
      {!loading && !error && orders.length > 0 && <>
        <div className="min-w-0">
            <table className="block w-full text-sm xl:table xl:table-fixed">
              <colgroup className="hidden xl:table-column-group">
                <col className="w-[22%]"/>
                <col/>
                <col className="w-[136px]"/>
                <col className="w-[132px]"/>
                <col className="w-[112px]"/>
                <col className="w-[104px]"/>
              </colgroup>
              <thead className="hidden xl:table-header-group">
                <tr className="border-b text-left">
                  <th scope="col" className="p-3">{t('customerName')}</th>
                  <th scope="col" className="p-3">{t('workDescription')}</th>
                  <th scope="col" className="p-3">{t('dueAt')}</th>
                  <th scope="col" className="p-3">{t('status')}</th>
                  <th scope="col" className="p-3 text-right">{t('total')}</th>
                  <th scope="col" className="p-3 text-right">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="grid gap-4 xl:table-row-group">{orders.map((order) => {
                const accepted = order.acceptedQuote != null || ['APROVADA', 'EM_EXECUCAO', 'CONCLUIDA'].includes(order.status);
                const editable = !execution && !accepted && ['ABERTA', 'ORCADA'].includes(order.status);
                const actionLabel = t(execution ? 'viewExecution' : editable ? 'editQuote' : 'viewQuote') + ' ' + order.customerName;
                return <tr key={order.id} className="grid min-w-0 grid-cols-2 rounded-md border xl:table-row xl:rounded-none xl:border-x-0 xl:border-t-0">
                  <td className="col-span-2 min-w-0 p-3 align-top [overflow-wrap:anywhere]">
                    <span className="mb-1 block text-xs text-muted-foreground xl:hidden">{t('customerName')}</span>
                    <Link className="font-medium underline" to={`${basePath}/${order.id}`}>{order.customerName}</Link>
                  </td>
                  <td className="col-span-2 min-w-0 p-3 align-top [overflow-wrap:anywhere]">
                    <span className="mb-1 block text-xs text-muted-foreground xl:hidden">{t('workDescription')}</span>
                    <details className="min-w-0">
                      <summary className="cursor-pointer">{order.description.length > 100 ? `${order.description.slice(0, 100)}…` : order.description}</summary>
                      <p className="mt-2 whitespace-pre-wrap">{order.description}</p>
                    </details>
                  </td>
                  <td className="min-w-0 p-3 align-top [overflow-wrap:anywhere]">
                    <span className="mb-1 block text-xs text-muted-foreground xl:hidden">{t('dueAt')}</span>
                    {order.dueAt ? formatDateTime(order.dueAt, i18n.language) : '—'}
                  </td>
                  <td className="min-w-0 p-3 align-top [overflow-wrap:anywhere]">
                    <span className="mb-1 block text-xs text-muted-foreground xl:hidden">{t('status')}</span>
                    {t(`statuses.${order.status}`)}{!execution && accepted && <span className="mt-1 block text-xs text-muted-foreground">{t('acceptedHistory')}</span>}
                  </td>
                  <td className="min-w-0 p-3 align-top [overflow-wrap:anywhere] xl:text-right">
                    <span className="mb-1 block text-xs text-muted-foreground xl:hidden">{t('total')}</span>
                    {formatCurrencyBRL((!execution && order.acceptedQuote ? order.acceptedQuote : order.items).reduce((sum, line) => sum + line.quantity * line.unitPrice, 0), i18n.language)}
                  </td>
                  <td className="min-w-0 p-3 align-top text-right">
                    <span className="mb-1 block text-xs text-muted-foreground xl:hidden">{t('actions')}</span>
                    <div className="flex justify-end gap-2">
                      <Button asChild variant="outline" size="icon">
                        <Link to={`${basePath}/${order.id}`} aria-label={actionLabel} title={actionLabel}>{editable ? <Pencil aria-hidden="true" className="h-4 w-4"/> : <Eye aria-hidden="true" className="h-4 w-4"/>}</Link>
                      </Button>
                      {!execution && !accepted && <Button variant="outline" size="icon" disabled={busy} onClick={() => void deleteQuote(order)} aria-label={`${t('deleteQuote')} ${order.customerName}`} title={`${t('deleteQuote')} ${order.customerName}`}>
                        <Trash2 aria-hidden="true" className="h-4 w-4"/>
                      </Button>}
                    </div>
                  </td>
                </tr>;
            })}</tbody>
            </table>
          </div>
        <div className="[&>div]:flex-wrap [&>div]:justify-start [&>div]:gap-3 [&>div]:space-x-0 [&>div>div]:flex-wrap [&>div>div]:gap-y-2">
          <Pagination currentPage={page} pageSize={limit} totalPages={Math.ceil(total / limit)} hasMore={orders.length === limit} onPageChange={setPage} onPageSizeChange={(n) => { setLimit(n); setPage(1); }} isLoading={loading}/>
        </div>
      </>}
    </CardContent>
      </Card>
    </main>;
}
