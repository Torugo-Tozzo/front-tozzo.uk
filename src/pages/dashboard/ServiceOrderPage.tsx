import { loadedData } from '@/api/query';
import { createMutation,createQuery,useQueryClient } from '@tanstack/solid-query';
import { createEffect,createSignal,on,Show,untrack } from 'solid-js';

import type { ServiceOrder } from '@/api/service-orders';
import { servicesApi,serviceOrderErrorKey,statusKey } from '@/api/service-orders';
import { listUsers } from '@/api/users';
import { Button } from '@/components/ui/button';
import { Card,CardContent,CardHeader,CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useConfirm } from '@/contexts/ConfirmContext';
import { formatDateTime } from '@/i18n/format';
import { useTranslation } from '@/i18n/solid';
import { formatCents } from '@/lib/money';
import { A,useNavigate,useParams } from '@solidjs/router';
import ServiceQuoteEditor,{ draftLines,quotePayload,SnapshotLines,validDraft,type DraftLine } from './ServiceQuoteEditor';
export default function ServiceOrderPage({ mode = 'quote' }: {
    mode?: 'quote' | 'execution';
} = {}) {
    const params = useParams();
    const navigate = useNavigate();
    const { t, i18n } = useTranslation('estimates');
    const confirm = useConfirm();
    const queryClient = useQueryClient();
    const execution = mode === 'execution';
    const [order, setOrder] = createSignal<ServiceOrder | null>(null);
    const [lines, setLines] = createSignal<DraftLine[]>([]);
    const [supplements, setSupplements] = createSignal<DraftLine[]>([]);
    const [quoteDirty, setQuoteDirty] = createSignal(false);
    const [supplementsDirty, setSupplementsDirty] = createSignal(false);
    const [editingSupplements, setEditingSupplements] = createSignal(false);
    const [loading, setLoading] = createSignal(true);
    const [busy, setBusy] = createSignal(false);
    const [error, setError] = createSignal('');
    const [customerName, setCustomerName] = createSignal('');
    const [description, setDescription] = createSignal('');
    const [dueAt, setDueAt] = createSignal('');
    const [responsibleId, setResponsibleId] = createSignal('');
    const [employees, setEmployees] = createSignal<{
        id: string | number;
        name: string;
    }[]>([]);
    const [employeesError, setEmployeesError] = createSignal(false);
    const accepted = () => order() != null && (order()!.acceptedQuote != null || ['APPROVED', 'IN_PROGRESS', 'COMPLETED'].includes(order()!.status));
    const canQuote = () => order() != null && !execution && !accepted() && ['OPEN', 'QUOTED'].includes(order()!.status);
    const openExecution = () => order() != null && execution && accepted() && ['APPROVED', 'IN_PROGRESS'].includes(order()!.status);
    const canEditDetails = () => canQuote() || openExecution();
    const detailsDirty = () => order() != null && (customerName() !== order()!.customerName || description() !== order()!.description || dueAt() !== (order()!.dueAt?.slice(0, 10) ?? '') || responsibleId() !== (order()!.responsibleId == null ? '' : String(order()!.responsibleId)));
    const applyOrder = (data: ServiceOrder) => {
        if(data.id !== params.id) return;
        setOrder(data);
        setCustomerName(data.customerName);
        setDescription(data.description);
        setDueAt(data.dueAt?.slice(0, 10) ?? '');
        setResponsibleId(data.responsibleId == null ? '' : String(data.responsibleId));
        setLines(draftLines(data.items ?? []));
        setSupplements(draftLines(data.pendingItems ?? []));
        setQuoteDirty(false);
        setSupplementsDirty(false);
    };

    const orderQuery = createQuery(() => ({ queryKey: ['service-orders', 'detail', params.id], queryFn: ({ signal }) => servicesApi.getOrder(params.id!, signal) }));
    createEffect(on(() => params.id, () => { setOrder(null); setBusy(false); setError(''); setQuoteDirty(false); setEditingSupplements(false); setSupplementsDirty(false); }));
    createEffect(on(() => loadedData(orderQuery), data => { if (data)
        untrack(() => { if (!order() || (!busy() && !detailsDirty() && !quoteDirty() && !editingSupplements() && !supplementsDirty()))
            applyOrder(data); }); }));
    createEffect(() => setLoading(orderQuery.isPending));
    const load = async () => {
        const id=params.id;
        const result=await orderQuery.refetch();
        if(result.data && id===params.id){applyOrder(result.data);setEditingSupplements(false);setError('')}
    };
    const employeeQuery = createQuery(() => ({ queryKey: ['users', 'service-order-choices'], queryFn: async ({ signal }) => {
        const items: {id:string;name:string}[]=[]; let cursor:string|undefined;
        do {const page=await listUsers({ limit:100,cursor },signal);items.push(...(page.items??[]));cursor=page.nextCursor??undefined} while(cursor);
        return {items};
    }, enabled: canEditDetails() }));
    createEffect(() => { setEmployees(loadedData(employeeQuery)?.items ?? []); setEmployeesError(employeeQuery.isError); });
    const mutation = createMutation(() => ({mutationFn: (action: () => Promise<void>) => action()}));
    const mutate = async (action: () => Promise<void>) => {
        if (busy())
            return;
        setBusy(true);
        setError('');
        const id=params.id;
        try {
            await queryClient.cancelQueries({queryKey:['service-orders','detail',id],exact:true});
            if(id!==params.id) return;
            await mutation.mutateAsync(action);
            await queryClient.cancelQueries({queryKey:['service-orders','detail',id],exact:true});
            if(id===params.id && order()) queryClient.setQueryData(['service-orders','detail',id],order());
            void queryClient.invalidateQueries({queryKey:['service-orders'],refetchType:'inactive'});
            void queryClient.invalidateQueries({queryKey:['sales']});
        }
        catch (cause) {
            if(id===params.id) setError(t(serviceOrderErrorKey(cause)));
        }
        finally {
            if(id===params.id) setBusy(false);
        }
    };
    const saveDetails = () => order() && mutate(async () => {
        const updated = await servicesApi.updateOrder(order()!.id, { customerName: customerName(), description: description(), dueAt: dueAt() ? `${dueAt()}T00:00:00.000Z` : null, responsibleId: responsibleId() || null, expectedUpdatedAt: order()!.updatedAt });
        if(updated.id!==params.id) return;
        setOrder(updated);
        setCustomerName(updated.customerName);
        setDescription(updated.description);
        setDueAt(updated.dueAt?.slice(0, 10) ?? '');
        setResponsibleId(updated.responsibleId == null ? '' : String(updated.responsibleId));
    });
    const saveQuote = () => order() && mutate(async () => { applyOrder(await servicesApi.replaceQuote(order()!.id, order()!.updatedAt, quotePayload(lines()))); });
    const saveSupplements = () => order() && mutate(async () => { const result=await servicesApi.replaceSupplements(order()!.id, order()!.updatedAt, quotePayload(supplements())); if(result.id!==params.id)return; applyOrder(result); setEditingSupplements(false); });
    const action = (verb: 'approve' | 'start' | 'complete' | 'cancel' | 'reopen') => order() && mutate(async () => {
        const result = await servicesApi.action(order()!.id, verb, order()!.updatedAt);
        if (verb === 'complete' && result.sale)
            sessionStorage.setItem('tozzo-last-service-sale', String(result.sale.id));
        applyOrder(result.order);
        if (verb === 'approve' && result.order.id===params.id)
            navigate(`/dashboard/service-orders/${order()!.id}`);
    });
    const askClose = async () => {
        if (order() && await confirm({ description: t('confirmClose'), confirmLabel: t('close'), destructive: false }))
            await action('complete');
    };
    const backPath = execution ? '/dashboard/service-orders' : '/dashboard/estimates';
    const canSupplements = () => openExecution() && !order()!.sale;
    const pending = () => order()!.pendingItems ?? [];
    const snapshot = () => order()!.acceptedQuote ?? (order()!.items ?? []).filter((item) => !item.isSupplement);
    const displayedItems = () => execution ? (order()!.items ?? []) : accepted() ? snapshot() : lines();
    const total = () => displayedItems().reduce((sum, line) => sum + line.unitPriceCents * line.quantity, 0);
    const unsaved = () => quoteDirty() || detailsDirty() || supplementsDirty() || editingSupplements();
    return <Show when={!loading()} fallback={<p role="status" class="py-12 text-center">{t('loading')}</p>}><Show when={order()} fallback={<main><A href={backPath} class="underline">{t(execution ? 'backToServices' : 'back')}</A><p role="alert">{t('loadError')}</p></main>}><main class="min-w-0 space-y-6 [&>*]:min-w-0">
      <header class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0 flex-1">
          <A href={backPath} class="text-sm underline">{t(execution ? 'backToServices' : 'back')}</A>
          <h1 class="mt-2 break-words text-3xl font-bold [overflow-wrap:anywhere]">{order()!.customerName}</h1>
          <p class="line-clamp-2 whitespace-pre-wrap break-words text-muted-foreground [overflow-wrap:anywhere]">{order()!.description}</p>
        </div>
        <span class="rounded-full border px-3 py-1">{t(`statuses.${statusKey(order()!.status)}`)}</span>
      </header>
      {error() && <div role="alert" class="rounded-md border border-destructive p-3 text-destructive">
        {error()}
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={busy()}>{t('reload')}</Button>
      </div>}
      <Card>
        <CardHeader>
          <CardTitle>{t('details')}</CardTitle>
        </CardHeader>
        <CardContent class="grid min-w-0 gap-4 sm:grid-cols-2 [&>div]:min-w-0">
          <div>
            <Label for="order-customer">{t('customerName')}</Label>
            <Input id="order-customer" disabled={!canEditDetails() || busy()} value={customerName()} onInput={(e) => setCustomerName(e.currentTarget.value)}/>
          </div>
          <div class="sm:col-span-2">
            <Label for="order-description">{t('workDescription')}</Label>
            <textarea rows={5} id="order-description" disabled={!canEditDetails() || busy()} class="block min-h-32 w-full resize-y rounded-md border bg-background p-3 disabled:opacity-50" value={description()} onInput={(e) => setDescription(e.currentTarget.value)}/>
          </div>
          <div>
            <Label for="order-due">{t('dueAt')}</Label>
            <Input id="order-due" type="date" disabled={!canEditDetails() || busy()} value={dueAt()} onInput={(e) => setDueAt(e.currentTarget.value)}/>
          </div>
          <div>
            <Label for="order-responsible">{t('responsible')}</Label>
            <select id="order-responsible" disabled={!canEditDetails() || busy() || employeesError()} class="h-10 min-w-0 w-full rounded-md border bg-background px-3" value={responsibleId()} onInput={(e) => setResponsibleId(e.currentTarget.value)}>
              <option value="">{t('noResponsible')}</option>
              {responsibleId() && !employees().some((employee) => String(employee.id) === responsibleId()) && <option value={responsibleId()}>#{responsibleId()}</option>}
              {employees().map((employee) => <option value={employee.id}>{employee.name}</option>)}
            </select>
            {employeesError() && <p role="alert">{t('choicesError')}</p>}
          </div>
          {canEditDetails() && detailsDirty() && <div class="flex flex-wrap gap-2 sm:col-span-2">
            <Button onClick={() => void saveDetails()} disabled={busy() || !customerName().trim() || !description().trim()}>{t('saveDetails')}</Button>
            <Button variant="outline" disabled={busy()} onClick={() => { setCustomerName(order()!.customerName); setDescription(order()!.description); setDueAt(order()!.dueAt?.slice(0, 10) ?? ''); setResponsibleId(order()!.responsibleId == null ? '' : String(order()!.responsibleId)); }}>{t('cancelEdit')}</Button>
          </div>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t(execution ? 'approvedWork' : accepted() ? 'acceptedQuote' : 'quote')}</CardTitle>
        </CardHeader>
        <CardContent class="min-w-0 space-y-4">
          {canQuote() ? <ServiceQuoteEditor lines={lines()} onChange={(next) => { setLines(next); setQuoteDirty(true); }} disabled={busy()}/> : <SnapshotLines items={displayedItems()}/>}
          <p class="text-right text-lg font-semibold">{t('total')}: {formatCents(total(), i18n.language)}</p>
          {canQuote() && <div class="flex flex-wrap gap-2">
            <Button disabled={busy() || detailsDirty() || !validDraft(lines())} onClick={() => void saveQuote()}>{t('saveQuote')}</Button>
            {order()!.status === 'QUOTED' && <Button disabled={busy() || unsaved()} onClick={() => void action('approve')}>{t('approve')}</Button>}
            {unsaved() && <p class="w-full text-sm text-muted-foreground">{t('saveBeforeApprove')}</p>}
          </div>}
        </CardContent>
      </Card>
      {execution && accepted() && <Card>
        <CardHeader>
          <CardTitle>{t('acceptedQuote')}</CardTitle>
        </CardHeader>
        <CardContent class="min-w-0 break-words [overflow-wrap:anywhere]">
          <SnapshotLines items={snapshot()}/>
        </CardContent>
      </Card>}
      {execution && accepted() && <Card>
        <CardHeader class="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle>{t('supplements')}</CardTitle>
          {canSupplements() && !editingSupplements() && <Button variant="outline" disabled={busy() || detailsDirty()} onClick={() => { setSupplements(draftLines(pending())); setEditingSupplements(true); }}>{t('editSupplements')}</Button>}
        </CardHeader>
        <CardContent class="min-w-0 space-y-4">
      {editingSupplements() ? <><ServiceQuoteEditor lines={supplements()} onChange={(next) => { setSupplements(next); setSupplementsDirty(true); }} disabled={busy()}/><div class="flex flex-wrap gap-2">
            <Button disabled={busy() || detailsDirty() || (!validDraft(supplements()) && supplements().length > 0)} onClick={() => void saveSupplements()}>{t('saveSupplements')}</Button>
            <Button variant="outline" disabled={busy()} onClick={() => { setEditingSupplements(false); setSupplementsDirty(false); setSupplements(draftLines(pending())); }}>{t('cancelEdit')}</Button>
          </div></> : <><SnapshotLines items={pending()}/>{pending().length > 0 && <><p class="text-sm font-medium">{t('pendingApproval')}</p>{canSupplements() && <div class="flex flex-wrap gap-2">
            <Button disabled={busy() || unsaved()} onClick={() => void mutate(async () => applyOrder(await servicesApi.approveSupplements(order()!.id, order()!.updatedAt)))}>{t('approveSupplements')}</Button>
            <Button variant="outline" disabled={busy() || unsaved()} onClick={() => void mutate(async () => applyOrder(await servicesApi.replaceSupplements(order()!.id, order()!.updatedAt, [])))}>{t('discardSupplements')}</Button>
          </div>}</>}</>}
    </CardContent>
      </Card>}
      <Card>
        <CardHeader>
          <CardTitle>{t('history')}</CardTitle>
        </CardHeader>
        <CardContent class="min-w-0 break-words [overflow-wrap:anywhere]">
          <ol class="space-y-3">{(order()!.events ?? []).map((event) => <li class="border-l-2 pl-3">
              <p>{['CREATE','QUOTE','APPROVE','START','COMPLETE','CANCEL','REOPEN','SUPPLEMENTS','APPROVE_SUPPLEMENTS'].includes(event.action) ? t(`historyActions.${event.action}` as never) : t('history')} · {t(`statuses.${statusKey(event.toStatus)}`)}</p>
              <time class="text-xs text-muted-foreground">{formatDateTime(event.createdAt, i18n.language)}</time>
            </li>)}</ol>
          {order()!.sale && <p class="mt-4">{t('linkedSale')}: #{order()!.sale.id}</p>}
        </CardContent>
      </Card>
      <div class="flex flex-wrap gap-2">
      {execution && order()!.status === 'APPROVED' && <Button disabled={busy() || unsaved()} onClick={() => void action('start')}>{t('start')}</Button>}
      {execution && order()!.status === 'IN_PROGRESS' && <Button disabled={busy() || unsaved() || pending().length > 0} onClick={() => void askClose()}>{t('close')}</Button>}
      {(canQuote() || openExecution()) && <Button variant="outline" disabled={busy() || unsaved()} onClick={() => void action('cancel')}>{t('cancelOrder')}</Button>}
      {((execution && accepted()) || (!execution && !accepted())) && ['COMPLETED', 'CANCELLED'].includes(order()!.status) && <Button variant="outline" disabled={busy()} onClick={() => void action('reopen')}>{t('reopen')}</Button>}
    </div>
    </main></Show></Show>;
}
