import { loadedData } from '@/api/query';
import type { ServiceOrder,ServiceOrderStatus } from '@/api/service-orders';
import { servicesApi,serviceOrderErrorKey,statusKey } from '@/api/service-orders';
import { Pagination } from '@/components/Pagination';
import { Button,buttonVariants } from '@/components/ui/button';
import { Card,CardContent,CardHeader,CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useConfirm } from '@/contexts/ConfirmContext';
import { formatDateTime } from '@/i18n/format';
import { useTranslation } from '@/i18n/solid';
import { createCursorPages } from '@/lib/cursor-pages';
import { formatCents } from '@/lib/money';
import { A,useNavigate } from '@solidjs/router';
import { createMutation,createQuery,useQueryClient } from '@tanstack/solid-query';
import { Eye,Pencil,Trash2 } from 'lucide-solid';
import { createEffect,createSignal } from 'solid-js';
const statuses: ServiceOrderStatus[] = ['OPEN', 'QUOTED', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
export default function ServiceOrdersList({ stage }: {
    stage: 'estimates' | 'services';
}) {
    const execution = stage === 'services';
    const confirm = useConfirm();
    const basePath = execution ? '/dashboard/service-orders' : '/dashboard/estimates';
    const { t, i18n } = useTranslation('estimates');
    const navigate = useNavigate();
    const [orders, setOrders] = createSignal<ServiceOrder[]>([]);
    const [total, setTotal] = createSignal(0);
    const [openOnly, setOpenOnly] = createSignal(execution);
    const [actionError, setActionError] = createSignal('');
    const [status, setStatus] = createSignal<ServiceOrderStatus | ''>('');
    const [dueBefore, setDueBefore] = createSignal('');
    const [loading, setLoading] = createSignal(true);
    const [error, setError] = createSignal(false);
    const [creating, setCreating] = createSignal(false);
    const [busy, setBusy] = createSignal(false);
    const [refresh, setRefresh] = createSignal(0);
    const [customerName, setCustomerName] = createSignal('');
    const [description, setDescription] = createSignal('');
    const [createError, setCreateError] = createSignal(false);
    const pages = createCursorPages();
    const queryClient = useQueryClient();
    const createOrder = createMutation(() => ({mutationFn: (body: Parameters<typeof servicesApi.createOrder>[0]) => servicesApi.createOrder(body), onSuccess: () => queryClient.invalidateQueries({queryKey:['service-orders']})}));
    const deleteOrder = createMutation(() => ({mutationFn: (order:ServiceOrder) => servicesApi.deleteOrder(order.id, order.updatedAt), onSuccess: () => queryClient.invalidateQueries({queryKey:['service-orders']})}));

    const ordersQuery = createQuery(() => ({ queryKey: ['service-orders', 'list', stage, openOnly(), status(), dueBefore(), pages.cursor(), pages.limit(), refresh()], queryFn: ({ signal }) => servicesApi.listOrders({ stage, open: openOnly() ? true : undefined, status: status() || undefined, dueBefore: dueBefore() || undefined, cursor: pages.cursor(), limit: pages.limit() }, signal) }));
    createEffect(() => { const data = loadedData(ordersQuery); setLoading(ordersQuery.isPending); setError(ordersQuery.isError); setOrders(data?.items ?? []); setTotal(data?.total ?? 0); });
    const deleteQuote = async (order: ServiceOrder) => {
        if(busy()) return;
        if (!await confirm({ description: t('confirmDeleteQuote'), confirmLabel: t('deleteQuote'), destructive: true }))
            return;
        setBusy(true);
        setActionError('');
        try {
            await deleteOrder.mutateAsync(order);
            setRefresh((value) => value + 1);
        }
        catch (cause) {
            setActionError(t(serviceOrderErrorKey(cause)));
        }
        finally {
            setBusy(false);
        }
    };
    return <main class="min-w-0 space-y-6">
      <header>
        <h1 class="text-3xl font-bold tracking-tight">{t(execution ? 'executionTitle' : 'title')}</h1>
        <p class="mt-1 text-muted-foreground">{t(execution ? 'executionDescription' : 'description')}</p>
      </header>
      <Card>
        <CardHeader class="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle>{t(execution ? 'executionTitle' : 'title')}</CardTitle>
          {!execution && <Button onClick={() => { setCreating((value) => !value); setCreateError(false); }}>{creating() ? t('cancelEdit') : t('newOrderButton')}</Button>}
        </CardHeader>
        <CardContent>
          {creating() && <form class="mb-5 grid gap-3 rounded-md border p-4 md:grid-cols-2" onSubmit={async (event) => {
                event.preventDefault();
                if (busy() || !customerName().trim() || !description().trim())
                    return;
                setBusy(true);
                setCreateError(false);
                try {
                    const order = await createOrder.mutateAsync({ customerName: customerName().trim(), description: description().trim() });
                    navigate(`/dashboard/estimates/${order.id}`);
                }
                catch (cause) {
                    console.error('Error creating service order', cause);
                    setCreateError(true);
                }
                finally {
                    setBusy(false);
                }
            }}>
            <div>
              <label for="new-order-customer" class="text-sm font-medium">{t('customerName')}</label>
              <Input id="new-order-customer" required value={customerName()} onInput={(e) => setCustomerName(e.currentTarget.value)}/>
            </div>
            <div>
              <label for="new-order-description" class="text-sm font-medium">{t('workDescription')}</label>
              <textarea rows={5} class="w-full rounded-md border bg-background p-3" id="new-order-description" required value={description()} onInput={(e) => setDescription(e.currentTarget.value)}/>
            </div>
            {createError() && <p role="alert" class="text-destructive md:col-span-2">{t('createError')}</p>}
            <div class="md:col-span-2">
              <Button type="submit" disabled={busy() || !customerName().trim() || !description().trim()}>{busy() ? t('loading') : t('newOrderButton')}</Button>
            </div>
          </form>}
          <div class="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,220px)_minmax(0,220px)_minmax(0,1fr)]">
            <div class="min-w-0 space-y-1">
              <label for="service-orders-status" class="block text-sm font-medium">{t('status')}</label>
              <select id="service-orders-status" class="h-10 w-full min-w-0 rounded-md border bg-background px-3" value={status()} onInput={(e) => { setStatus(e.currentTarget.value as ServiceOrderStatus | ''); pages.reset(); }}>
                <option value="">{t('all')}</option>
                {statuses.map((s) => <option value={s}>{t(`statuses.${statusKey(s)}`)}</option>)}
              </select>
            </div>
            <div class="min-w-0 space-y-1">
              <label for="service-orders-due-date" class="block text-sm font-medium">{t('dueAt')}</label>
              <Input id="service-orders-due-date" class="min-w-0 max-w-full" type="date" value={dueBefore()} onChange={(e) => { setDueBefore(e.currentTarget.value); pages.reset(); }}/>
            </div>
            <label class="flex min-w-0 items-center gap-2 text-sm sm:col-span-2 xl:col-span-1 xl:self-end xl:py-3">
              <input type="checkbox" class="shrink-0" checked={openOnly()} onInput={(event) => { setOpenOnly(event.currentTarget.checked); pages.reset(); }}/>
              {t('openOnly')}
            </label>
          </div>
        </CardContent>
        <CardContent>
      {actionError() && <p role="alert" class="text-destructive">{actionError()}</p>}
      {loading() && <p role="status" class="py-8 text-center">{t('loading')}</p>}
      {error() && <div role="alert" class="py-8 text-center">
            <p>{t('loadError')}</p>
            <Button variant="outline" onClick={() => setRefresh((n) => n + 1)}>{t('retry')}</Button>
          </div>}
      {!loading() && !error() && orders().length === 0 && <p class="py-12 text-center text-muted-foreground">{t(execution ? 'executionEmpty' : 'empty')}</p>}
      {!loading() && !error() && orders().length > 0 && <>
        <div class="min-w-0">
            <table class="block w-full text-sm xl:table xl:table-fixed">
              <colgroup class="hidden xl:table-column-group">
                <col class="w-[22%]"/>
                <col />
                <col class="w-[136px]"/>
                <col class="w-[132px]"/>
                <col class="w-[112px]"/>
                <col class="w-[104px]"/>
              </colgroup>
              <thead class="hidden xl:table-header-group">
                <tr class="border-b text-left">
                  <th scope="col" class="p-3">{t('customerName')}</th>
                  <th scope="col" class="p-3">{t('workDescription')}</th>
                  <th scope="col" class="p-3">{t('dueAt')}</th>
                  <th scope="col" class="p-3">{t('status')}</th>
                  <th scope="col" class="p-3 text-right">{t('total')}</th>
                  <th scope="col" class="p-3 text-right">{t('actions')}</th>
                </tr>
              </thead>
              <tbody class="grid gap-4 xl:table-row-group">{orders().map((order) => {
                const accepted = order.acceptedQuote != null || ['APPROVED', 'IN_PROGRESS', 'COMPLETED'].includes(order.status);
                const editable = !execution && !accepted && ['OPEN', 'QUOTED'].includes(order.status);
                const actionLabel = t(execution ? 'viewExecution' : editable ? 'editQuote' : 'viewQuote') + ' ' + order.customerName;
                return <tr class="grid min-w-0 grid-cols-2 rounded-md border xl:table-row xl:rounded-none xl:border-x-0 xl:border-t-0">
                  <td class="col-span-2 min-w-0 p-3 align-top [overflow-wrap:anywhere]">
                    <span class="mb-1 block text-xs text-muted-foreground xl:hidden">{t('customerName')}</span>
                    <A class="font-medium underline" href={`${basePath}/${order.id}`}>{order.customerName}</A>
                  </td>
                  <td class="col-span-2 min-w-0 p-3 align-top [overflow-wrap:anywhere]">
                    <span class="mb-1 block text-xs text-muted-foreground xl:hidden">{t('workDescription')}</span>
                    <details class="min-w-0">
                      <summary class="cursor-pointer">{order.description.length > 100 ? `${order.description.slice(0, 100)}…` : order.description}</summary>
                      <p class="mt-2 whitespace-pre-wrap">{order.description}</p>
                    </details>
                  </td>
                  <td class="min-w-0 p-3 align-top [overflow-wrap:anywhere]">
                    <span class="mb-1 block text-xs text-muted-foreground xl:hidden">{t('dueAt')}</span>
                    {order.dueAt ? formatDateTime(order.dueAt, i18n.language) : '—'}
                  </td>
                  <td class="min-w-0 p-3 align-top [overflow-wrap:anywhere]">
                    <span class="mb-1 block text-xs text-muted-foreground xl:hidden">{t('status')}</span>
                    {t(`statuses.${statusKey(order.status)}`)}{!execution && accepted && <span class="mt-1 block text-xs text-muted-foreground">{t('acceptedHistory')}</span>}
                  </td>
                  <td class="min-w-0 p-3 align-top [overflow-wrap:anywhere] xl:text-right">
                    <span class="mb-1 block text-xs text-muted-foreground xl:hidden">{t('total')}</span>
                    {formatCents((!execution && order.acceptedQuote ? order.acceptedQuote : (order.items ?? [])).reduce((sum, line) => sum + line.quantity * line.unitPriceCents, 0), i18n.language)}
                  </td>
                  <td class="min-w-0 p-3 align-top text-right">
                    <span class="mb-1 block text-xs text-muted-foreground xl:hidden">{t('actions')}</span>
                    <div class="flex justify-end gap-2">
                      <A href={`${basePath}/${order.id}`} aria-label={actionLabel} title={actionLabel} class={buttonVariants({variant:'outline',size:'icon'})}>
                        {editable ? <Pencil aria-hidden="true" class="h-4 w-4"/> : <Eye aria-hidden="true" class="h-4 w-4"/>}
                      </A>
                      {!execution && !accepted && <Button variant="outline" size="icon" disabled={busy()} onClick={() => void deleteQuote(order)} aria-label={`${t('deleteQuote')} ${order.customerName}`} title={`${t('deleteQuote')} ${order.customerName}`}>
                        <Trash2 aria-hidden="true" class="h-4 w-4"/>
                      </Button>}
                    </div>
                  </td>
                </tr>;
            })}</tbody>
            </table>
          </div>
        <div class="[&>div]:flex-wrap [&>div]:justify-start [&>div]:gap-3 [&>div]:space-x-0 [&>div>div]:flex-wrap [&>div>div]:gap-y-2">
          <Pagination currentPage={pages.page()} pageSize={pages.limit()} totalPages={Math.ceil(total() / pages.limit())} hasMore={!!loadedData(ordersQuery)?.nextCursor} onPageChange={(n) => pages.goTo(n, loadedData(ordersQuery)?.nextCursor)} onPageSizeChange={(n) => { pages.setLimit(n); }} isLoading={loading()}/>
        </div>
      </>}
    </CardContent>
      </Card>
    </main>;
}
