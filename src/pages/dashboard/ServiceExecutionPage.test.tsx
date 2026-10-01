import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'bun:test';
import { MemoryRouter } from 'react-router-dom';
import { ConfirmProvider } from '@/contexts/ConfirmContext';
import { I18nProvider } from '@/i18n/provider';
import { i18n } from '@/i18n/config';
import { servicesApi } from '@/services/api';
import { replaceProperty } from '@/test/replace-property';
import type { ServiceOrder } from '@/domain/services';
import ServiceExecutionPage from './ServiceExecutionPage';
vi.mock('@/hooks/useRealtimeEvents', () => ({ useRealtimeEvents: () => { } }));
const list = vi.fn();
let restore: () => void;
beforeEach(async () => { await act(async () => { await i18n.changeLanguage('en'); }); restore = replaceProperty(servicesApi, 'listOrders', list as typeof servicesApi.listOrders); list.mockReset().mockResolvedValue({ data: [{ id: 'o1', customerName: 'Ana', description: 'Repair', status: 'APROVADA', items: [], acceptedQuote: [], updatedAt: 'version' } as unknown as ServiceOrder], total: 1 }); });
afterEach(() => restore());
it('lists operational services separately and allows history filtering', async () => {
    render(<I18nProvider>
      <ConfirmProvider>
        <MemoryRouter>
          <ServiceExecutionPage />
        </MemoryRouter>
      </ConfirmProvider>
    </I18nProvider>);
    expect(await screen.findByRole('link', { name: 'Ana' })).toHaveAttribute('href', '/dashboard/service-orders/o1');
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ stage: 'services', open: true }));
    expect(screen.queryByRole('button', { name: 'Create estimate' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete quote Ana' })).not.toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByLabelText('Open only'));
    await waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ stage: 'services', open: undefined })));
});
it('keeps execution and open-only filters when selecting and clearing the due date', async () => {
    render(<I18nProvider>
      <ConfirmProvider>
        <MemoryRouter>
          <ServiceExecutionPage />
        </MemoryRouter>
      </ConfirmProvider>
    </I18nProvider>);
    await screen.findByRole('link', { name: 'Ana' });
    const dueDate = screen.getByLabelText('Due date') as HTMLInputElement;
    expect(dueDate.labels?.[0]).toHaveTextContent('Due date');
    fireEvent.change(dueDate, { target: { value: '2026-10-03' } });
    await waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ stage: 'services', open: true, dueBefore: '2026-10-03', page: 1 })));
    fireEvent.change(dueDate, { target: { value: '' } });
    await waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ stage: 'services', open: true, dueBefore: undefined, page: 1 })));
});
