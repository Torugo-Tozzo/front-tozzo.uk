import { Route } from '@solidjs/router';
import { screen, waitFor, within } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { i18n } from '@/i18n/config';
import { json, mockApi, noContent, problem, type RecordedCall } from '@/test/api';
import { resetAuthMocks, setMockUser } from '@/test/auth-mock';
import { renderDashboard } from '@/test/dashboard';
import ServicesPage from './ServicesPage';
vi.mock('@/contexts/AuthContext', () => import('@/test/auth-mock'));
const sample = { id: 's1', name: 'Repair', description: 'General repair', referencePriceCents: 4500, updatedAt: '2026-10-01T18:00:00Z' };
const renderPage = () => renderDashboard('/dashboard/services', () => <Route path="/dashboard/services" component={ServicesPage} />);
describe('ServicesPage', () => {
    let calls: RecordedCall[];
    let failSave: boolean;
    let blocked: boolean;
    let empty: boolean;
    beforeEach(async () => {
        resetAuthMocks();
        setMockUser({ role: 'OWNER' });
        await i18n.changeLanguage('en');
        failSave = false; blocked = false; empty = false;
        calls = mockApi(({ method, path }) => {
            if (path === '/v1/services' && method === 'GET') return json(200, { items: empty ? [] : [sample], total: empty ? 0 : 1, nextCursor: null });
            if (method === 'PATCH') { if (failSave) { failSave = false; return problem(500, 'INTERNAL_ERROR'); } return json(200, sample); }
            if (method === 'POST') return json(201, { ...sample, id: 's2' });
            if (method === 'DELETE') return blocked ? json(409, { title: 'Conflict', status: 409, code: 'SERVICE_IN_USE', references: [{ id: 'o2', customerName: 'Jo', status: 'QUOTED' }, { id: 'o3', customerName: 'Sam', status: 'IN_PROGRESS' }] }) : noContent();
            return undefined;
        }).calls;
    });
    afterEach(() => vi.unstubAllGlobals());
    it('lists services and shows an empty state', async () => {
        const user = userEvent.setup();
        renderPage();
        expect(await screen.findByText('Repair')).toBeInTheDocument();
        expect(screen.getByText('General repair', { selector: 'summary' })).toBeInTheDocument();
        expect(screen.getByText(/45\.00/)).toBeInTheDocument();
        await user.type(screen.getByRole('searchbox', { name: 'Search services' }), 'Inspection');
        await waitFor(() => expect(calls.filter(c => c.method === 'GET').at(-1)?.query.get('search')).toBe('Inspection'));
        empty = true;
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
        await waitFor(() => expect(calls.find(c => c.method === 'POST')?.body).toEqual({ name: 'Inspection' }));
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
        failSave = true;
        expect(within(dialog).getByRole('textbox', { name: 'Reference price' })).toHaveValue('60.00');
        expect(within(dialog).getByRole('button', { name: 'Update service' })).toBeEnabled();
        const form = within(dialog).getByRole('button', { name: 'Update service' }).closest('form') as HTMLFormElement;
        expect(form.checkValidity()).toBe(true);
        await user.click(within(dialog).getByRole('button', { name: 'Update service' }));
        expect(calls.some(c => c.method === 'POST')).toBe(false);
        await waitFor(() => expect(calls.find(c => c.method === 'PATCH')?.body).toEqual({ name: 'Inspection', description: 'General repair', referencePriceCents: 6000 }));
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
        blocked = true;
        const user = userEvent.setup();
        renderPage();
        await screen.findByText('Repair');
        await user.click(screen.getByRole('button', { name: 'Delete service Repair' }));
        await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete service' }));
        const alert = await screen.findByRole('alert');
        expect(within(alert).getByRole('link', { name: /Jo/ })).toHaveAttribute('href', '/dashboard/estimates/o2');
        expect(calls.find(c => c.method === 'DELETE')?.path).toBe('/v1/services/s1');
        expect(within(alert).getByRole('link', { name: /Sam/ })).toHaveAttribute('href', '/dashboard/service-orders/o3');
        expect(screen.getByText('Repair')).toBeInTheDocument();
    });
    it('uses cursors and resets pagination on search', async () => {
        mockApi(({ query }) => json(200, { items: [{ ...sample, name: query.get('cursor') ? 'Second service' : query.get('search') ? 'Found service' : 'First service' }], total: query.get('search') ? 1 : 11, nextCursor: query.get('cursor') || query.get('search') ? null : 'next-page' }));
        const user = userEvent.setup(); renderPage();
        expect(await screen.findByText('Page 1 of 2')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Next' }));
        expect(await screen.findByText('Second service')).toBeInTheDocument();
        expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
        await user.type(screen.getByRole('searchbox'), 'Found');
        expect(await screen.findByText('Found service')).toBeInTheDocument();
        expect(screen.getByText('Page 1 of 1')).toBeInTheDocument();
    });
    for (const role of ['MANAGER', 'EMPLOYEE'] as const) {
        it(`keeps the catalog read-only for ${role}`, async () => {
            setMockUser({ role }); renderPage();
            await screen.findByText('Repair');
            expect(screen.queryByRole('button', { name: 'New service' })).toBeNull();
            expect(screen.queryByRole('button', { name: /Edit service|Delete service/ })).toBeNull();
        });
    }
    it('shows loading and retries a failed list without suspending the page', async () => {
        let answer: (value: Response) => void = () => {};
        mockApi(() => new Promise<Response>(resolve => { answer = resolve }));
        const user = userEvent.setup(); renderPage();
        expect(await screen.findByRole('status')).toHaveTextContent('Loading');
        expect(screen.queryByText('Suspended')).toBeNull();
        answer(problem(400, 'VALIDATION_FAILED'));
        expect(await screen.findByRole('alert')).toHaveTextContent('Could not load services.');
        await user.click(screen.getByRole('button', { name: 'Retry' }));
        answer(json(200, { items: [sample], nextCursor: null, total: 1 }));
        expect(await screen.findByText('Repair')).toBeInTheDocument();
    });
    it('deletes after confirmation and reloads the list', async () => {
        const api = mockApi(({ method }) => {
            if (method === 'DELETE') { empty = true; return noContent(); }
            return json(200, { items: empty ? [] : [sample], total: empty ? 0 : 1, nextCursor: null });
        });
        const user = userEvent.setup(); renderPage();
        await user.click(await screen.findByRole('button', { name: 'Delete service Repair' }));
        await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete service' }));
        expect(await screen.findByText('No services yet.')).toBeInTheDocument();
        expect(api.calls.filter(c => c.method === 'DELETE')).toHaveLength(1);
    });
    it('prevents duplicate submissions and keeps the edited values while saving', async () => {
        let answer: (value: Response) => void = () => {};
        const api = mockApi(({ method }) => method === 'PATCH' ? new Promise<Response>(resolve => { answer = resolve }) : json(200, { items: [sample], total: 1, nextCursor: null }));
        const user = userEvent.setup(); renderPage();
        await user.click(await screen.findByRole('button', { name: 'Edit service Repair' }));
        const save = screen.getByRole('button', { name: 'Update service' });
        await user.dblClick(save);
        expect(save).toBeDisabled();
        expect(api.calls.filter(c => c.method === 'PATCH')).toHaveLength(1);
        answer(problem(409, 'SERVICE_CONFLICT'));
        expect(await screen.findByRole('alert')).toHaveTextContent('Could not save the service.');
        expect(screen.getByLabelText('Service name')).toHaveValue('Repair');
    });

});
