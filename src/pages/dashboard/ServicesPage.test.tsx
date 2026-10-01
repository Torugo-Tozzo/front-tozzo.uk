import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'bun:test';
import { MemoryRouter } from 'react-router-dom';
import { ConfirmProvider } from '@/contexts/ConfirmContext';
import { I18nProvider } from '@/i18n/provider';
import { i18n } from '@/i18n/config';
import { servicesApi } from '@/services/api';
import { replaceProperty } from '@/test/replace-property';
import type { ServiceOffering } from '@/domain/services';
import ServicesPage from './ServicesPage';
const sample: ServiceOffering = { id: 's1', establishmentId: 'est1', name: 'Repair', description: 'General repair', referencePrice: 45, isActive: true };
const mockUseAuth = vi.fn();
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => mockUseAuth() }));
function renderPage() {
    return render(<I18nProvider>
      <ConfirmProvider>
        <MemoryRouter>
          <ServicesPage />
        </MemoryRouter>
      </ConfirmProvider>
    </I18nProvider>);
}
describe('ServicesPage', () => {
    let list: ReturnType<typeof vi.fn>;
    let create: ReturnType<typeof vi.fn>;
    let update: ReturnType<typeof vi.fn>;
    let remove: ReturnType<typeof vi.fn>;
    let restore: Array<() => void>;
    beforeEach(async () => {
        mockUseAuth.mockReturnValue({ user: { role: 'OWNER' } });
        await act(async () => { await i18n.changeLanguage('en'); });
        list = vi.fn().mockResolvedValue({ data: [sample], total: 1 });
        create = vi.fn().mockResolvedValue({ ...sample, id: 's2', name: 'Inspection', referencePrice: null });
        update = vi.fn().mockResolvedValue(sample);
        remove = vi.fn().mockResolvedValue(undefined);
        restore = [
            replaceProperty(servicesApi, 'list', list as typeof servicesApi.list),
            replaceProperty(servicesApi, 'create', create as typeof servicesApi.create),
            replaceProperty(servicesApi, 'update', update as typeof servicesApi.update),
            replaceProperty(servicesApi, 'delete', remove as typeof servicesApi.delete),
        ];
    });
    afterEach(() => restore.forEach((restoreProperty) => restoreProperty()));
    it('lists services and shows an empty state', async () => {
        const user = userEvent.setup();
        renderPage();
        expect(await screen.findByText('Repair')).toBeInTheDocument();
        expect(screen.getByText('General repair', { selector: 'summary' })).toBeInTheDocument();
        expect(screen.getByText(/45\.00/)).toBeInTheDocument();
        await user.type(screen.getByRole('searchbox', { name: 'Search services' }), 'Inspection');
        await waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'Inspection' })));
        list.mockResolvedValueOnce({ data: [], total: 0 });
        await user.clear(screen.getByRole('searchbox', { name: 'Search services' }));
        expect(await screen.findByText('No services yet.')).toBeInTheDocument();
    });
    it('creates a service without a reference price and validates required name', async () => {
        const user = userEvent.setup();
        renderPage();
        await screen.findByText('Repair');
        await user.click(screen.getByRole('button', { name: 'New service' }));
        const dialog = screen.getByRole('dialog');
        const name = within(dialog).getByRole('textbox', { name: 'Service name' });
        expect(name).toBeRequired();
        await user.type(name, 'Inspection');
        await user.click(within(dialog).getByRole('button', { name: 'Create service' }));
        await waitFor(() => expect(create).toHaveBeenCalledWith({ name: 'Inspection', description: null, referencePrice: null }));
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });
    it('edits a service and keeps the form open with a visible error when saving fails', async () => {
        const user = userEvent.setup();
        renderPage();
        await screen.findByText('Repair');
        await user.click(screen.getByRole('button', { name: 'Edit service Repair' }));
        const dialog = screen.getByRole('dialog');
        await user.clear(within(dialog).getByRole('textbox', { name: 'Service name' }));
        await user.type(within(dialog).getByRole('textbox', { name: 'Service name' }), 'Inspection');
        await user.clear(within(dialog).getByRole('textbox', { name: 'Reference price' }));
        await user.type(within(dialog).getByRole('textbox', { name: 'Reference price' }), '6000');
        update.mockRejectedValueOnce(new Error('temporary'));
        expect(within(dialog).getByRole('textbox', { name: 'Reference price' })).toHaveValue('60.00');
        expect(within(dialog).getByRole('button', { name: 'Update service' })).toBeEnabled();
        const form = within(dialog).getByRole('button', { name: 'Update service' }).closest('form') as HTMLFormElement;
        expect(form.checkValidity()).toBe(true);
        await user.click(within(dialog).getByRole('button', { name: 'Update service' }));
        expect(create).not.toHaveBeenCalled();
        await waitFor(() => expect(update).toHaveBeenCalledWith('s1', { name: 'Inspection', description: 'General repair', referencePrice: 60 }));
        expect(await within(dialog).findByRole('alert')).toHaveTextContent('Could not save the service.');
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        await user.click(within(dialog).getByRole('button', { name: 'Update service' }));
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });
    it('uses a long description textarea, masked cents and no active-state UI', async () => {
        const user = userEvent.setup();
        renderPage();
        await screen.findByText('Repair');
        expect(screen.queryByRole('combobox', { name: 'Service status' })).not.toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Edit service Repair' }));
        expect(screen.getByLabelText('Description').tagName).toBe('TEXTAREA');
        expect(screen.getByLabelText('Description')).toHaveAttribute('rows', '10');
        await user.clear(screen.getByLabelText('Reference price'));
        await user.type(screen.getByLabelText('Reference price'), '1245');
        expect(screen.getByLabelText('Reference price')).toHaveValue('12.45');
    });
    it('confirms deletion and displays open references when deletion is blocked', async () => {
        remove.mockRejectedValueOnce({ response: { status: 409, data: { code: 'SERVICE_IN_USE', references: [{ id: 'o2', customerName: 'Jo', status: 'ORCADA' }] } } });
        const user = userEvent.setup();
        renderPage();
        await screen.findByText('Repair');
        await user.click(screen.getByRole('button', { name: 'Delete service Repair' }));
        await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete service' }));
        const alert = await screen.findByRole('alert');
        expect(within(alert).getByRole('link', { name: /Jo/ })).toHaveAttribute('href', '/dashboard/estimates/o2');
        expect(remove).toHaveBeenCalledWith('s1');
        expect(screen.getByText('Repair')).toBeInTheDocument();
    });
});
