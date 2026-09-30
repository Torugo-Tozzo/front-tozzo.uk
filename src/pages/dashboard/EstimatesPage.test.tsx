import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'bun:test'
import { MemoryRouter } from 'react-router-dom'
import { I18nProvider } from '@/i18n/provider'
import { i18n } from '@/i18n/config'
import type { ServiceOrder } from '@/domain/services'
import { servicesApi } from '@/services/api'
import { replaceProperty } from '@/test/replace-property'
import EstimatesPage from './EstimatesPage'

const mocks = { listOrders: vi.fn(), createOrder: vi.fn() }
let restore: Array<() => void> = []
const item: ServiceOrder = { id:'o1', establishmentId:'e1', customerName:'Ana', description:'Bike repair', status:'ORCADA', dueAt:'2026-10-02T00:00:00Z', responsibleId:null, completedAt:null, updatedAt:'2026-09-30T10:00:00Z', items:[{ productId:null, serviceOfferingId:'s1', description:'Tune-up', quantity:1, unitPrice:80 }], events:[] }
function renderPage() { return render(<I18nProvider><MemoryRouter><EstimatesPage /></MemoryRouter></I18nProvider>) }
describe('EstimatesPage', () => {
 beforeEach(async () => { restore = [replaceProperty(servicesApi, 'listOrders', mocks.listOrders as typeof servicesApi.listOrders), replaceProperty(servicesApi, 'createOrder', mocks.createOrder as typeof servicesApi.createOrder)]; await act(async () => { await i18n.changeLanguage('en') }); mocks.listOrders.mockReset().mockResolvedValue({data:[item],total:1}); mocks.createOrder.mockReset().mockResolvedValue({...item,id:'o2',status:'ABERTA'}) })
 afterEach(() => restore.forEach((fn) => fn()))
 it('lists orders and sends the selected status and due date filters', async () => {
  const user=userEvent.setup(); renderPage(); expect(await screen.findByRole('link',{name:'Ana'})).toHaveAttribute('href','/dashboard/estimates/o1')
  await user.selectOptions(screen.getByRole('combobox',{name:'Status'}),'ORCADA'); await waitFor(()=>expect(mocks.listOrders).toHaveBeenLastCalledWith(expect.objectContaining({status:'ORCADA'})))
  fireEvent.change(screen.getByLabelText('Due date'),{target:{value:'2026-10-03'}}); await waitFor(()=>expect(mocks.listOrders).toHaveBeenLastCalledWith(expect.objectContaining({dueBefore:'2026-10-03'})))
 })
 it('shows a clear empty state when no orders exist', async () => { mocks.listOrders.mockResolvedValueOnce({data:[],total:0}); renderPage(); expect(await screen.findByText('No service orders yet.')).toBeInTheDocument() })
 it('creates an order from required customer and work details', async () => {
  const user=userEvent.setup(); renderPage(); await screen.findByRole('link',{name:'Ana'}); await user.click(screen.getByRole('button',{name:'Create order'})); await user.type(screen.getByLabelText('Customer name'),'Jo'); await user.type(screen.getByLabelText('Work description'),'Tune bike'); await user.click(screen.getByRole('button',{name:'Create order'})); await waitFor(()=>expect(mocks.createOrder).toHaveBeenCalledWith({customerName:'Jo',description:'Tune bike'}))
 })
})
