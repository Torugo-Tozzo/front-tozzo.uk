import { useState } from 'react';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'bun:test';
import { I18nProvider } from '@/i18n/provider';
import { i18n } from '@/i18n/config';
import api, { servicesApi } from '@/services/api';
import { replaceProperty } from '@/test/replace-property';
import ServiceQuoteEditor, { type DraftLine } from './ServiceQuoteEditor';
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { role: 'OWNER' } }) }));
const list = vi.fn(), get = vi.fn(), create = vi.fn();
let restore: Array<() => void>;
function Editor() { const [lines, setLines] = useState<DraftLine[]>([]); return <ServiceQuoteEditor lines={lines} onChange={setLines} disabled={false}/>; }
beforeEach(async () => {
    await act(async () => { await i18n.changeLanguage('en'); });
    restore = [replaceProperty(servicesApi, 'list', list as typeof servicesApi.list), replaceProperty(api, 'get', get as typeof api.get), replaceProperty(servicesApi, 'create', create as typeof servicesApi.create)];
    list.mockReset().mockResolvedValue({ data: Array.from({ length: 10 }, (_, i) => ({ id: `s${i}`, name: `Service ${i}`, description: 'Detailed scope', referencePrice: 12.45 })), total: 20 });
    get.mockReset().mockResolvedValue({ data: { data: Array.from({ length: 10 }, (_, i) => ({ id: `p${i}`, name: `Product ${i}`, ingredients: 'Replacement filter cartridge', price: 24.90 })), total: 30 }, headers: {} });
    create.mockReset().mockResolvedValue({ id: 'saved' });
});
afterEach(() => restore.forEach(fn => fn()));
async function openPicker(user: ReturnType<typeof userEvent.setup>, kind: 'product' | 'service') {
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
    render(<I18nProvider><Editor /></I18nProvider>);
    const user = userEvent.setup();
    const dialog = await openPicker(user, 'service');
    await within(dialog).findByRole('button', { name: 'Add service Service 0' });
    await user.click(within(dialog).getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, limit: 10 })));
    await user.type(within(dialog).getByLabelText('Search catalog services'), 'Long scope');
    await waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, search: 'Long scope' })));
    await user.click(await within(dialog).findByRole('button', { name: 'Add service Service 0' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Full description')).toHaveValue('Detailed scope');
    expect(screen.getByLabelText('Unit price')).toHaveValue('12.45');
});
it('keeps custom labor usable when catalog reads fail and preserves it after retry', async () => {
    list.mockRejectedValueOnce(new Error('offline'));
    render(<I18nProvider><Editor /></I18nProvider>);
    const user = userEvent.setup();
    await addLabor(user);
    await user.type(screen.getByLabelText('Item name'), 'Custom labor');
    await expandDetails(user, screen.getByLabelText('Full description'));
    await user.type(screen.getByLabelText('Full description'), 'Detailed instructions');
    await user.clear(screen.getByLabelText('Unit price'));
    await user.type(screen.getByLabelText('Unit price'), '1245');
    const dialog = await openPicker(user, 'service');
    await within(dialog).findByRole('alert');
    await user.click(within(dialog).getByRole('button', { name: 'Retry' }));
    await within(dialog).findByRole('button', { name: 'Add service Service 0' });
    await user.keyboard('{Escape}');
    expect(screen.getByLabelText('Item name')).toHaveValue('Custom labor');
    await user.click(screen.getByRole('button', { name: 'Save labor to catalog' }));
    await waitFor(() => expect(create).toHaveBeenCalledWith({ name: 'Custom labor', description: 'Detailed instructions', referencePrice: 12.45 }));
    expect(await screen.findByText('Saved to catalog')).toBeInTheDocument();
});
it('shows product descriptions and prices in the modal and adds their snapshot', async () => {
    render(<I18nProvider><Editor /></I18nProvider>);
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
    render(<I18nProvider><Editor /></I18nProvider>);
    const user = userEvent.setup();
    let dialog = await openPicker(user, 'product');
    await within(dialog).findByRole('button', { name: 'Add product Product 0' });
    await user.click(within(dialog).getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(get).toHaveBeenLastCalledWith('/produtos', { params: { page: 2, limit: 10, search: '' } }));
    await user.type(within(dialog).getByLabelText('Search products'), 'filter');
    await waitFor(() => expect(get).toHaveBeenLastCalledWith('/produtos', { params: { page: 1, limit: 10, search: 'filter' } }));
    await user.keyboard('{Escape}');
    dialog = await openPicker(user, 'service');
    await within(dialog).findByRole('button', { name: 'Add service Service 0' });
    await user.click(within(dialog).getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })));
    await user.type(within(dialog).getByLabelText('Search catalog services'), 'scope');
    await waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, search: 'scope' })));
    await user.keyboard('{Escape}');
    dialog = await openPicker(user, 'product');
    expect(within(dialog).getByLabelText('Search products')).toHaveValue('filter');
    await within(dialog).findByRole('button', { name: 'Add product Product 0' });
    expect(within(dialog).getByText('Page 1 of 3')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    dialog = await openPicker(user, 'service');
    expect(within(dialog).getByLabelText('Search catalog services')).toHaveValue('scope');
});
it('disables adding items while saving and does not load hidden catalogs', () => {
    render(<I18nProvider><ServiceQuoteEditor lines={[]} onChange={() => {}} disabled /></I18nProvider>);
    expect(screen.getByRole('button', { name: 'Add product' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Add service' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Add one-off labor' })).not.toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
    expect(list).not.toHaveBeenCalled();
});
it('distinguishes empty search results from a catalog failure in both modals', async () => {
    list.mockResolvedValue({ data: [], total: 0 });
    get.mockResolvedValue({ data: { data: [], total: 0 }, headers: {} });
    render(<I18nProvider><Editor /></I18nProvider>);
    const user = userEvent.setup();
    for (const kind of ['product', 'service'] as const) {
      const dialog = await openPicker(user, kind);
      expect(await within(dialog).findByText('No results found.')).toBeInTheDocument();
      expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
      await user.keyboard('{Escape}');
    }
});
it('shows services without a reference price and lets the quote set their price', async () => {
    list.mockResolvedValue({ data: [{ id: 'flexible', name: 'Inspection', description: null, referencePrice: null }], total: 1 });
    render(<I18nProvider><Editor /></I18nProvider>);
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
    render(<I18nProvider><Editor /></I18nProvider>);
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
    render(<I18nProvider><Editor /></I18nProvider>);
    expect(screen.queryByRole('table', { name: 'Product' })).not.toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'Service' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add one-off labor' })).not.toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add product' }));
    const dialog = screen.getByRole('dialog', { name: 'Add product' });
    await user.click(await within(dialog).findByRole('button', { name: 'Add product Product 0' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('Product 0')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add service' }));
    await user.click(await within(screen.getByRole('dialog', { name: 'Add service' })).findByRole('button', { name: 'Add service Service 0' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('Service 0')).toBeInTheDocument();
});
