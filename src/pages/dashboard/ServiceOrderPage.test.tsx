import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'bun:test'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ConfirmProvider } from '@/contexts/ConfirmContext'
import { I18nProvider } from '@/i18n/provider'
import { i18n } from '@/i18n/config'
import { servicesApi } from '@/services/api'
import api from '@/services/api'
import { replaceProperty } from '@/test/replace-property'
import type { ServiceOrder } from '@/domain/services'
import ServiceOrderPage from './ServiceOrderPage'

const order: ServiceOrder = { id:'o1', establishmentId:'e1', customerName:'Ana', description:'Bike repair', status:'APROVADA', dueAt:null, responsibleId:null, completedAt:null, updatedAt:'2026-09-30T10:00:00.000Z', items:[{id:'i1',productId:null,serviceOfferingId:'s1',description:'Tune-up',quantity:1,unitPrice:80}], events:[{id:'ev1',fromStatus:'ORCADA',toStatus:'APROVADA',action:'APROVAR',createdAt:'2026-09-30T10:00:00Z',userId:'u1'}] }
const mocks = { getOrder: vi.fn(), updateOrder: vi.fn(), action: vi.fn(), replaceQuote: vi.fn(), get: vi.fn() }
let restore: Array<() => void> = []
function renderPage(){ return render(<I18nProvider><ConfirmProvider><MemoryRouter initialEntries={['/dashboard/estimates/o1']}><Routes><Route path="/dashboard/estimates/:id" element={<ServiceOrderPage/>}/></Routes></MemoryRouter></ConfirmProvider></I18nProvider>) }
describe('ServiceOrderPage',()=>{
 beforeEach(async()=>{ restore = [replaceProperty(servicesApi,'getOrder',mocks.getOrder as typeof servicesApi.getOrder), replaceProperty(servicesApi,'updateOrder',mocks.updateOrder as typeof servicesApi.updateOrder), replaceProperty(servicesApi,'action',mocks.action as typeof servicesApi.action), replaceProperty(servicesApi,'replaceQuote',mocks.replaceQuote as typeof servicesApi.replaceQuote), replaceProperty(api,'get',mocks.get as typeof api.get)]; await act(async()=>{await i18n.changeLanguage('en')}); mocks.getOrder.mockReset().mockResolvedValue(order); mocks.updateOrder.mockReset().mockResolvedValue(order); mocks.action.mockReset().mockResolvedValue({order:{...order,status:'EM_EXECUCAO'},retried:false}); mocks.replaceQuote.mockReset(); mocks.get.mockReset().mockResolvedValue({data:{data:[],total:0},headers:{}}) })
 afterEach(()=>restore.forEach((fn)=>fn()))
 it('shows mixed quote lines, history and only the approved-state action',async()=>{ const user=userEvent.setup(); renderPage(); expect(await screen.findByText('Tune-up')).toBeInTheDocument(); expect(screen.getByText('APROVAR · Approved')).toBeInTheDocument(); expect(screen.getByRole('button',{name:'Start work'})).toBeInTheDocument(); expect(screen.queryByRole('button',{name:'Close order and record sale'})).not.toBeInTheDocument(); await user.click(screen.getByRole('button',{name:'Start work'})); await waitFor(()=>expect(mocks.action).toHaveBeenCalledWith('o1','iniciar',order.updatedAt)) })
 it('keeps the edited draft visible and reports a 409 conflict',async()=>{ const user=userEvent.setup(); mocks.updateOrder.mockRejectedValueOnce({response:{status:409}}); renderPage(); await screen.findByText('Tune-up'); await user.click(screen.getByRole('button',{name:'Edit details'})); const field=screen.getByLabelText('Work description'); await user.clear(field); await user.type(field,'Revised repair'); await user.click(screen.getByRole('button',{name:'Save details'})); expect(await screen.findByRole('alert')).toHaveTextContent('This order changed elsewhere. Reload it and try again.'); expect(field).toHaveValue('Revised repair') })
})
