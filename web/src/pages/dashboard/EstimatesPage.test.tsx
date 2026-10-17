vi.mock('@/contexts/AuthContext', () => import('@/test/auth-mock'));
import type { ServiceOrder } from '@/api/service-orders';
import { servicesApi } from '@/api/service-orders';
import { i18n } from '@/i18n/config';
import { renderDashboard } from '@/test/dashboard';
import { replaceProperty,Route } from '@/test/service-orders-support';
import { fireEvent,screen,waitFor } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import EstimatesPage from './ServiceOrdersList';
vi.mock('@/hooks/useRealtimeEvents', () => ({ useRealtimeEvents: () => { } }));
const mocks = { listOrders: vi.fn(), createOrder: vi.fn() };
let restore: Array<() => void> = [];
const item: ServiceOrder = { id: 'o1', createdAt:'2026-09-30T10:00:00Z',totalCents:8000,acceptedQuote:null,pendingItems:[],sale:null!, customerName: 'Ana', description: 'Bike repair', status: 'QUOTED', dueAt: '2026-10-02T00:00:00Z', responsibleId: null, completedAt: null, updatedAt: '2026-09-30T10:00:00Z', items: [{ id:'i1',details:null,kind:'SERVICE',isSupplement:false,productId: null, serviceId: 's1', description: 'Tune-up', quantity: 1, unitPriceCents: 8000 }], events: [] };
function renderPage() {
    return renderDashboard('/dashboard/estimates', () => <Route path="/dashboard/estimates" component={() => <EstimatesPage stage="estimates" />}/>);
}
describe('EstimatesPage', () => {
    beforeEach(async () => { restore = [replaceProperty(servicesApi, 'listOrders', mocks.listOrders as typeof servicesApi.listOrders), replaceProperty(servicesApi, 'createOrder', mocks.createOrder as typeof servicesApi.createOrder)]; await i18n.changeLanguage('en'); mocks.listOrders.mockReset().mockResolvedValue({ items: [item], total: 1 }); mocks.createOrder.mockReset().mockResolvedValue({ ...item, id: 'o2', status: 'OPEN' }); });
    afterEach(() => restore.forEach((fn) => fn()));
    it('pages using returned cursors and clears the cursor when filters change',async()=>{
        mocks.listOrders.mockImplementation(({cursor})=>Promise.resolve(cursor ? {items:[{...item,id:'o11',customerName:'Bia'}],nextCursor:null,total:11} : {items:[item],nextCursor:'page-two',total:11}));
        const user=userEvent.setup();renderPage();
        await screen.findByRole('link',{name:'Ana'});
        await user.click(screen.getByRole('button',{name:'Next'}));
        await screen.findByRole('link',{name:'Bia'});
        expect(mocks.listOrders).toHaveBeenLastCalledWith(expect.objectContaining({cursor:'page-two'}),expect.any(AbortSignal));
        await user.selectOptions(screen.getByRole('combobox',{name:'Status'}),'OPEN');
        await screen.findByRole('link',{name:'Ana'});
        expect(mocks.listOrders).toHaveBeenLastCalledWith(expect.objectContaining({cursor:undefined,status:'OPEN'}),expect.any(AbortSignal));
    });
    it('retains failed creation fields and suppresses duplicate submits while pending',async()=>{
        let reject:(cause:Error)=>void=()=>{};
        mocks.createOrder.mockImplementation(()=>new Promise((_,fail)=>{reject=fail}));
        const user=userEvent.setup();renderPage();
        await user.click(screen.getByRole('button',{name:'Create estimate'}));
        await user.type(screen.getByLabelText('Customer name'),'Jo');
        await user.type(screen.getByLabelText('Work description'),'Repair');
        const form=screen.getByLabelText('Customer name').closest('form')!;
        fireEvent.submit(form);fireEvent.submit(form);
        await waitFor(()=>expect(mocks.createOrder).toHaveBeenCalledTimes(1));
        reject(new Error('offline'));
        await screen.findByRole('alert');
        expect(screen.getByLabelText('Customer name')).toHaveValue('Jo');
        expect(screen.getByLabelText('Work description')).toHaveValue('Repair');
    });
    it('lists orders and sends the selected status and due date filters', async () => {
        const user = userEvent.setup();
        renderPage();
        expect(await screen.findByRole('link', { name: 'Ana' })).toHaveAttribute('href', '/dashboard/estimates/o1');
        await user.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'QUOTED');
        await waitFor(() => expect(mocks.listOrders).toHaveBeenLastCalledWith(expect.objectContaining({ stage: 'estimates', status: 'QUOTED' }), expect.any(AbortSignal)));
        fireEvent.change(screen.getByLabelText('Due date'), { target: { value: '2026-10-03' } });
        await waitFor(() => expect(mocks.listOrders).toHaveBeenLastCalledWith(expect.objectContaining({ dueBefore: '2026-10-03' }), expect.any(AbortSignal)));
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
        await waitFor(() => expect(mocks.listOrders).toHaveBeenLastCalledWith(expect.objectContaining({ dueBefore: '2026-10-03' }), expect.any(AbortSignal)));
        fireEvent.change(dueDate, { target: { value: '' } });
        await waitFor(() => expect(mocks.listOrders).toHaveBeenLastCalledWith(expect.objectContaining({ stage: 'estimates', dueBefore: undefined }), expect.any(AbortSignal)));
    });
    it('presents accepted history as view only and never offers deletion', async () => {
        mocks.listOrders.mockResolvedValueOnce({ items: [{ ...item, status: 'APPROVED', acceptedQuote: item.items }], total: 1 });
        renderPage();
        await screen.findByRole('link', { name: 'Ana' });
        expect(screen.getByRole('link', { name: 'View quote Ana' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Delete quote Ana' })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Edit quote Ana' })).not.toBeInTheDocument();
    });
    it('shows a clear empty state when no orders exist', async () => { mocks.listOrders.mockResolvedValueOnce({ items: [], total: 0 }); renderPage(); expect(await screen.findByText('No estimates yet.')).toBeInTheDocument(); });
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
