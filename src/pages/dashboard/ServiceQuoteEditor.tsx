import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pagination } from '@/components/Pagination';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import api, { servicesApi, type ServiceOrderQuoteInput } from '@/services/api';
import { parseListResponse } from '@/services/parseResponse';
import { maskCentsInput } from '@/lib/currency';
import { formatCurrencyBRL } from '@/i18n/format';
import type { Product } from '@/domain/models';
import type { ServiceOffering, ServiceOrderItem } from '@/domain/services';
type CatalogChoice = {
    id: number | string;
    name: string;
    description?: string | null;
    price: number | null;
};
function CatalogTable({ kind, items, disabled, onAdd }: {
    kind: 'PRODUCT' | 'SERVICE';
    items: CatalogChoice[];
    disabled: boolean;
    onAdd: (id: string) => void;
}) {
    const { t, i18n } = useTranslation('estimates');
    const { t: tServices } = useTranslation('services');
    return <table aria-label={t(kind === 'PRODUCT' ? 'product' : 'service')} className="w-full table-fixed text-sm">
      <thead>
        <tr className="border-b text-left text-muted-foreground">
          <th scope="col" className="w-[28%] p-1.5 [overflow-wrap:anywhere] sm:p-2">{t('lineName')}</th>
          <th scope="col" className="p-1.5 [overflow-wrap:anywhere] sm:p-2">{t('lineDetails')}</th>
          <th scope="col" className="w-20 p-1.5 [overflow-wrap:anywhere] sm:p-2">{t('unitPrice')}</th>
          <th scope="col" className="w-10 p-1.5 sm:w-12 sm:p-2"><span className="sr-only">{t('actions')}</span></th>
        </tr>
      </thead>
      <tbody>{items.map((item) => <tr key={item.id} className="border-b align-top last:border-0">
        <td className="p-1.5 font-medium [overflow-wrap:anywhere] sm:p-2">{item.name}</td>
        <td className="p-1.5 text-muted-foreground sm:p-2"><p className="line-clamp-2 whitespace-pre-wrap [overflow-wrap:anywhere]" title={item.description || undefined}>{item.description || '—'}</p></td>
        <td className="p-1.5 [overflow-wrap:anywhere] sm:p-2">{item.price == null ? tServices('noReferencePrice') : formatCurrencyBRL(item.price, i18n.language)}</td>
        <td className="p-1.5 sm:p-2">
          <Button type="button" variant="outline" size="icon" className="h-7 w-7 shrink-0 sm:h-8 sm:w-8" disabled={disabled} title={`${t(kind === 'PRODUCT' ? 'addProduct' : 'addService')} ${item.name}`} aria-label={`${t(kind === 'PRODUCT' ? 'addProduct' : 'addService')} ${item.name}`} onClick={() => onAdd(String(item.id))}>
            <Plus aria-hidden="true" className="h-4 w-4" />
          </Button>
        </td>
      </tr>)}</tbody>
    </table>;
}
const responsivePagination = "[&>div]:flex-wrap [&>div]:justify-start [&>div]:gap-3 [&>div]:space-x-0 [&>div>div]:flex-wrap [&>div>div]:gap-2 [&>div>div]:space-x-0";
export type DraftLine = ServiceOrderItem & {
    key: string;
};
export function draftLines(items: ServiceOrderItem[]): DraftLine[] {
    return items.map((item, index) => ({ ...item, key: String(item.id ?? index), kind: item.kind ?? (item.productId != null ? 'PRODUCT' : 'SERVICE') }));
}
export function quotePayload(lines: DraftLine[]): ServiceOrderQuoteInput[] {
    return lines.map((line) => ({ ...(line.productId != null ? { productId: line.productId } : line.serviceOfferingId != null ? { serviceOfferingId: line.serviceOfferingId } : {}), description: line.description, details: line.details ?? null, quantity: line.quantity, unitPrice: line.unitPrice }));
}
export function validDraft(lines: DraftLine[]) {
    return lines.length > 0 && lines.every((line) => line.description.trim() && Number.isInteger(line.quantity) && line.quantity > 0 && Number.isFinite(line.unitPrice) && line.unitPrice >= 0);
}
export function SnapshotLines({ items }: {
    items: ServiceOrderItem[];
}) {
    const { t, i18n } = useTranslation('estimates');
    return <div className="space-y-3">{items.length === 0 && <p className="text-muted-foreground">{t('emptyItems')}</p>}{items.map((item, index) => <div key={item.id ?? index} className="grid min-w-0 gap-2 border-b pb-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0">
          <p className="font-medium [overflow-wrap:anywhere]">{item.description}</p>
          {item.details && <details className="mt-1 text-xs text-muted-foreground"><summary className="cursor-pointer">{t('lineDetails')}</summary><p className="mt-2 whitespace-pre-wrap text-sm [overflow-wrap:anywhere]">{item.details}</p></details>}
        </div>
        <p>{item.quantity} × {formatCurrencyBRL(item.unitPrice, i18n.language)}</p>
      </div>)}</div>;
}
export default function ServiceQuoteEditor({ lines, onChange, disabled }: {
    lines: DraftLine[];
    onChange: (lines: DraftLine[]) => void;
    disabled: boolean;
}) {
    const { t, i18n } = useTranslation('estimates');
    const { t: tCommon } = useTranslation('common');
    const { user } = useAuth();
    const [picker, setPicker] = useState<'PRODUCT' | 'SERVICE' | null>(null);
    const draftId = useId();
    const nextLine = useRef(0);
    const newDraftKey = () => `${draftId}-line-${nextLine.current++}`;
    const [products, setProducts] = useState<Product[]>([]);
    const [offerings, setOfferings] = useState<ServiceOffering[]>([]);
    const [productSearch, setProductSearch] = useState('');
    const [serviceSearch, setServiceSearch] = useState('');
    const [productPage, setProductPage] = useState(1);
    const [servicePage, setServicePage] = useState(1);
    const [productTotal, setProductTotal] = useState(0);
    const [serviceTotal, setServiceTotal] = useState(0);
    const [productError, setProductError] = useState(false);
    const [serviceError, setServiceError] = useState(false);
    const [productLoading, setProductLoading] = useState(true);
    const [serviceLoading, setServiceLoading] = useState(true);
    const [retry, setRetry] = useState(0);
    const [catalogBusy, setCatalogBusy] = useState<string | null>(null);
    const [catalogMessage, setCatalogMessage] = useState('');
    const [productLimit, setProductLimit] = useState(10);
    const [serviceLimit, setServiceLimit] = useState(10);
    useEffect(() => {
        if (picker !== 'PRODUCT') return;
        let alive = true;
        setProductLoading(true);
        setProductError(false);
        const timer = window.setTimeout(() => { api.get('/produtos', { params: { page: productPage, limit: productLimit, search: productSearch } }).then((response) => { if (alive) {
            const result = parseListResponse<Product>(response);
            setProducts(result.data);
            setProductTotal(result.total);
        } }).catch(() => { if (alive)
            setProductError(true); }).finally(() => { if (alive)
            setProductLoading(false); }); }, 200);
        return () => { alive = false; window.clearTimeout(timer); };
    }, [picker, productSearch, productPage, productLimit, retry]);
    useEffect(() => {
        if (picker !== 'SERVICE') return;
        let alive = true;
        setServiceLoading(true);
        setServiceError(false);
        const timer = window.setTimeout(() => { servicesApi.list({ page: servicePage, limit: serviceLimit, search: serviceSearch || undefined }).then((result) => { if (alive) {
            setOfferings(result.data);
            setServiceTotal(result.total);
        } }).catch(() => { if (alive)
            setServiceError(true); }).finally(() => { if (alive)
            setServiceLoading(false); }); }, 200);
        return () => { alive = false; window.clearTimeout(timer); };
    }, [picker, serviceSearch, servicePage, serviceLimit, retry]);
    const update = (index: number, patch: Partial<DraftLine>) => onChange(lines.map((line, i) => i === index ? { ...line, ...patch } : line));
    const addCatalog = (kind: 'PRODUCT' | 'SERVICE', id: string) => {
        const selected = kind === 'PRODUCT' ? products.find((item) => String(item.id) === id) : offerings.find((item) => String(item.id) === id);
        if (!selected)
            return;
        onChange([...lines, { key: newDraftKey(), productId: kind === 'PRODUCT' ? selected.id : null, serviceOfferingId: kind === 'SERVICE' ? selected.id : null, kind, description: selected.name, details: kind === 'SERVICE' ? (selected as ServiceOffering).description : (selected as Product).ingredients || (selected as Product).productType?.description || null, quantity: 1, unitPrice: kind === 'PRODUCT' ? Number((selected as Product).price) : Number((selected as ServiceOffering).referencePrice ?? 0) }]);
        setPicker(null);
    };
    const saveToCatalog = async (line: DraftLine) => {
        setCatalogBusy(line.key);
        setCatalogMessage('');
        try {
            await servicesApi.create({ name: line.description.trim(), description: line.details?.trim() || null, referencePrice: line.unitPrice });
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
    return <div className="min-w-0 space-y-3">
      <div className="flex flex-wrap gap-2">
        {(['PRODUCT', 'SERVICE'] as const).map((kind) => {
          const product = kind === 'PRODUCT';
          const title = t(product ? 'addProduct' : 'addService');
          const loading = product ? productLoading : serviceLoading;
          const failed = product ? productError : serviceError;
          const choices = product ? products.map((item) => ({ id: item.id, name: item.name, description: item.ingredients || item.productType?.description, price: Number(item.price) })) : offerings.map((item) => ({ id: item.id, name: item.name, description: item.description, price: item.referencePrice == null ? null : Number(item.referencePrice) }));
          return <Dialog key={kind} open={picker === kind} onOpenChange={(open) => setPicker(open ? kind : null)}>
            <DialogTrigger asChild><Button type="button" variant="outline" size="sm" disabled={disabled}><Plus aria-hidden="true" className="mr-2 h-4 w-4" />{title}</Button></DialogTrigger>
            <DialogContent className="flex max-h-[85dvh] w-[calc(100vw-2rem)] max-w-3xl flex-col gap-3 p-4 sm:p-6">
              <DialogHeader>
                <DialogTitle>{title}</DialogTitle>
                <DialogDescription className="sr-only">{t(product ? 'searchProducts' : 'searchServices')}</DialogDescription>
              </DialogHeader>
              <Input type="search" aria-label={t(product ? 'searchProducts' : 'searchServices')} placeholder={t(product ? 'searchProducts' : 'searchServices')} value={product ? productSearch : serviceSearch} disabled={disabled} onChange={(event) => { if (product) { setProductSearch(event.target.value); setProductPage(1); } else { setServiceSearch(event.target.value); setServicePage(1); } }} />
              <div className="min-h-0 min-w-0 overflow-y-auto">
                <CatalogTable kind={kind} items={loading || failed ? [] : choices} disabled={disabled || loading || failed} onAdd={(id) => addCatalog(kind, id)} />
                {!failed && loading && <p role="status" className="p-3 text-sm text-muted-foreground">{tCommon('loading')}</p>}
                {!failed && !loading && choices.length === 0 && <p className="p-3 text-sm text-muted-foreground">{tCommon('noResults')}</p>}
                {failed && <div role="alert" className="space-y-2 p-3 text-sm"><p>{t('choicesError')}</p><Button type="button" variant="outline" size="sm" onClick={() => setRetry((value) => value + 1)}>{t('retry')}</Button></div>}
              </div>
              <div className={responsivePagination}><Pagination currentPage={product ? productPage : servicePage} pageSize={product ? productLimit : serviceLimit} totalPages={Math.ceil((product ? productTotal : serviceTotal) / (product ? productLimit : serviceLimit))} hasMore={choices.length === (product ? productLimit : serviceLimit)} onPageChange={product ? setProductPage : setServicePage} onPageSizeChange={(size) => { if (product) { setProductLimit(size); setProductPage(1); } else { setServiceLimit(size); setServicePage(1); } }} isLoading={disabled || loading} /></div>
              <DialogFooter className="gap-2 sm:justify-between">{!product && <Button type="button" variant="ghost" size="sm" className="h-auto min-h-9 max-w-full whitespace-normal" disabled={disabled} onClick={() => { onChange([...lines, { key: newDraftKey(), kind: 'SERVICE', productId: null, serviceOfferingId: null, description: '', details: null, quantity: 1, unitPrice: 0 }]); setPicker(null); }}>{t('addLabor')}</Button>}<DialogClose asChild><Button type="button" variant="outline" size="sm">{tCommon('close')}</Button></DialogClose></DialogFooter>
            </DialogContent>
          </Dialog>;
        })}

      </div>
      {lines.length === 0 && <p className="py-4 text-sm text-muted-foreground">{t('emptyItems')}</p>}
      <div className="divide-y divide-dashed">{lines.map((line, index) => <fieldset disabled={disabled} key={line.key} className="min-w-0 space-y-2 py-3">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-2 sm:grid-cols-[minmax(0,1fr)_5rem_7rem_auto]">
          <div className="col-span-3 min-w-0 sm:col-span-1">
            {line.productId != null || line.serviceOfferingId != null ? <p className="text-sm font-medium [overflow-wrap:anywhere]">{line.description}</p> : <><Label className="text-xs" htmlFor={`name-${line.key}`}>{t('lineName')}</Label><Input className="h-8" id={`name-${line.key}`} value={line.description} onChange={(event) => update(index, { description: event.target.value })} required /></>}
            <p className="mt-1 text-xs text-muted-foreground">{t('total')}: {formatCurrencyBRL(line.unitPrice * line.quantity, i18n.language)}</p>
          </div>
          <div className="min-w-0">
            <Label className="text-xs" htmlFor={`qty-${line.key}`}>{t('quantity')}</Label>
            <Input className="h-8" id={`qty-${line.key}`} type="number" min="1" step="1" value={line.quantity} onChange={(event) => update(index, { quantity: Number(event.target.value) })} />
          </div>
          <div className="min-w-0">
            <Label className="text-xs" htmlFor={`price-${line.key}`}>{t('unitPrice')}</Label>
            <Input className="h-8" id={`price-${line.key}`} type="text" inputMode="decimal" disabled={line.kind === 'PRODUCT' || disabled} value={line.unitPrice.toFixed(2).replace('.', i18n.language === 'pt-BR' ? ',' : '.')} onChange={(event) => update(index, { unitPrice: Number(maskCentsInput(event.target.value)) })} />
          </div>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" title={t('remove')} aria-label={`${t('remove')} ${line.description}`} onClick={() => onChange(lines.filter((item) => item.key !== line.key))}><Trash2 aria-hidden="true" className="h-4 w-4" /></Button>
        </div>
        <details className="min-w-0">
          <summary className="cursor-pointer text-xs text-muted-foreground [overflow-wrap:anywhere]"><span>{t('lineDetails')}</span>{line.details && <span className="ml-2">· {line.details.slice(0, 70).replace(/\s+/g, ' ')}{line.details.length > 70 ? '…' : ''}</span>}</summary>
          <div className="mt-2 min-w-0 space-y-2">
            <Label className="sr-only" htmlFor={`details-${line.key}`}>{t('lineDetails')}</Label>
            <textarea id={`details-${line.key}`} rows={3} className="block w-full min-w-0 resize-y rounded-md border bg-background p-2 text-sm" value={line.details ?? ''} onChange={(event) => update(index, { details: event.target.value })} />
            {user?.role === 'OWNER' && line.productId == null && line.serviceOfferingId == null && <Button type="button" variant="outline" size="sm" className="h-auto min-h-8 max-w-full whitespace-normal" disabled={disabled || catalogBusy != null || !line.description.trim()} onClick={() => void saveToCatalog(line)}>{t('saveToCatalog')}</Button>}
          </div>
        </details>
      </fieldset>)}</div>
      {catalogMessage && <p role="status" className="text-sm">{catalogMessage}</p>}
    </div>;
}
