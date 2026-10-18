import { createEffect, createSignal, onCleanup } from 'solid-js'
import { A } from '@solidjs/router'
import { createMutation, createQuery, useQueryClient } from '@tanstack/solid-query'
import { FileText, Loader2, Pencil, Plus, Search, Trash2, Wrench } from 'lucide-solid'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Pagination } from '@/components/Pagination'
import { useAuth } from '@/contexts/AuthContext'
import { useConfirm } from '@/contexts/ConfirmContext'
import { useTranslation } from '@/i18n/solid'
import { centsFromInput, inputFromCents, formatCents } from '@/lib/money'
import { createCursorPages, totalPagesOf } from '@/lib/cursor-pages'
import { apiErrorOf } from '@/api/errors'
import { getServiceErrorTranslationKey } from '@/i18n/error-keys'
import { createService, updateService, deleteService as removeService, listServices, serviceKeys, serviceReferences, type CatalogService, type ServiceReference, type UpdateServiceRequest } from '@/api/services'

export default function ServicesPage() {
    const { t, language } = useTranslation('services')
    const { t: tCommon } = useTranslation('common')
    const { user } = useAuth()
    const confirm = useConfirm()
    const client = useQueryClient()
    const canEdit = () => user()?.role === 'OWNER'
    const pages = createCursorPages()
    const [searchInput, setSearchInput] = createSignal('')
    const [search, setSearch] = createSignal('')
    createEffect(() => {
        const value = searchInput().trim()
        const timer = window.setTimeout(() => { pages.reset(); setSearch(value) }, 250)
        onCleanup(() => window.clearTimeout(timer))
    })
    const services = createQuery(() => ({
        queryKey: [...serviceKeys.all, { search: search(), cursor: pages.cursor(), limit: pages.limit() }],
        queryFn: ({ signal }) => listServices({ search: search(), cursor: pages.cursor(), limit: pages.limit() }, signal),
    }))
    const items = () => services.data?.items ?? []
    const loading = () => services.isPending
    const loadError = () => services.isError
    const totalPages = () => totalPagesOf(services.data?.total ?? 0, pages.limit())
    const hasMore = () => !!services.data?.nextCursor
    const loadServices = () => services.refetch()
    const [actionError, setActionError] = createSignal(false)
    const [deleteErrorCode, setDeleteErrorCode] = createSignal<string>()
    const [references, setReferences] = createSignal<ServiceReference[]>([])
    const [updatingId, setUpdatingId] = createSignal<string | null>(null)
    const [dialogOpen, setDialogOpen] = createSignal(false)
    const [editing, setEditing] = createSignal<CatalogService | null>(null)
    const [name, setName] = createSignal('')
    const [description, setDescription] = createSignal('')
    const [referencePrice, setReferencePrice] = createSignal('')
    const [formError, setFormError] = createSignal(false)
    const save = createMutation(() => ({
        mutationFn: async (input: { service: CatalogService | null; body: UpdateServiceRequest }) => {
            if (input.service) return updateService(input.service.id, input.body)
            return createService({ name: input.body.name!, ...(input.body.description ? { description: input.body.description } : {}), ...(input.body.referencePriceCents != null ? { referencePriceCents: input.body.referencePriceCents } : {}) })
        },
    }))
    const remove = createMutation(() => ({ mutationFn: removeService }))
    const saving = () => save.isPending
    const resetForm = () => { setEditing(null); setName(''); setDescription(''); setReferencePrice(''); setFormError(false) }
    const openCreate = () => { resetForm(); setDialogOpen(true) }
    const openEdit = (service: CatalogService) => {
        setEditing(service); setName(service.name); setDescription(service.description ?? '')
        setReferencePrice(service.referencePriceCents == null ? '' : inputFromCents(service.referencePriceCents).replace('.', language() === 'pt-BR' ? ',' : '.'))
        setFormError(false); setDialogOpen(true)
    }
    const saveService = async (event: SubmitEvent) => {
        event.preventDefault()
        if (!canEdit() || saving() || !name().trim()) return
        setFormError(false)
        try {
            await save.mutateAsync({ service: editing(), body: { name: name().trim(), description: description().trim() || null, referencePriceCents: referencePrice().trim() ? centsFromInput(referencePrice()) : null } })
            setDialogOpen(false); resetForm()
            await client.invalidateQueries({ queryKey: serviceKeys.all })
        } catch { setFormError(true) }
    }
    const deleteService = async (service: CatalogService) => {
        if (!canEdit() || remove.isPending || updatingId()) return
        setUpdatingId(service.id)
        if (!await confirm({ description: t('confirmDelete', { name: service.name }), confirmLabel: t('deleteService'), destructive: true })) { setUpdatingId(null); return }
        setActionError(false); setDeleteErrorCode(undefined); setReferences([])
        try {
            await remove.mutateAsync(service.id)
            await client.invalidateQueries({ queryKey: serviceKeys.all })
        } catch (error) {
            setDeleteErrorCode(apiErrorOf(error).code)
            setReferences(serviceReferences(error)); setActionError(true)
        } finally { setUpdatingId(null) }
    }
    return (<main class="space-y-6">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 class="flex items-center gap-2 text-3xl font-bold tracking-tight">
            <Wrench aria-hidden="true" class="h-8 w-8"/>
            {t('title')}
          </h1>
          <p class="mt-1 text-muted-foreground">{t('description')}</p>
        </div>
        {canEdit() && <Button onClick={openCreate}>
          <Plus class="mr-2 h-4 w-4"/>
          {t('newService')}
        </Button>}
      </div>
      <Card>
        <CardHeader class="flex flex-row flex-wrap items-end justify-between gap-3">
          <CardTitle class="text-lg">{t('all')}</CardTitle>
          <div class="flex flex-wrap gap-3">
            <div class="relative">
              <Search aria-hidden="true" class="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"/>
              <Input class="pl-9" type="search" aria-label={t('search')} placeholder={t('search')} value={searchInput()} onInput={(event) => setSearchInput(event.currentTarget.value)}/>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {actionError() && <p role="alert" class="mb-4 rounded-md border border-destructive p-3 text-sm text-destructive">{t(getServiceErrorTranslationKey('deleteService', deleteErrorCode()).key)}{references().map((reference) => <A class="mt-2 block underline" href={`/dashboard/${['OPEN', 'QUOTED'].includes(reference.status) ? 'estimates' : 'service-orders'}/${reference.id}`}>{reference.customerName} · #{reference.id}</A>)}</p>}
          {loadError() && <div role="alert" class="space-y-3 py-8 text-center">
            <p>{t(getServiceErrorTranslationKey('loadServices', apiErrorOf(services.error).code).key)}</p>
            <Button variant="outline" onClick={() => void loadServices()}>{t('retry')}</Button>
          </div>}
          {!loadError() && loading() && <p role="status" class="py-8 text-center">{tCommon('loading')}</p>}
          {!loadError() && !loading() && items().length === 0 && <div class="py-12 text-center text-muted-foreground">
            <FileText aria-hidden="true" class="mx-auto mb-3 h-8 w-8"/>
            <p>{search() ? t('noResults') : t('empty')}</p>
          </div>}
          {!loadError() && !loading() && items().length > 0 && <>
            <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b text-left text-muted-foreground">
                  <th class="p-3">{t('serviceName')}</th>
                  <th class="p-3">{t('serviceDescription')}</th>
                  <th class="p-3">{t('referencePrice')}</th>
                  <th class="p-3 text-right">{t('actions')}</th>
                </tr>
              </thead>
              <tbody>{items().map((service) => <tr class="border-b last:border-0">
                  <td class="p-3 font-medium">{service.name}</td>
                  <td class="p-3">{service.description ? <details>
                      <summary class="max-w-sm cursor-pointer truncate" aria-label={t('viewDescription')}>{service.description.length > 100 ? `${service.description.slice(0, 100)}…` : service.description}</summary>
                      <p class="max-w-xl whitespace-pre-wrap py-2">{service.description}</p>
                    </details> : '—'}</td>
                  <td class="p-3">{service.referencePriceCents == null ? t('noReferencePrice') : formatCents(service.referencePriceCents, language())}</td>
                  <td class="p-3">
                    <div class="flex justify-end gap-2">
                    {canEdit() && <Button variant="outline" size="icon" title={`${t('editService')} ${service.name}`} aria-label={`${t('editService')} ${service.name}`} onClick={() => openEdit(service)}>
                        <Pencil aria-hidden="true" class="h-4 w-4"/>
                      </Button>}
                    {canEdit() && <Button variant="outline" size="icon" title={`${t('deleteService')} ${service.name}`} aria-label={`${t('deleteService')} ${service.name}`} disabled={updatingId() === service.id} onClick={() => void deleteService(service)}>{updatingId() === service.id ? <Loader2 aria-hidden="true" class="h-4 w-4 animate-spin"/> : <Trash2 aria-hidden="true" class="h-4 w-4"/>}</Button>}
                  </div>
                  </td>
                </tr>)}</tbody>
            </table>
          </div>
            <Pagination currentPage={pages.page()} pageSize={pages.limit()} totalPages={totalPages()} hasMore={hasMore()} onPageChange={(target) => pages.goTo(target, services.data?.nextCursor)} onPageSizeChange={pages.setLimit} isLoading={loading()}/>
          </>}
        </CardContent>
      </Card>
      <Dialog open={dialogOpen()} onOpenChange={(open) => { if (!saving()) {
        setDialogOpen(open);
        if (!open)
            resetForm();
    } }}>
        <DialogContent class="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editing() ? t('editService') : t('newService')}</DialogTitle>
            <DialogDescription>{t('description')}</DialogDescription>
          </DialogHeader>
          <form onSubmit={saveService} class="space-y-4">
            {formError() && <p role="alert" class="rounded-md border border-destructive p-3 text-sm text-destructive">{t(getServiceErrorTranslationKey('saveService', apiErrorOf(save.error).code).key)}</p>}
            <div class="space-y-2">
              <Label for="service-name">{t('serviceName')}</Label>
              <Input id="service-name" value={name()} onInput={(event) => setName(event.currentTarget.value)} required autofocus/>
            </div>
            <div class="space-y-2">
              <Label for="service-description">{t('serviceDescription')}</Label>
              <textarea class="w-full rounded-md border bg-background p-3" rows={10} id="service-description" value={description()} onInput={(event) => setDescription(event.currentTarget.value)}/>
            </div>
            <div class="space-y-2">
              <Label for="service-reference-price">{t('referencePrice')}</Label>
              <Input id="service-reference-price" type="text" inputmode="decimal" value={referencePrice()} onInput={(event) => setReferencePrice(event.currentTarget.value ? inputFromCents(centsFromInput(event.currentTarget.value)).replace('.', language() === 'pt-BR' ? ',' : '.') : '')} placeholder={t('noReferencePrice')}/>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" disabled={saving()} onClick={() => setDialogOpen(false)}>{t('cancel')}</Button>
              <Button type="submit" disabled={saving() || !name().trim()}>{saving() && <Loader2 class="mr-2 h-4 w-4 animate-spin"/>}{editing() ? t('update') : t('create')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </main>);
}
