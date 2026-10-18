import type { Product } from '@/api/catalog';
import { listProducts } from '@/api/catalog';
import { loadedData } from '@/api/query';
import type { components } from '@/api/schema';
import type { ServiceOrderItem,ServiceOrderQuoteInput } from '@/api/service-orders';
import { createService,listServices } from '@/api/services';
import { Pagination } from '@/components/Pagination';
import { Button } from '@/components/ui/button';
import { Dialog,DialogClose,DialogContent,DialogDescription,DialogFooter,DialogHeader,DialogTitle,DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from '@/i18n/solid';
import { createCursorPages } from '@/lib/cursor-pages';
import { centsFromInput,formatCents,inputFromCents } from '@/lib/money';
import { createMutation,createQuery } from '@tanstack/solid-query';
import { Plus,Trash2 } from 'lucide-solid';
import { createEffect,createSignal,createUniqueId,Index } from 'solid-js';
type CatalogChoice = {
    id: number | string;
    name: string;
    description?: string | null;
    priceCents: number | null;
};
function CatalogTable(props: {
    kind: 'PRODUCT' | 'SERVICE';
    items: CatalogChoice[];
    disabled: boolean;
    onAdd: (id: string) => void;
}) {
    const { t, i18n } = useTranslation('estimates');
    const { t: tServices } = useTranslation('services');
    return <table aria-label={t(props.kind === 'PRODUCT' ? 'product' : 'service')} class="w-full table-fixed text-sm">
      <thead>
        <tr class="border-b text-left text-muted-foreground">
          <th scope="col" class="w-[28%] p-1.5 [overflow-wrap:anywhere] sm:p-2">{t('lineName')}</th>
          <th scope="col" class="p-1.5 [overflow-wrap:anywhere] sm:p-2">{t('lineDetails')}</th>
          <th scope="col" class="w-20 p-1.5 [overflow-wrap:anywhere] sm:p-2">{t('unitPrice')}</th>
          <th scope="col" class="w-10 p-1.5 sm:w-12 sm:p-2"><span class="sr-only">{t('actions')}</span></th>
        </tr>
      </thead>
      <tbody>{props.items.map((item) => <tr class="border-b align-top last:border-0">
        <td class="p-1.5 font-medium [overflow-wrap:anywhere] sm:p-2">{item.name}</td>
        <td class="p-1.5 text-muted-foreground sm:p-2"><p class="line-clamp-2 whitespace-pre-wrap [overflow-wrap:anywhere]" title={item.description || undefined}>{item.description || '—'}</p></td>
        <td class="p-1.5 [overflow-wrap:anywhere] sm:p-2">{item.priceCents == null ? tServices('noReferencePrice') : formatCents(item.priceCents, i18n.language)}</td>
        <td class="p-1.5 sm:p-2">
          <Button type="button" variant="outline" size="icon" class="h-7 w-7 shrink-0 sm:h-8 sm:w-8" disabled={props.disabled} title={`${t(props.kind === 'PRODUCT' ? 'addProduct' : 'addService')} ${item.name}`} aria-label={`${t(props.kind === 'PRODUCT' ? 'addProduct' : 'addService')} ${item.name}`} onClick={() => props.onAdd(String(item.id))}>
            <Plus aria-hidden="true" class="h-4 w-4"/>
          </Button>
        </td>
      </tr>)}</tbody>
    </table>;
}
const responsivePagination = "[&>div]:flex-wrap [&>div]:justify-start [&>div]:gap-3 [&>div]:space-x-0 [&>div>div]:flex-wrap [&>div>div]:gap-2 [&>div>div]:space-x-0 [&_[aria-haspopup=listbox]]:ml-0";
export type DraftLine = ServiceOrderItem & {
    key: string;
};
export function draftLines(items: ServiceOrderItem[]): DraftLine[] {
    return items.map((item, index) => ({ ...item, key: String(item.id ?? index), kind: item.kind ?? (item.productId != null ? 'PRODUCT' : 'SERVICE') }));
}
export function quotePayload(lines: DraftLine[]): ServiceOrderQuoteInput[] {
    return lines.map((line) => ({ ...(line.productId != null ? { productId: line.productId } : line.serviceId != null ? { serviceId: line.serviceId } : {}), description: line.description, details: line.details ?? null, quantity: line.quantity, unitPriceCents: line.unitPriceCents }));
}
export function validDraft(lines: DraftLine[]) {
    return lines.length > 0 && lines.every((line) => line.description.trim() && Number.isInteger(line.quantity) && line.quantity > 0 && Number.isFinite(line.unitPriceCents) && line.unitPriceCents >= 0);
}
export function SnapshotLines(props: {
    items: (Omit<ServiceOrderItem,'isSupplement'> & {isSupplement?:boolean})[];
}) {
    const { t, i18n } = useTranslation('estimates');
    return <div class="space-y-3">{props.items.length === 0 && <p class="text-muted-foreground">{t('emptyItems')}</p>}{props.items.map((item) => <div class="grid min-w-0 gap-2 border-b pb-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div class="min-w-0">
          <p class="font-medium [overflow-wrap:anywhere]">{item.description}</p>
          {item.details && <details class="mt-1 text-xs text-muted-foreground"><summary class="cursor-pointer">{t('lineDetails')}</summary><p class="mt-2 whitespace-pre-wrap text-sm [overflow-wrap:anywhere]">{item.details}</p></details>}
        </div>
        <p>{item.quantity} × {formatCents(item.unitPriceCents, i18n.language)}</p>
      </div>)}</div>;
}
export default function ServiceQuoteEditor(props: {
    lines: DraftLine[];
    onChange: (lines: DraftLine[]) => void;
    disabled: boolean;
}) {
    const { t, i18n } = useTranslation('estimates');
    const { t: tCommon } = useTranslation('common');
    const { user } = useAuth();
    const [picker, setPicker] = createSignal<'PRODUCT' | 'SERVICE' | null>(null);
    const draftId = createUniqueId();
    let nextLine = 0;
    const newDraftKey = () => `${draftId}-line-${nextLine++}`;
    const [products, setProducts] = createSignal<Product[]>([]);
    const [offerings, setOfferings] = createSignal<components['schemas']['CatalogService'][]>([]);
    const [productSearch, setProductSearch] = createSignal('');
    const [serviceSearch, setServiceSearch] = createSignal('');
    const [productTotal, setProductTotal] = createSignal(0);
    const [serviceTotal, setServiceTotal] = createSignal(0);
    const [productError, setProductError] = createSignal(false);
    const [serviceError, setServiceError] = createSignal(false);
    const [productLoading, setProductLoading] = createSignal(true);
    const [serviceLoading, setServiceLoading] = createSignal(true);
    const [retry, setRetry] = createSignal(0);
    const [catalogBusy, setCatalogBusy] = createSignal<string | null>(null);
    const [catalogMessage, setCatalogMessage] = createSignal('');
    const productPages = createCursorPages();
    const servicePages = createCursorPages();
    const productQuery = createQuery(() => ({ queryKey: ['products', 'quote-picker', productSearch(), productPages.cursor(), productPages.limit(), retry()], queryFn: ({ signal }) => listProducts({ search: productSearch(), cursor: productPages.cursor(), limit: productPages.limit() }, signal), enabled: picker() === 'PRODUCT' }));
    const serviceQuery = createQuery(() => ({ queryKey: ['services', 'quote-picker', serviceSearch(), servicePages.cursor(), servicePages.limit(), retry()], queryFn: ({ signal }) => listServices({ search: serviceSearch(), cursor: servicePages.cursor(), limit: servicePages.limit() }, signal), enabled: picker() === 'SERVICE' }));
    createEffect(() => { setProducts(loadedData(productQuery)?.items ?? []); setProductLoading(productQuery.isPending); setProductError(productQuery.isError); setProductTotal(loadedData(productQuery)?.total ?? 0); });
    createEffect(() => { setOfferings(loadedData(serviceQuery)?.items ?? []); setServiceLoading(serviceQuery.isPending); setServiceError(serviceQuery.isError); setServiceTotal(loadedData(serviceQuery)?.total ?? 0); });
    const update = (index: number, patch: Partial<DraftLine>) => props.onChange(props.lines.map((line, i) => i === index ? { ...line, ...patch } : line));
    const addCatalog = (kind: 'PRODUCT' | 'SERVICE', id: string) => {
        const selected = kind === 'PRODUCT' ? products().find((item) => String(item.id) === id) : offerings().find((item) => String(item.id) === id);
        if (!selected)
            return;
        props.onChange([...props.lines, { key: newDraftKey(), isSupplement: false, productId: kind === 'PRODUCT' ? selected.id : null, serviceId: kind === 'SERVICE' ? selected.id : null, kind, description: selected.name, details: kind === 'SERVICE' ? (selected as components['schemas']['CatalogService']).description : (selected as Product).ingredients || (selected as Product).productType?.description || null, quantity: 1, unitPriceCents: kind === 'PRODUCT' ? Number((selected as Product).priceCents) : Number((selected as components['schemas']['CatalogService']).referencePriceCents ?? 0) }]);
        setPicker(null);
    };
    const catalogMutation = createMutation(() => ({mutationFn:(body:Parameters<typeof createService>[0])=>createService(body)}));
    const saveToCatalog = async (line: DraftLine) => {
        if (catalogBusy() || props.disabled) return;
        setCatalogBusy(line.key);
        setCatalogMessage('');
        try {
            await catalogMutation.mutateAsync({ name: line.description.trim(), description: line.details?.trim() || undefined, referencePriceCents: line.unitPriceCents });
            setCatalogMessage(t('catalogSaved'));
            setRetry((value) => value + 1);
        }
        catch {
            setCatalogMessage(t('catalogSaveError'));
        }
        finally {
            setCatalogBusy(null);
        }
    };
    return <div class="min-w-0 space-y-3">
      <div class="flex flex-wrap gap-2">
        {
    (['PRODUCT', 'SERVICE'] as const).map((kind) => {
        const product = kind === 'PRODUCT';
        const title = t(product ? 'addProduct' : 'addService');
        const loading = () => product ? productLoading() : serviceLoading();
        const failed = () => product ? productError() : serviceError();
        const choices = () => product ? products().map((item) => ({ id: item.id, name: item.name, description: item.ingredients || item.productType?.description, priceCents: Number(item.priceCents) })) : offerings().map((item) => ({ id: item.id, name: item.name, description: item.description, priceCents: item.referencePriceCents == null ? null : Number(item.referencePriceCents) }));
        return <Dialog open={picker() === kind} onOpenChange={(open) => setPicker(open ? kind : null)}>
            <DialogTrigger as={Button} type="button" variant="outline" size="sm" disabled={props.disabled}><Plus aria-hidden="true" class="mr-2 h-4 w-4"/>{title}</DialogTrigger>
            <DialogContent class="flex max-h-[85dvh] w-[calc(100vw-2rem)] max-w-3xl flex-col gap-3 p-4 sm:p-6">
              <DialogHeader>
                <DialogTitle>{title}</DialogTitle>
                <DialogDescription class="sr-only">{t(product ? 'searchProducts' : 'searchServices')}</DialogDescription>
              </DialogHeader>
              <Input type="search" aria-label={t(product ? 'searchProducts' : 'searchServices')} placeholder={t(product ? 'searchProducts' : 'searchServices')} value={product ? productSearch() : serviceSearch()} disabled={props.disabled} onInput={(event) => {
                if (product) {
                    setProductSearch(event.currentTarget.value);
                    productPages.reset();
                }
                else {
                    setServiceSearch(event.currentTarget.value);
                    servicePages.reset();
                }
            }}/>
              <div class="min-h-0 min-w-0 overflow-y-auto">
                <CatalogTable kind={kind} items={loading() || failed() ? [] : choices()} disabled={props.disabled || loading() || failed()} onAdd={(id) => addCatalog(kind, id)}/>
                {!failed() && loading() && <p role="status" class="p-3 text-sm text-muted-foreground">{tCommon('loading')}</p>}
                {!failed() && !loading() && choices().length === 0 && <p class="p-3 text-sm text-muted-foreground">{tCommon('noResults')}</p>}
                {failed() && <div role="alert" class="space-y-2 p-3 text-sm"><p>{t('choicesError')}</p><Button type="button" variant="outline" size="sm" onClick={() => setRetry((value) => value + 1)}>{t('retry')}</Button></div>}
              </div>
              <div class={responsivePagination}><Pagination currentPage={product ? productPages.page() : servicePages.page()} pageSize={product ? productPages.limit() : servicePages.limit()} totalPages={Math.ceil((product ? productTotal() : serviceTotal()) / (product ? productPages.limit() : servicePages.limit()))} hasMore={choices().length === (product ? productPages.limit() : servicePages.limit())} onPageChange={(n) => (product ? productPages : servicePages).goTo(n, (product ? loadedData(productQuery)?.nextCursor : loadedData(serviceQuery)?.nextCursor))} onPageSizeChange={(size) => {
                if (product) {
                    productPages.setLimit(size);
                }
                else {
                    servicePages.setLimit(size);
                }
            }} isLoading={props.disabled || loading()}/></div>
              <DialogFooter class="gap-2 sm:justify-between">{!product && <Button type="button" variant="ghost" size="sm" class="h-auto min-h-9 max-w-full whitespace-normal" disabled={props.disabled} onClick={() => { props.onChange([...props.lines, { key: newDraftKey(), isSupplement: false, kind: 'SERVICE', productId: null, serviceId: null, description: '', details: null, quantity: 1, unitPriceCents: 0 }]); setPicker(null); }}>{t('addLabor')}</Button>}<DialogClose as={Button} type="button" variant="outline" size="sm">{tCommon('close')}</DialogClose></DialogFooter>
            </DialogContent>
          </Dialog>;
        })}
      </div>
      {props.lines.length === 0 && <p class="py-4 text-sm text-muted-foreground">{t('emptyItems')}</p>}
      <div class="divide-y divide-dashed"><Index each={props.lines}>{(line,index) => <fieldset disabled={props.disabled} class="min-w-0 space-y-2 py-3">
        <div class="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-2 sm:grid-cols-[minmax(0,1fr)_5rem_7rem_auto]">
          <div class="col-span-3 min-w-0 sm:col-span-1">
            {line().productId != null || line().serviceId != null ? <p class="text-sm font-medium [overflow-wrap:anywhere]">{line().description}</p> : <><Label class="text-xs" for={`name-${line().key}`}>{t('lineName')}</Label><Input class="h-8" id={`name-${line().key}`} value={line().description} onInput={(event) => update(index, { description: event.currentTarget.value })} required/></>}
            <p class="mt-1 text-xs text-muted-foreground">{t('total')}: {formatCents(line().unitPriceCents * line().quantity, i18n.language)}</p>
          </div>
          <div class="min-w-0">
            <Label class="text-xs" for={`qty-${line().key}`}>{t('quantity')}</Label>
            <Input class="h-8" id={`qty-${line().key}`} type="number" min="1" step="1" value={line().quantity} onInput={(event) => update(index, { quantity: Number(event.currentTarget.value) })}/>
          </div>
          <div class="min-w-0">
            <Label class="text-xs" for={`price-${line().key}`}>{t('unitPrice')}</Label>
            <Input class="h-8" id={`price-${line().key}`} type="text" inputMode="decimal" disabled={line().kind === 'PRODUCT' || props.disabled} value={inputFromCents(line().unitPriceCents).replace('.', i18n.language === 'pt-BR' ? ',' : '.')} onInput={(event) => update(index, { unitPriceCents: centsFromInput(event.currentTarget.value) })}/>
          </div>
          <Button type="button" variant="ghost" size="icon" class="h-8 w-8" title={t('remove')} aria-label={`${t('remove')} ${line().description}`} onClick={() => props.onChange(props.lines.filter((item) => item.key !== line().key))}><Trash2 aria-hidden="true" class="h-4 w-4"/></Button>
        </div>
        <details class="min-w-0">
          <summary class="cursor-pointer text-xs text-muted-foreground [overflow-wrap:anywhere]"><span>{t('lineDetails')}</span>{line().details && <span class="ml-2">· {line().details!.slice(0, 70).replace(/\s+/g, ' ')}{line().details!.length > 70 ? '…' : ''}</span>}</summary>
          <div class="mt-2 min-w-0 space-y-2">
            <Label class="sr-only" for={`details-${line().key}`}>{t('lineDetails')}</Label>
            <textarea id={`details-${line().key}`} rows={3} class="block w-full min-w-0 resize-y rounded-md border bg-background p-2 text-sm" value={line().details ?? ''} onInput={(event) => update(index, { details: event.currentTarget.value })}/>
            {user()?.role === 'OWNER' && line().productId == null && line().serviceId == null && <Button type="button" variant="outline" size="sm" class="h-auto min-h-8 max-w-full whitespace-normal" disabled={props.disabled || catalogBusy() != null || !line().description.trim()} onClick={() => void saveToCatalog(line())}>{t('saveToCatalog')}</Button>}
          </div>
        </details>
      </fieldset>}</Index></div>
      {catalogMessage() && <p role="status" class="text-sm">{catalogMessage()}</p>}
    </div>;
}
