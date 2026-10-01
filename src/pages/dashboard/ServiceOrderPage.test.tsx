import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'bun:test';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ConfirmProvider } from '@/contexts/ConfirmContext';
import { I18nProvider } from '@/i18n/provider';
import { i18n } from '@/i18n/config';
import { servicesApi } from '@/services/api';
import api from '@/services/api';
import { replaceProperty } from '@/test/replace-property';
import type { ServiceOrder } from '@/domain/services';
let onRealtime: () => void = () => { };
vi.mock('@/hooks/useRealtimeEvents', () => ({ useRealtimeEvents: (_events: unknown, callback: () => void) => { onRealtime = callback; } }));
import ServiceOrderPage from './ServiceOrderPage';
const order: ServiceOrder = { id: 'o1', establishmentId: 'e1', customerName: 'Ana', description: 'Bike repair', status: 'APROVADA', dueAt: null, responsibleId: null, completedAt: null, updatedAt: '2026-09-30T10:00:00.000Z', items: [{ id: 'i1', productId: null, serviceOfferingId: 's1', description: 'Tune-up', details: 'Historical full description', kind: 'SERVICE', quantity: 1, unitPrice: 80 }], events: [{ id: 'ev1', fromStatus: 'ORCADA', toStatus: 'APROVADA', action: 'APROVAR', createdAt: '2026-09-30T10:00:00Z', userId: 'u1' }] };
const mocks = { getOrder: vi.fn(), updateOrder: vi.fn(), action: vi.fn(), replaceQuote: vi.fn(), replaceSupplements: vi.fn(), approveSupplements: vi.fn(), list: vi.fn(), get: vi.fn() };
let restore: Array<() => void> = [];
function renderPage(mode: 'quote' | 'execution' = 'execution') {
    return render(<I18nProvider>
      <ConfirmProvider>
        <MemoryRouter initialEntries={['/dashboard/estimates/o1']}>
          <Routes>
            <Route path="/dashboard/estimates/:id" element={<ServiceOrderPage mode={mode}/>}/>
            <Route path="/dashboard/service-orders/:id" element={<p>Execution destination</p>}/>
          </Routes>
        </MemoryRouter>
      </ConfirmProvider>
    </I18nProvider>);
}
describe('ServiceOrderPage', () => {
    beforeEach(async () => { restore = [replaceProperty(servicesApi, 'list', mocks.list as typeof servicesApi.list), replaceProperty(servicesApi, 'getOrder', mocks.getOrder as typeof servicesApi.getOrder), replaceProperty(servicesApi, 'updateOrder', mocks.updateOrder as typeof servicesApi.updateOrder), replaceProperty(servicesApi, 'action', mocks.action as typeof servicesApi.action), replaceProperty(servicesApi, 'replaceQuote', mocks.replaceQuote as typeof servicesApi.replaceQuote), replaceProperty(servicesApi, 'replaceSupplements', mocks.replaceSupplements as typeof servicesApi.replaceSupplements), replaceProperty(servicesApi, 'approveSupplements', mocks.approveSupplements as typeof servicesApi.approveSupplements), replaceProperty(api, 'get', mocks.get as typeof api.get)]; await act(async () => { await i18n.changeLanguage('en'); }); mocks.list.mockReset().mockResolvedValue({ data: [], total: 0 }); mocks.getOrder.mockReset().mockResolvedValue(order); mocks.updateOrder.mockReset().mockResolvedValue(order); mocks.action.mockReset().mockResolvedValue({ order: { ...order, status: 'EM_EXECUCAO' }, retried: false }); mocks.replaceQuote.mockReset().mockResolvedValue({ ...order, status: 'ORCADA' }); mocks.replaceSupplements.mockReset().mockResolvedValue(order); mocks.approveSupplements.mockReset().mockResolvedValue(order); mocks.get.mockReset().mockResolvedValue({ data: { data: [], total: 0 }, headers: {} }); });
    afterEach(() => restore.forEach((fn) => fn()));
    it('shows mixed quote lines, history and only the approved-state action', async () => { const user = userEvent.setup(); renderPage(); expect((await screen.findAllByText('Tune-up')).length).toBeGreaterThan(0); expect(screen.getByText('APROVAR · Approved')).toBeInTheDocument(); expect(screen.getByRole('button', { name: 'Start work' })).toBeInTheDocument(); expect(screen.queryByRole('button', { name: 'Close order and record sale' })).not.toBeInTheDocument(); await user.click(screen.getByRole('button', { name: 'Start work' })); await waitFor(() => expect(mocks.action).toHaveBeenCalledWith('o1', 'iniciar', order.updatedAt)); await waitFor(() => expect(screen.queryByRole('button', {name:'Start work'})).not.toBeInTheDocument()); expect(screen.getByRole('button', {name:'Close order and record sale'})).toBeInTheDocument(); });
    it('reads accepted history independently of failed catalogs and excludes execution actions', async () => {
        mocks.get.mockRejectedValue(new Error('catalog offline'));
        mocks.getOrder.mockResolvedValue({ ...order, acceptedQuote: order.items, items: [{ ...order.items[0], description: 'Extra item', isSupplement: true }] });
        renderPage('quote');
        expect((await screen.findAllByText('Tune-up')).length).toBeGreaterThan(0);
        expect(screen.getByText('Historical full description')).toBeInTheDocument();
        expect(screen.queryByText('Extra item')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Start work' })).not.toBeInTheDocument();
        expect(mocks.get).not.toHaveBeenCalled();
    });
    it('blocks approval while quote lines have unsaved changes and preserves them after failed save', async () => {
        const user = userEvent.setup();
        mocks.getOrder.mockResolvedValue({ ...order, status: 'ORCADA', acceptedQuote: null });
        mocks.replaceQuote.mockRejectedValueOnce({ response: { status: 409 } });
        renderPage('quote');
        await screen.findByText('Tune-up');
        const price = screen.getByLabelText('Unit price');
        await user.clear(price);
        await user.type(price, '1245');
        expect(screen.getByRole('button', { name: 'Approve estimate' })).toBeDisabled();
        await user.click(screen.getByRole('button', { name: 'Save estimate' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('This order changed elsewhere');
        expect(price).toHaveValue('12.45');
    });
    it('edits one-off labor and submits descriptions and a masked price', async () => {
        const user = userEvent.setup();
        mocks.getOrder.mockResolvedValue({ ...order, status: 'ABERTA', items: [], acceptedQuote: null });
        renderPage('quote');
        await screen.findByText('Add at least one product or service.');
        await user.click(screen.getByRole('button', { name: 'Add service' }));
        await user.click(screen.getByRole('button', { name: 'Add one-off labor' }));
        await user.type(screen.getByLabelText('Item name'), 'Custom repair');
        await user.type(screen.getByLabelText('Full description'), 'Full repair instructions');
        await user.clear(screen.getByLabelText('Unit price'));
        await user.type(screen.getByLabelText('Unit price'), '1245');
        await user.click(screen.getByRole('button', { name: 'Save estimate' }));
        await waitFor(() => expect(mocks.replaceQuote).toHaveBeenCalledWith('o1', order.updatedAt, [{ description: 'Custom repair', details: 'Full repair instructions', quantity: 1, unitPrice: 12.45 }]));
    });
    it('keeps a newly edited draft when an earlier realtime refresh resolves', async () => {
        mocks.getOrder.mockResolvedValue({ ...order, status: 'ORCADA', acceptedQuote: null });
        renderPage('quote');
        await screen.findByText('Tune-up');
        let resolveRefresh: (data: ServiceOrder) => void = () => { };
        mocks.getOrder.mockImplementationOnce(() => new Promise<ServiceOrder>((resolve) => { resolveRefresh = resolve; }));
        act(() => onRealtime());
        const user = userEvent.setup();
        const price = screen.getByLabelText('Unit price');
        await user.clear(price);
        await user.type(price, '1245');
        await act(async () => resolveRefresh({ ...order, status: 'ORCADA', acceptedQuote: null }));
        expect(price).toHaveValue('12.45');
        expect(screen.getByRole('button', { name: 'Approve estimate' })).toBeDisabled();
    });
    it('navigates approval into execution and retains original accepted details', async () => {
        mocks.getOrder.mockResolvedValue({ ...order, status: 'ORCADA', acceptedQuote: null });
        mocks.action.mockResolvedValue({ order: { ...order, acceptedQuote: order.items } });
        renderPage('quote');
        await screen.findByText('Tune-up');
        const user = userEvent.setup();
        await user.click(screen.getByRole('button', { name: 'Approve estimate' }));
        expect(await screen.findByText('Execution destination')).toBeInTheDocument();
    });
    it('preserves supplemental drafts after failures and uses Portuguese decimal comma', async () => {
        await act(async () => { await i18n.changeLanguage('pt-BR'); });
        mocks.getOrder.mockResolvedValue({ ...order, acceptedQuote: order.items });
        mocks.replaceSupplements.mockRejectedValueOnce({ response: { status: 409 } });
        renderPage();
        await screen.findAllByText('Tune-up');
        const user = userEvent.setup();
        await user.click(screen.getByRole('button', { name: 'Editar serviços adicionais' }));
        await user.click(screen.getByRole('button', { name: 'Adicionar serviço' }));
        await user.click(screen.getByRole('button', { name: 'Adicionar mão de obra avulsa' }));
        await user.type(screen.getByLabelText('Nome do item'), 'Extra labor');
        await user.clear(screen.getByLabelText('Preço unitário'));
        await user.type(screen.getByLabelText('Preço unitário'), '1245');
        expect(screen.getByLabelText('Preço unitário')).toHaveValue('12,45');
        await user.click(screen.getByRole('button', { name: 'Solicitar aprovação do cliente' }));
        expect(await screen.findByRole('alert')).toBeInTheDocument();
        expect(screen.getByLabelText('Nome do item')).toHaveValue('Extra labor');
        expect(screen.getByLabelText('Preço unitário')).toHaveValue('12,45');
    });
    it('does not allow supplements after a linked historical sale', async () => {
        mocks.getOrder.mockResolvedValue({ ...order, acceptedQuote: order.items, sale: { id: 'sale1', total: 80, isCancelled: true } });
        renderPage();
        await screen.findAllByText('Tune-up');
        expect(screen.queryByRole('button', { name: 'Edit additional work' })).not.toBeInTheDocument();
    });
    it('blocks closing while additions await explicit client approval', async () => {
        mocks.getOrder.mockResolvedValue({ ...order, status: 'EM_EXECUCAO', acceptedQuote: order.items, pendingItems: [{ ...order.items[0], description: 'Pending extra' }] });
        renderPage();
        await screen.findByText('Pending extra');
        expect(screen.getByRole('button', { name: 'Close order and record sale' })).toBeDisabled();
        const user = userEvent.setup();
        await user.click(screen.getByRole('button', { name: 'Confirm client approval' }));
        await waitFor(() => expect(mocks.approveSupplements).toHaveBeenCalledWith('o1', order.updatedAt));
    });
    it('keeps the edited draft visible and reports a 409 conflict', async () => { const user = userEvent.setup(); mocks.updateOrder.mockRejectedValueOnce({ response: { status: 409 } }); renderPage(); await screen.findAllByText('Tune-up'); const field = screen.getByLabelText('Work description'); await user.clear(field); await user.type(field, 'Revised repair'); await user.click(screen.getByRole('button', { name: 'Save details' })); expect(await screen.findByRole('alert')).toHaveTextContent('This order changed elsewhere. Reload it and try again.'); expect(field).toHaveValue('Revised repair'); });
    it('keeps open details editable and shows actions only for actual changes', async () => {
        const user = userEvent.setup();
        mocks.getOrder.mockResolvedValue({ ...order, status: 'ORCADA', acceptedQuote: null });
        renderPage('quote');
        const name = await screen.findByLabelText('Customer name');
        expect(name).toBeEnabled();
        expect(screen.getByLabelText('Work description')).toBeEnabled();
        expect(screen.queryByRole('button', { name: 'Edit details' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Save details' })).not.toBeInTheDocument();
        await user.clear(name);
        await user.type(name, 'Anna');
        expect(screen.getByRole('button', { name: 'Save details' })).toBeEnabled();
        expect(screen.getByRole('button', { name: 'Approve estimate' })).toBeDisabled();
        await user.clear(name);
        await user.type(name, 'Ana');
        expect(screen.queryByRole('button', { name: 'Save details' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Approve estimate' })).toBeEnabled();
    });
    it('cancels only changed details and preserves unsaved quote lines', async () => {
        const user = userEvent.setup();
        mocks.getOrder.mockResolvedValue({ ...order, status: 'ORCADA', acceptedQuote: null });
        renderPage('quote');
        const name = await screen.findByLabelText('Customer name');
        await user.clear(screen.getByLabelText('Unit price'));
        await user.type(screen.getByLabelText('Unit price'), '1245');
        await user.type(name, ' changed');
        await user.click(screen.getByRole('button', { name: 'Cancel editing' }));
        expect(name).toHaveValue('Ana');
        expect(screen.getByLabelText('Unit price')).toHaveValue('12.45');
        expect(screen.queryByRole('button', { name: 'Save details' })).not.toBeInTheDocument();
    });
    it('protects unsaved details from a previously started realtime refresh', async () => {
        renderPage();
        const name = await screen.findByLabelText('Customer name');
        let resolveRefresh: (data: ServiceOrder) => void = () => {};
        mocks.getOrder.mockImplementationOnce(() => new Promise<ServiceOrder>(resolve => { resolveRefresh = resolve; }));
        act(() => onRealtime());
        const user = userEvent.setup();
        await user.type(name, ' edited');
        await act(async () => resolveRefresh(order));
        expect(name).toHaveValue('Ana edited');
        expect(screen.getByRole('button', { name: 'Save details' })).toBeEnabled();
    });

    it('saves details with the current revision while retaining unsaved quote lines', async () => {
        const user = userEvent.setup();
        const quote = { ...order, status: 'ORCADA' as const, acceptedQuote: null };
        mocks.getOrder.mockResolvedValue(quote);
        mocks.updateOrder.mockResolvedValue({ ...quote, customerName: 'Ana updated', updatedAt: '2026-10-01T12:00:00Z' });
        renderPage('quote');
        const name = await screen.findByLabelText('Customer name');
        const price = screen.getByLabelText('Unit price');
        await user.clear(price);
        await user.type(price, '1245');
        await user.type(name, ' updated');
        await user.click(screen.getByRole('button', { name: 'Save details' }));
        await waitFor(() => expect(screen.queryByRole('button', { name: 'Save details' })).not.toBeInTheDocument());
        expect(price).toHaveValue('12.45');
        await user.click(screen.getByRole('button', { name: 'Save estimate' }));
        await waitFor(() => expect(mocks.replaceQuote).toHaveBeenCalledWith('o1', '2026-10-01T12:00:00Z', expect.arrayContaining([expect.objectContaining({unitPrice: 12.45})])));
    });
    it('keeps completed execution details read-only', async () => {
        mocks.getOrder.mockResolvedValue({ ...order, status: 'CONCLUIDA', acceptedQuote: order.items });
        renderPage();
        expect(await screen.findByLabelText('Customer name')).toBeDisabled();
        expect(screen.getByLabelText('Work description')).toBeDisabled();
        expect(screen.queryByRole('button', { name: 'Save details' })).not.toBeInTheDocument();
    });

});
