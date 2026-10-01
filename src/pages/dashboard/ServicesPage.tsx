import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { maskCentsInput } from '@/lib/currency';
import { FileText, Loader2, Pencil, Plus, Search, Trash2, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pagination } from '@/components/Pagination';
import { useAuth } from '@/contexts/AuthContext';
import { useConfirm } from '@/contexts/ConfirmContext';
import type { ServiceOffering } from '@/domain/services';
import { formatCurrencyBRL } from '@/i18n/format';
import { servicesApi } from '@/services/api';
type ServiceReference = {
    id: string | number;
    customerName: string;
    status: string;
};
export default function ServicesPage() {
    const { t, i18n } = useTranslation('services');
    const { t: tCommon } = useTranslation('common');
    const { user } = useAuth();
    const confirm = useConfirm();
    const canEdit = user?.role === 'OWNER';
    const [items, setItems] = useState<ServiceOffering[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [actionError, setActionError] = useState(false);
    const [references, setReferences] = useState<ServiceReference[]>([]);
    const [saving, setSaving] = useState(false);
    const [updatingId, setUpdatingId] = useState<string | number | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<ServiceOffering | null>(null);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [referencePrice, setReferencePrice] = useState('');
    const [formError, setFormError] = useState(false);
    const loadServices = useCallback(async () => {
        setLoading(true);
        setLoadError(false);
        try {
            const result = await servicesApi.list({
                page,
                limit,
                search: search || undefined,
            });
            setItems(result.data);
            setTotal(result.total);
        }
        catch (error) {
            console.error('Error loading services', error);
            setLoadError(true);
        }
        finally {
            setLoading(false);
        }
    }, [limit, page, search]);
    useEffect(() => {
        const timer = window.setTimeout(() => { void loadServices(); }, 200);
        return () => window.clearTimeout(timer);
    }, [loadServices]);
    useEffect(() => {
        const timer = window.setTimeout(() => { setPage(1); setSearch(searchInput.trim()); }, 250);
        return () => window.clearTimeout(timer);
    }, [searchInput]);
    const resetForm = () => { setEditing(null); setName(''); setDescription(''); setReferencePrice(''); setFormError(false); };
    const openCreate = () => { resetForm(); setDialogOpen(true); };
    const openEdit = (service: ServiceOffering) => {
        setEditing(service);
        setName(service.name);
        setDescription(service.description ?? '');
        setReferencePrice(service.referencePrice == null ? '' : service.referencePrice.toFixed(2).replace('.', i18n.language === 'pt-BR' ? ',' : '.'));
        setFormError(false);
        setDialogOpen(true);
    };
    const saveService = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!name.trim() || (referencePrice.trim() && (!Number.isFinite(Number(referencePrice.replace(',', '.'))) || Number(referencePrice.replace(',', '.')) < 0)))
            return;
        setSaving(true);
        setFormError(false);
        try {
            const input = {
                name: name.trim(),
                description: description.trim() || null,
                referencePrice: referencePrice.trim() ? Number(referencePrice.replace(',', '.')) : null,
            };
            if (editing)
                await servicesApi.update(editing.id, input);
            else
                await servicesApi.create(input);
            setDialogOpen(false);
            resetForm();
            await loadServices();
        }
        catch (error) {
            console.error('Error saving service', error);
            setFormError(true);
        }
        finally {
            setSaving(false);
        }
    };
    const deleteService = async (service: ServiceOffering) => {
        if (!await confirm({ description: t('confirmDelete', { name: service.name }), confirmLabel: t('deleteService'), destructive: true }))
            return;
        setUpdatingId(service.id);
        setActionError(false);
        setReferences([]);
        try {
            await servicesApi.delete(service.id);
            await loadServices();
        }
        catch (cause) {
            const data = (cause as {
                response?: {
                    data?: {
                        code?: string;
                        references?: ServiceReference[];
                    };
                };
            }).response?.data;
            setReferences(data?.code === 'SERVICE_IN_USE' ? data.references ?? [] : []);
            setActionError(true);
        }
        finally {
            setUpdatingId(null);
        }
    };
    const totalPages = Math.ceil(total / limit);
    const hasMore = items.length === limit;
    return (<main className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
            <Wrench aria-hidden="true" className="h-8 w-8"/>
            {t('title')}
          </h1>
          <p className="mt-1 text-muted-foreground">{t('description')}</p>
        </div>
        {canEdit && <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4"/>
          {t('newService')}
        </Button>}
      </div>
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-end justify-between gap-3">
          <CardTitle className="text-lg">{t('all')}</CardTitle>
          <div className="flex flex-wrap gap-3">
            <div className="relative">
              <Search aria-hidden="true" className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"/>
              <Input className="pl-9" type="search" aria-label={t('search')} placeholder={t('search')} value={searchInput} onChange={(event) => setSearchInput(event.target.value)}/>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {actionError && <p role="alert" className="mb-4 rounded-md border border-destructive p-3 text-sm text-destructive">{references.length ? t('inUse') : t('saveError')}{references.map((reference) => <Link key={reference.id} className="mt-2 block underline" to={`/dashboard/${['ABERTA', 'ORCADA'].includes(reference.status) ? 'estimates' : 'service-orders'}/${reference.id}`}>{reference.customerName} · #{reference.id}</Link>)}</p>}
          {loadError && <div role="alert" className="space-y-3 py-8 text-center">
            <p>{t('loadError')}</p>
            <Button variant="outline" onClick={() => void loadServices()}>{t('retry')}</Button>
          </div>}
          {!loadError && loading && <p role="status" className="py-8 text-center">{tCommon('loading')}</p>}
          {!loadError && !loading && items.length === 0 && <div className="py-12 text-center text-muted-foreground">
            <FileText aria-hidden="true" className="mx-auto mb-3 h-8 w-8"/>
            <p>{search ? t('noResults') : t('empty')}</p>
          </div>}
          {!loadError && !loading && items.length > 0 && <>
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="p-3">{t('serviceName')}</th>
                  <th className="p-3">{t('serviceDescription')}</th>
                  <th className="p-3">{t('referencePrice')}</th>
                  <th className="p-3 text-right">{t('actions')}</th>
                </tr>
              </thead>
              <tbody>{items.map((service) => <tr key={service.id} className="border-b last:border-0">
                  <td className="p-3 font-medium">{service.name}</td>
                  <td className="p-3">{service.description ? <details>
                      <summary className="max-w-sm cursor-pointer truncate" aria-label={t('viewDescription')}>{service.description.length > 100 ? `${service.description.slice(0, 100)}…` : service.description}</summary>
                      <p className="max-w-xl whitespace-pre-wrap py-2">{service.description}</p>
                    </details> : '—'}</td>
                  <td className="p-3">{service.referencePrice == null ? t('noReferencePrice') : formatCurrencyBRL(service.referencePrice, i18n.language)}</td>
                  <td className="p-3">
                    <div className="flex justify-end gap-2">
                    {canEdit && <Button variant="outline" size="icon" title={`${t('editService')} ${service.name}`} aria-label={`${t('editService')} ${service.name}`} onClick={() => openEdit(service)}>
                        <Pencil aria-hidden="true" className="h-4 w-4"/>
                      </Button>}
                    {canEdit && <Button variant="outline" size="icon" title={`${t('deleteService')} ${service.name}`} aria-label={`${t('deleteService')} ${service.name}`} disabled={updatingId === service.id} onClick={() => void deleteService(service)}>{updatingId === service.id ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin"/> : <Trash2 aria-hidden="true" className="h-4 w-4"/>}</Button>}
                  </div>
                  </td>
                </tr>)}</tbody>
            </table>
          </div>
            <Pagination currentPage={page} pageSize={limit} totalPages={totalPages} hasMore={hasMore} onPageChange={setPage} onPageSizeChange={(size) => { setLimit(size); setPage(1); }} isLoading={loading}/>
          </>}
        </CardContent>
      </Card>
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!saving) {
        setDialogOpen(open);
        if (!open)
            resetForm();
    } }}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editing ? t('editService') : t('newService')}</DialogTitle>
            <DialogDescription>{t('description')}</DialogDescription>
          </DialogHeader>
          <form onSubmit={saveService} className="space-y-4">
            {formError && <p role="alert" className="rounded-md border border-destructive p-3 text-sm text-destructive">{t('saveError')}</p>}
            <div className="space-y-2">
              <Label htmlFor="service-name">{t('serviceName')}</Label>
              <Input id="service-name" value={name} onChange={(event) => setName(event.target.value)} required autoFocus/>
            </div>
            <div className="space-y-2">
              <Label htmlFor="service-description">{t('serviceDescription')}</Label>
              <textarea className="w-full rounded-md border bg-background p-3" rows={10} id="service-description" value={description} onChange={(event) => setDescription(event.target.value)}/>
            </div>
            <div className="space-y-2">
              <Label htmlFor="service-reference-price">{t('referencePrice')}</Label>
              <Input id="service-reference-price" type="text" inputMode="decimal" value={referencePrice} onChange={(event) => setReferencePrice(event.target.value ? maskCentsInput(event.target.value).replace('.', i18n.language === 'pt-BR' ? ',' : '.') : '')} placeholder={t('noReferencePrice')}/>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" disabled={saving} onClick={() => setDialogOpen(false)}>{t('cancel')}</Button>
              <Button type="submit" disabled={saving || !name.trim()}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}{editing ? t('update') : t('create')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </main>);
}
