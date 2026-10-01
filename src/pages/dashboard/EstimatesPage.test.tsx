import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'bun:test';
import { ConfirmProvider } from '@/contexts/ConfirmContext';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '@/i18n/provider';
import { i18n } from '@/i18n/config';
import type { ServiceOrder } from '@/domain/services';
import { servicesApi } from '@/services/api';
import { replaceProperty } from '@/test/replace-property';
vi.mock('@/hooks/useRealtimeEvents', () => ({ useRealtimeEvents: () => { } }));
import EstimatesPage from './EstimatesPage';
const mocks = { listOrders: vi.fn(), createOrder: vi.fn() };
let restore: Array<() => void> = [];
const item: ServiceOrder = { id: 'o1', establishmentId: 'e1', customerName: 'Ana', description: 'Bike repair', status: 'ORCADA', dueAt: '2026-10-02T00:00:00Z', responsibleId: null, completedAt: null, updatedAt: '2026-09-30T10:00:00Z', items: [{ productId: null, serviceOfferingId: 's1', description: 'Tune-up', quantity: 1, unitPrice: 80 }], events: [] };
function renderPage() {
    return render(<I18nProvider>
      <ConfirmProvider>
        <MemoryRouter>
          <EstimatesPage />
        </MemoryRouter>
      </ConfirmProvider>
    </I18nProvider>);
}
describe('EstimatesPage', () => {
    beforeEach(async () => { restore = [replaceProperty(servicesApi, 'listOrders', mocks.listOrders as typeof servicesApi.listOrders), replaceProperty(servicesApi, 'createOrder', mocks.createOrder as typeof servicesApi.createOrder)]; await act(async () => { await i18n.changeLanguage('en'); }); mocks.listOrders.mockReset().mockResolvedValue({ data: [item], total: 1 }); mocks.createOrder.mockReset().mockResolvedValue({ ...item, id: 'o2', status: 'ABERTA' }); });
    afterEach(() => restore.forEach((fn) => fn()));
    it('lists orders and sends the selected status and due date filters', async () => {
        const user = userEvent.setup();
        renderPage();
        expect(await screen.findByRole('link', { name: 'Ana' })).toHaveAttribute('href', '/dashboard/estimates/o1');
        await user.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'ORCADA');
        await waitFor(() => expect(mocks.listOrders).toHaveBeenLastCalledWith(expect.objectContaining({ stage: 'estimates', status: 'ORCADA' })));
        fireEvent.change(screen.getByLabelText('Due date'), { target: { value: '2026-10-03' } });
        await waitFor(() => expect(mocks.listOrders).toHaveBeenLastCalledWith(expect.objectContaining({ dueBefore: '2026-10-03' })));
    });
    it('shows visible filter labels and clears the due-date filter without changing the stage', async () => {
        renderPage();
        await screen.findByRole('link', { name: 'Ana' });
        const dueDate = screen.getByLabelText('Due date') as HTMLInputElement;
        const status = screen.getByRole('combobox', { name: 'Status' }) as HTMLSelectElement;
        expect(dueDate.labels?.length).toBe(1);
        expect(dueDate.labels?.[0]).toHaveTextContent('Due date');
        expect(status.labels?.[0]).toHaveTextContent('Status');
        fireEvent.change(dueDate, { target: { value: '2026-10-03' } });
        await waitFor(() => expect(mocks.listOrders).toHaveBeenLastCalledWith(expect.objectContaining({ dueBefore: '2026-10-03' })));
        fireEvent.change(dueDate, { target: { value: '' } });
        await waitFor(() => expect(mocks.listOrders).toHaveBeenLastCalledWith(expect.objectContaining({ stage: 'estimates', page: 1, dueBefore: undefined })));
    });
    it('presents accepted history as view only and never offers deletion', async () => {
        mocks.listOrders.mockResolvedValueOnce({ data: [{ ...item, status: 'APROVADA', acceptedQuote: item.items }], total: 1 });
        renderPage();
        await screen.findByRole('link', { name: 'Ana' });
        expect(screen.getByRole('link', { name: 'View quote Ana' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Delete quote Ana' })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Edit quote Ana' })).not.toBeInTheDocument();
    });
    it('shows a clear empty state when no orders exist', async () => { mocks.listOrders.mockResolvedValueOnce({ data: [], total: 0 }); renderPage(); expect(await screen.findByText('No estimates yet.')).toBeInTheDocument(); });
    it('creates an order from required customer and work details', async () => {
        const user = userEvent.setup();
        renderPage();
        await screen.findByRole('link', { name: 'Ana' });
        await user.click(screen.getByRole('button', { name: 'Create estimate' }));
        await user.type(screen.getByLabelText('Customer name'), 'Jo');
        await user.type(screen.getByLabelText('Work description'), 'Tune bike');
        await user.click(screen.getByRole('button', { name: 'Create estimate' }));
        await waitFor(() => expect(mocks.createOrder).toHaveBeenCalledWith({ customerName: 'Jo', description: 'Tune bike' }));
    });
});
