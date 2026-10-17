import { i18n } from '@/i18n/config';
import { dialogClosed } from '@/test/dashboard';
import { testApi as api,catalogServiceApi,replaceProperty,TestProvider } from '@/test/service-orders-support';
import { render,screen,waitFor,within } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { createSignal } from 'solid-js';
import { afterEach,beforeEach,expect,it,vi } from 'vitest';
import ServiceQuoteEditor,{ type DraftLine } from './ServiceQuoteEditor';
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: () => ({ role: 'OWNER' }) }) }));
const list = vi.fn(), get = vi.fn(), create = vi.fn();
let restore: Array<() => void>;
function Editor() { const [lines, setLines] = createSignal<DraftLine[]>([]); return <ServiceQuoteEditor lines={lines()} onChange={setLines} disabled={false}/>; }
beforeEach(async () => {
    await i18n.changeLanguage('en');
    restore = [replaceProperty(catalogServiceApi, 'list', list as typeof catalogServiceApi.list), replaceProperty(api, 'get', get as typeof api.get), replaceProperty(catalogServiceApi, 'create', create as typeof catalogServiceApi.create)];
    list.mockReset().mockResolvedValue({ data: Array.from({ length: 10 }, (_, i) => ({ id: `s${i}`, name: `Service ${i}`, description: 'Detailed scope', referencePriceCents: 1245 })), total: 20 });
    get.mockReset().mockResolvedValue({ data: { data: Array.from({ length: 10 }, (_, i) => ({ id: `p${i}`, name: `Product ${i}`, ingredients: 'Replacement filter cartridge', priceCents: 2490 })), total: 30 }, headers: {} });
    create.mockReset().mockResolvedValue({ id: 'saved' });
});
afterEach(() => restore.forEach(fn => fn()));
async function openPicker(user: ReturnType<typeof userEvent.setup>, kind: 'product' | 'service') {
    if (!screen.queryByRole('dialog')) await dialogClosed();
    await user.click(screen.getByRole('button', { name: kind === 'product' ? 'Add product' : 'Add service' }));
    return screen.getByRole('dialog');
}
async function addLabor(user: ReturnType<typeof userEvent.setup>) {
    const dialog = await openPicker(user, 'service');
    await user.click(within(dialog).getByRole('button', { name: 'Add one-off labor' }));
}
async function expandDetails(user: ReturnType<typeof userEvent.setup>, field: HTMLElement) {
    const details = field.closest('details')!;
    if (!details.hasAttribute('open')) await user.click(details.querySelector('summary')!);
}
async function addChoice(user: ReturnType<typeof userEvent.setup>, kind: 'product' | 'service', name: string) {
    const dialog = await openPicker(user, kind);
    await user.click(await within(dialog).findByRole('button', { name: `Add ${kind} ${name}` }));
}
it('searches and pages in the service modal and carries full details into the quote', async () => {
    render(() => <TestProvider><Editor /></TestProvider>);
    const user = userEvent.setup();
    const dialog = await openPicker(user, 'service');
    await within(dialog).findByRole('button', { name: 'Add service Service 0' });
    await user.click(within(dialog).getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: 'next', limit: 10 }), expect.any(AbortSignal)));
    await user.type(within(dialog).getByLabelText('Search catalog services'), 'Long scope');
    await waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: undefined, search: 'Long scope' }), expect.any(AbortSignal)));
    await user.click(await within(dialog).findByRole('button', { name: 'Add service Service 0' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Full description')).toHaveValue('Detailed scope');
    expect(screen.getByLabelText('Unit price')).toHaveValue('12.45');
});
it('keeps custom labor usable when catalog reads fail and preserves it after retry', async () => {
    list.mockRejectedValue(new Error('offline'));
    render(() => <TestProvider><Editor /></TestProvider>);
    const user = userEvent.setup();
    await addLabor(user);
    await user.type(screen.getByLabelText('Item name'), 'Custom labor');
    await expandDetails(user, screen.getByLabelText('Full description'));
    await user.type(screen.getByLabelText('Full description'), 'Detailed instructions');
    await user.clear(screen.getByLabelText('Unit price'));
    await user.type(screen.getByLabelText('Unit price'), '1245');
    const dialog = await openPicker(user, 'service');
    await within(dialog).findByRole('alert');
    list.mockResolvedValue({data:[{id:'s0',name:'Service 0',description:'Detailed scope',referencePriceCents:1245}],total:1});
    await user.click(within(dialog).getByRole('button', { name: 'Retry' }));
    await within(dialog).findByRole('button', { name: 'Add service Service 0' });
    await user.keyboard('{Escape}'); await dialogClosed();
    expect(screen.getByLabelText('Item name')).toHaveValue('Custom labor');
    await user.click(screen.getByRole('button', { name: 'Save labor to catalog' }));
    await waitFor(() => expect(create).toHaveBeenCalledWith({ name: 'Custom labor', description: 'Detailed instructions', referencePriceCents: 1245 }));
    expect(await screen.findByText('Saved to catalog')).toBeInTheDocument();
});
it('shows product descriptions and prices in the modal and adds their snapshot', async () => {
    render(() => <TestProvider><Editor /></TestProvider>);
    const user = userEvent.setup();
    expect(get).not.toHaveBeenCalled();
    const dialog = await openPicker(user, 'product');
    const button = await within(dialog).findByRole('button', { name: 'Add product Product 0' });
    const row = button.closest('tr')!;
    expect(within(dialog).getByRole('table', { name: 'Product' })).toBeInTheDocument();
    expect(within(row).getByText('Replacement filter cartridge')).toBeInTheDocument();
    expect(within(row).getByText('R$24.90')).toBeInTheDocument();
    await user.click(button);
    expect(screen.getByLabelText('Full description')).toHaveValue('Replacement filter cartridge');
    expect(screen.getByLabelText('Unit price')).toHaveValue('24.90');
    expect(screen.getByLabelText('Unit price')).toBeDisabled();
});
it('keeps modal searches and pages independent across closing and reopening', async () => {
    render(() => <TestProvider><Editor /></TestProvider>);
    const user = userEvent.setup();
    let dialog = await openPicker(user, 'product');
    await within(dialog).findByRole('button', { name: 'Add product Product 0' });
    await user.click(within(dialog).getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(get).toHaveBeenLastCalledWith('/v1/products', expect.objectContaining({cursor:'next',limit:10,search:''}),expect.any(AbortSignal)));
    await user.type(within(dialog).getByLabelText('Search products'), 'filter');
    await waitFor(() => expect(get).toHaveBeenLastCalledWith('/v1/products', expect.objectContaining({cursor:undefined,limit:10,search:'filter'}),expect.any(AbortSignal)));
    await user.keyboard('{Escape}'); await dialogClosed();
    dialog = await openPicker(user, 'service');
    await within(dialog).findByRole('button', { name: 'Add service Service 0' });
    await user.click(within(dialog).getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: 'next' }), expect.any(AbortSignal)));
    await user.type(within(dialog).getByLabelText('Search catalog services'), 'scope');
    await waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: undefined, search: 'scope' }), expect.any(AbortSignal)));
    await user.keyboard('{Escape}'); await dialogClosed();
    dialog = await openPicker(user, 'product');
    expect(within(dialog).getByLabelText('Search products')).toHaveValue('filter');
    await within(dialog).findByRole('button', { name: 'Add product Product 0' });
    expect(within(dialog).getByText('Page 1 of 3')).toBeInTheDocument();
    await user.keyboard('{Escape}'); await dialogClosed();
    dialog = await openPicker(user, 'service');
    expect(within(dialog).getByLabelText('Search catalog services')).toHaveValue('scope');
});
it('disables adding items while saving and does not load hidden catalogs', () => {
    render(() => <TestProvider><ServiceQuoteEditor lines={[]} onChange={() => {}} disabled /></TestProvider>);
    expect(screen.getByRole('button', { name: 'Add product' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Add service' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Add one-off labor' })).not.toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
    expect(list).not.toHaveBeenCalled();
});
it('distinguishes empty search results from a catalog failure in both modals', async () => {
    list.mockResolvedValue({ data: [], total: 0 });
    get.mockResolvedValue({ data: { items: [], total: 0 }, headers: {} });
    render(() => <TestProvider><Editor /></TestProvider>);
    const user = userEvent.setup();
    for (const kind of ['product', 'service'] as const) {
      const dialog = await openPicker(user, kind);
      expect(await within(dialog).findByText('No results found.')).toBeInTheDocument();
      expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
      await user.keyboard('{Escape}'); await dialogClosed();
    }
});
it('shows services without a reference price and lets the quote set their price', async () => {
    list.mockResolvedValue({ items: [{ id: 'flexible', name: 'Inspection', description: null, referencePriceCents: null }], total: 1 });
    render(() => <TestProvider><Editor /></TestProvider>);
    const user = userEvent.setup();
    const dialog = await openPicker(user, 'service');
    const add = await within(dialog).findByRole('button', { name: 'Add service Inspection' });
    expect(within(add.closest('tr')!).getByText('Set price when quoting')).toBeInTheDocument();
    await user.click(add);
    expect(screen.getByLabelText('Unit price')).toHaveValue('0.00');
    expect(screen.getByLabelText('Unit price')).toBeEnabled();
});
it('adds all line types without secure-context randomUUID and keeps repeated rows independent', async () => {
    restore.push(replaceProperty(crypto, 'randomUUID', undefined as unknown as typeof crypto.randomUUID));
    render(() => <TestProvider><Editor /></TestProvider>);
    const user = userEvent.setup();
    await addChoice(user, 'product', 'Product 0');
    await addChoice(user, 'service', 'Service 0');
    await addChoice(user, 'service', 'Service 0');
    await addLabor(user);
    const fields = screen.getAllByLabelText('Full description');
    expect(fields).toHaveLength(4);
    await expandDetails(user, fields[2]);
    await user.clear(fields[2]);
    await user.type(fields[2], 'Second service instructions');
    await user.click(screen.getAllByRole('button', { name: 'Remove Service 0' })[0]);
    expect(screen.getAllByLabelText('Full description').map(field => (field as HTMLTextAreaElement).value)).toEqual(['Replacement filter cartridge', 'Second service instructions', '']);
    await user.type(screen.getByLabelText('Item name'), 'Emergency repair');
    expect(screen.getByLabelText('Item name')).toHaveValue('Emergency repair');
});
it('keeps catalog tables inside selection dialogs and closes after adding an item', async () => {
    render(() => <TestProvider><Editor /></TestProvider>);
    expect(screen.queryByRole('table', { name: 'Product' })).not.toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'Service' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add one-off labor' })).not.toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add product' }));
    const dialog = screen.getByRole('dialog', { name: 'Add product' });
    await user.click(await within(dialog).findByRole('button', { name: 'Add product Product 0' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('Product 0')).toBeInTheDocument(); await dialogClosed();
    await user.click(screen.getByRole('button', { name: 'Add service' }));
    await user.click(await within(screen.getByRole('dialog', { name: 'Add service' })).findByRole('button', { name: 'Add service Service 0' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('Service 0')).toBeInTheDocument();
});
