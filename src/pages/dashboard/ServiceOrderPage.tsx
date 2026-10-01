import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { servicesApi } from '@/services/api';
import type { ServiceOrder } from '@/domain/services';
import api from '@/services/api';
import { parseListResponse } from '@/services/parseResponse';
import { formatCurrencyBRL, formatDateTime } from '@/i18n/format';
import { useConfirm } from '@/contexts/ConfirmContext';
import { useRealtimeEvents } from '@/hooks/useRealtimeEvents';
import ServiceQuoteEditor, { draftLines, quotePayload, SnapshotLines, validDraft, type DraftLine } from './ServiceQuoteEditor';
export default function ServiceOrderPage({ mode = 'quote' }: {
    mode?: 'quote' | 'execution';
}) {
    const { id } = useParams();
    const navigate = useNavigate();
    const { t, i18n } = useTranslation('estimates');
    const confirm = useConfirm();
    const execution = mode === 'execution';
    const [order, setOrder] = useState<ServiceOrder | null>(null);
    const [lines, setLines] = useState<DraftLine[]>([]);
    const [supplements, setSupplements] = useState<DraftLine[]>([]);
    const [quoteDirty, setQuoteDirty] = useState(false);
    const [supplementsDirty, setSupplementsDirty] = useState(false);
    const [editingSupplements, setEditingSupplements] = useState(false);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [description, setDescription] = useState('');
    const [dueAt, setDueAt] = useState('');
    const [responsibleId, setResponsibleId] = useState('');
    const [employees, setEmployees] = useState<{
        id: string | number;
        name: string;
    }[]>([]);
    const [employeesError, setEmployeesError] = useState(false);
    const refreshBlocked = useRef(false);
    const requestGeneration = useRef(0);
    const accepted = order != null && (order.acceptedQuote != null || ['APROVADA', 'EM_EXECUCAO', 'CONCLUIDA'].includes(order.status));
    const canQuote = order != null && !execution && !accepted && ['ABERTA', 'ORCADA'].includes(order.status);
    const openExecution = order != null && execution && accepted && ['APROVADA', 'EM_EXECUCAO'].includes(order.status);
    const canEditDetails = canQuote || openExecution;
    const detailsDirty = order != null && (customerName !== order.customerName || description !== order.description || dueAt !== (order.dueAt?.slice(0, 10) ?? '') || responsibleId !== (order.responsibleId == null ? '' : String(order.responsibleId)));
    refreshBlocked.current = busy || detailsDirty || quoteDirty || editingSupplements || supplementsDirty;
    const applyOrder = useCallback((data: ServiceOrder) => {
        setOrder(data);
        setCustomerName(data.customerName);
        setDescription(data.description);
        setDueAt(data.dueAt?.slice(0, 10) ?? '');
        setResponsibleId(data.responsibleId == null ? '' : String(data.responsibleId));
        setLines(draftLines(data.items));
        setSupplements(draftLines(data.pendingItems ?? []));
        setQuoteDirty(false);
        setSupplementsDirty(false);
    }, []);
    const load = useCallback(async (showLoading = true) => {
        if (!id)
            return;
        const generation = ++requestGeneration.current;
        if (showLoading)
            setLoading(true);
        setError('');
        try {
            const data = await servicesApi.getOrder(id);
            if (generation !== requestGeneration.current || (!showLoading && refreshBlocked.current))
                return;
            applyOrder(data);
        }
        catch {
            setError(t('loadError'));
        }
        finally {
            if (showLoading)
                setLoading(false);
        }
    }, [id, t, applyOrder]);
    useEffect(() => { void load(); return () => { requestGeneration.current += 1; }; }, [load]);
    useRealtimeEvents(['service-orders'], () => { if (!busy && !detailsDirty && !quoteDirty && !editingSupplements && !supplementsDirty)
        void load(false); });
    useEffect(() => {
        if (!canEditDetails)
            return;
        let alive = true;
        setEmployeesError(false);
        api.get('/usuarios', { params: { page: 1, limit: 100, search: '' } }).then((response) => { if (alive)
            setEmployees(parseListResponse<{
                id: string | number;
                name: string;
            }>(response).data); }).catch(() => { if (alive)
            setEmployeesError(true); });
        return () => { alive = false; };
    }, [canEditDetails]);
    const mutate = async (action: () => Promise<void>) => {
        if (busy)
            return;
        requestGeneration.current += 1;
        refreshBlocked.current = true;
        setBusy(true);
        setError('');
        try {
            await action();
        }
        catch (cause) {
            setError((cause as {
                response?: {
                    status?: number;
                };
            }).response?.status === 409 ? t('conflict') : t('saveError'));
        }
        finally {
            setBusy(false);
        }
    };
    const saveDetails = () => order && mutate(async () => {
        const updated = await servicesApi.updateOrder(order.id, { customerName, description, dueAt: dueAt || null, responsibleId: responsibleId || null, expectedUpdatedAt: order.updatedAt });
        setOrder(updated);
        setCustomerName(updated.customerName);
        setDescription(updated.description);
        setDueAt(updated.dueAt?.slice(0, 10) ?? '');
        setResponsibleId(updated.responsibleId == null ? '' : String(updated.responsibleId));
    });
    const saveQuote = () => order && mutate(async () => { applyOrder(await servicesApi.replaceQuote(order.id, order.updatedAt, quotePayload(lines))); });
    const saveSupplements = () => order && mutate(async () => { applyOrder(await servicesApi.replaceSupplements(order.id, order.updatedAt, quotePayload(supplements))); setEditingSupplements(false); });
    const action = (verb: 'aprovar' | 'iniciar' | 'fechar' | 'cancelar' | 'reabrir') => order && mutate(async () => {
        const result = await servicesApi.action(order.id, verb, order.updatedAt);
        if (verb === 'fechar' && result.sale)
            sessionStorage.setItem('tozzo-last-service-sale', String(result.sale.id));
        applyOrder(result.order);
        if (verb === 'aprovar')
            navigate(`/dashboard/service-orders/${order.id}`);
    });
    const askClose = async () => { if (order && await confirm({ description: t('confirmClose'), confirmLabel: t('close'), destructive: false }))
        await action('fechar'); };
    const backPath = execution ? '/dashboard/service-orders' : '/dashboard/estimates';
    if (loading)
        return <p role="status" className="py-12 text-center">{t('loading')}</p>;
    if (!order)
        return <main>
      <Link to={backPath} className="underline">{t(execution ? 'backToServices' : 'back')}</Link>
      <p role="alert">{error || t('loadError')}</p>
    </main>;
    const canSupplements = openExecution && !order.sale;
    const pending = order.pendingItems ?? [];
    const snapshot = order.acceptedQuote ?? order.items.filter((item) => !item.isSupplement);
    const displayedItems = execution ? order.items : accepted ? snapshot : lines;
    const total = displayedItems.reduce((sum, line) => sum + Math.round(line.unitPrice * 100) * line.quantity / 100, 0);
    const unsaved = quoteDirty || detailsDirty || supplementsDirty || editingSupplements;
    return <main className="min-w-0 space-y-6 [&>*]:min-w-0">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Link to={backPath} className="text-sm underline">{t(execution ? 'backToServices' : 'back')}</Link>
          <h1 className="mt-2 break-words text-3xl font-bold [overflow-wrap:anywhere]">{order.customerName}</h1>
          <p className="line-clamp-2 whitespace-pre-wrap break-words text-muted-foreground [overflow-wrap:anywhere]">{order.description}</p>
        </div>
        <span className="rounded-full border px-3 py-1">{t(`statuses.${order.status}`)}</span>
      </header>
      {error && <div role="alert" className="rounded-md border border-destructive p-3 text-destructive">
        {error}
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={busy}>{t('reload')}</Button>
      </div>}
      <Card>
        <CardHeader>
          <CardTitle>{t('details')}</CardTitle>
        </CardHeader>
        <CardContent className="grid min-w-0 gap-4 sm:grid-cols-2 [&>div]:min-w-0">
          <div>
            <Label htmlFor="order-customer">{t('customerName')}</Label>
            <Input id="order-customer" disabled={!canEditDetails || busy} value={customerName} onChange={(e) => setCustomerName(e.target.value)}/>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="order-description">{t('workDescription')}</Label>
            <textarea rows={5} id="order-description" disabled={!canEditDetails || busy} className="block min-h-32 w-full resize-y rounded-md border bg-background p-3 disabled:opacity-50" value={description} onChange={(e) => setDescription(e.target.value)}/>
          </div>
          <div>
            <Label htmlFor="order-due">{t('dueAt')}</Label>
            <Input id="order-due" type="date" disabled={!canEditDetails || busy} value={dueAt} onChange={(e) => setDueAt(e.target.value)}/>
          </div>
          <div>
            <Label htmlFor="order-responsible">{t('responsible')}</Label>
            <select id="order-responsible" disabled={!canEditDetails || busy || employeesError} className="h-10 min-w-0 w-full rounded-md border bg-background px-3" value={responsibleId} onChange={(e) => setResponsibleId(e.target.value)}>
              <option value="">{t('noResponsible')}</option>
              {responsibleId && !employees.some((employee) => String(employee.id) === responsibleId) && <option value={responsibleId}>#{responsibleId}</option>}
              {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
            </select>
            {employeesError && <p role="alert">{t('choicesError')}</p>}
          </div>
          {canEditDetails && detailsDirty && <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button onClick={() => void saveDetails()} disabled={busy || !customerName.trim() || !description.trim()}>{t('saveDetails')}</Button>
            <Button variant="outline" disabled={busy} onClick={() => { setCustomerName(order.customerName); setDescription(order.description); setDueAt(order.dueAt?.slice(0, 10) ?? ''); setResponsibleId(order.responsibleId == null ? '' : String(order.responsibleId)); }}>{t('cancelEdit')}</Button>
          </div>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t(execution ? 'approvedWork' : accepted ? 'acceptedQuote' : 'quote')}</CardTitle>
        </CardHeader>
        <CardContent className="min-w-0 space-y-4">
          {canQuote ? <ServiceQuoteEditor lines={lines} onChange={(next) => { setLines(next); setQuoteDirty(true); }} disabled={busy}/> : <SnapshotLines items={displayedItems}/>}
          <p className="text-right text-lg font-semibold">{t('total')}: {formatCurrencyBRL(total, i18n.language)}</p>
          {canQuote && <div className="flex flex-wrap gap-2">
            <Button disabled={busy || detailsDirty || !validDraft(lines)} onClick={() => void saveQuote()}>{t('saveQuote')}</Button>
            {order.status === 'ORCADA' && <Button disabled={busy || unsaved} onClick={() => void action('aprovar')}>{t('approve')}</Button>}
            {unsaved && <p className="w-full text-sm text-muted-foreground">{t('saveBeforeApprove')}</p>}
          </div>}
        </CardContent>
      </Card>
      {execution && accepted && <Card>
        <CardHeader>
          <CardTitle>{t('acceptedQuote')}</CardTitle>
        </CardHeader>
        <CardContent className="min-w-0 break-words [overflow-wrap:anywhere]">
          <SnapshotLines items={snapshot}/>
        </CardContent>
      </Card>}
      {execution && accepted && <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle>{t('supplements')}</CardTitle>
          {canSupplements && !editingSupplements && <Button variant="outline" disabled={busy || detailsDirty} onClick={() => { setSupplements(draftLines(pending)); setEditingSupplements(true); }}>{t('editSupplements')}</Button>}
        </CardHeader>
        <CardContent className="min-w-0 space-y-4">
      {editingSupplements ? <><ServiceQuoteEditor lines={supplements} onChange={(next) => { setSupplements(next); setSupplementsDirty(true); }} disabled={busy}/><div className="flex flex-wrap gap-2">
            <Button disabled={busy || detailsDirty || (!validDraft(supplements) && supplements.length > 0)} onClick={() => void saveSupplements()}>{t('saveSupplements')}</Button>
            <Button variant="outline" disabled={busy} onClick={() => { setEditingSupplements(false); setSupplementsDirty(false); setSupplements(draftLines(pending)); }}>{t('cancelEdit')}</Button>
          </div></> : <><SnapshotLines items={pending}/>{pending.length > 0 && <><p className="text-sm font-medium">{t('pendingApproval')}</p>{canSupplements && <div className="flex flex-wrap gap-2">
            <Button disabled={busy || unsaved} onClick={() => void mutate(async () => applyOrder(await servicesApi.approveSupplements(order.id, order.updatedAt)))}>{t('approveSupplements')}</Button>
            <Button variant="outline" disabled={busy || unsaved} onClick={() => void mutate(async () => applyOrder(await servicesApi.replaceSupplements(order.id, order.updatedAt, [])))}>{t('discardSupplements')}</Button>
          </div>}</>}</>}
    </CardContent>
      </Card>}
      <Card>
        <CardHeader>
          <CardTitle>{t('history')}</CardTitle>
        </CardHeader>
        <CardContent className="min-w-0 break-words [overflow-wrap:anywhere]">
          <ol className="space-y-3">{(order.events ?? []).map((event) => <li key={event.id} className="border-l-2 pl-3">
              <p>{event.action} · {t(`statuses.${event.toStatus}`)}</p>
              <time className="text-xs text-muted-foreground">{formatDateTime(event.createdAt, i18n.language)}</time>
            </li>)}</ol>
          {order.sale && <p className="mt-4">{t('linkedSale')}: #{order.sale.id}</p>}
        </CardContent>
      </Card>
      <div className="flex flex-wrap gap-2">
      {execution && order.status === 'APROVADA' && <Button disabled={busy || unsaved} onClick={() => void action('iniciar')}>{t('start')}</Button>}
      {execution && order.status === 'EM_EXECUCAO' && <Button disabled={busy || unsaved || pending.length > 0} onClick={() => void askClose()}>{t('close')}</Button>}
      {(canQuote || openExecution) && <Button variant="outline" disabled={busy || unsaved} onClick={() => void action('cancelar')}>{t('cancelOrder')}</Button>}
      {((execution && accepted) || (!execution && !accepted)) && ['CONCLUIDA', 'CANCELADA'].includes(order.status) && <Button variant="outline" disabled={busy} onClick={() => void action('reabrir')}>{t('reopen')}</Button>}
    </div>
    </main>;
}
