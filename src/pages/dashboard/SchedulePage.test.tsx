import { fireEvent, render, screen, waitFor, within } from '@solidjs/testing-library'
import { afterEach, expect, test, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/solid-query'

import { i18n } from '@/i18n/config'
import * as calendarApi from '@/api/calendar'
const lifecycle = vi.hoisted(() => ({ created: 0, destroyed: 0, signals: [] as AbortSignal[] }))
const api = { get: vi.fn(), put: vi.fn(), post: vi.fn(), delete: vi.fn() }
vi.mock('@/api/calendar', async (original) => ({ ...await original<typeof calendarApi>(), getCalendar: (...args: any[]) => { lifecycle.signals.push(args[1]); return api.get('/calendar', { params: args[0] }).then((r: any) => ({ shifts: [], ...r.data })) }, getBusinessHours: () => api.get('/calendar/business-hours').then((r: any) => r.data.hours), saveBusinessHours: (hours: any) => api.put('/calendar/business-hours', { hours }).then((r: any) => r.data.hours), createShift: (body: any) => api.post('/calendar/shifts', body), updateShift: (id: string, body: any) => api.put(`/calendar/shifts/${id}`, body), deleteShift: (id: string) => api.delete(`/calendar/shifts/${id}`) }))
const act = async (fn: () => Promise<void>) => fn()
import * as AuthContext from '@/contexts/AuthContext'
const replaceProperty = (target: any, key: string, value: any) => { const old = target[key]; target[key] = value; return () => { target[key] = old } }
import SchedulePage from './SchedulePage'

vi.mock('@solidjs/router', () => ({ useSearchParams: () => [{}] }))
vi.mock('@fullcalendar/core', () => ({ Calendar: class {
 constructor(el: HTMLElement, props: any) { lifecycle.created++; this.el=el; this.props=props }
 el: HTMLElement; props: any
 render() { const buttons: [string,()=>void][] = [['Load visible week',()=>this.props.datesSet({startStr:'2026-09-20',endStr:'2026-09-27'})],['Choose date',()=>this.props.dateClick({dateStr:'2026-09-24'})],['Choose group',()=>this.props.eventClick({event:{id:'group-1',extendedProps:{shiftId:'group-1'}}})],['Choose recurring group',()=>this.props.eventClick({event:{id:'group-1',start:new Date(2026,9,1,18),extendedProps:{shiftId:'group-1'}}})]]; for (const [text, click] of buttons) { const button=document.createElement('button'); button.textContent=text; button.onclick=click; this.el.append(button) } }
 setOption() {} batchRendering(fn:()=>void) { fn() } destroy() { lifecycle.destroyed++; this.el.replaceChildren() }
} }))

const restores: (() => void)[] = []
afterEach(() => { while (restores.length) restores.pop()?.() })

test('loads the visible range and creates a shift with an employee', async () => {
  await act(async () => { await i18n.changeLanguage('pt-BR') })
  const auth = vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ user: () => ({ role: 'OWNER' }) } as ReturnType<typeof AuthContext.useAuth>)
  restores.push(() => auth.mockRestore())
  restores.push(replaceProperty(api, 'get', vi.fn().mockImplementation(async (url: string) => ({ data: url === '/calendar/business-hours' ? { hours: [] } : { events: [], employees: [{ id: 'u-1', name: 'Ana', role: 'EMPLOYEE' }] } })) as typeof api.get))
  restores.push(replaceProperty(api, 'post', vi.fn().mockResolvedValue({ data: {} }) as typeof api.post))
  render(() => <QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><SchedulePage /></QueryClientProvider>)
  fireEvent.click(screen.getByRole('button', { name: 'Load visible week' }))
  await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/calendar', { params: { from: '2026-09-20', to: '2026-09-27', userIds: undefined } }))
  fireEvent.click(screen.getByRole('button', { name: 'Choose date' }))
  const dialog = screen.getByRole('dialog')
  fireEvent.click(within(dialog).getByLabelText('Ana'))
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Salvar turno' })) })
  expect(api.post).toHaveBeenCalledWith('/calendar/shifts', expect.objectContaining({ members: [{ employeeId: 'u-1' }], startDate: '2026-09-24', repeatWeekly: false }))
})

test('keeps the shift form open with an inline error when saving fails', async () => {
  await act(async () => { await i18n.changeLanguage('pt-BR') })
  const auth = vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ user: () => ({ role: 'OWNER' }) } as ReturnType<typeof AuthContext.useAuth>)
  restores.push(() => auth.mockRestore())
  restores.push(replaceProperty(api, 'get', vi.fn().mockImplementation(async (url: string) => ({ data: url === '/calendar/business-hours' ? { hours: [] } : { events: [], employees: [{ id: 'u-1', name: 'Ana', role: 'EMPLOYEE' }] } })) as typeof api.get))
  restores.push(replaceProperty(api, 'post', vi.fn().mockRejectedValue(new Error('bad dates')) as typeof api.post))
  render(() => <QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><SchedulePage /></QueryClientProvider>)
  fireEvent.click(screen.getByRole('button', { name: 'Load visible week' }))
  await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
  await waitFor(() => expect(screen.getByRole('button', { name: 'Filtrar por Funcionário' })).toBeInTheDocument())
  fireEvent.click(screen.getByRole('button', { name: 'Choose date' }))
  const dialog = screen.getByRole('dialog')
  fireEvent.click(within(dialog).getByLabelText('Ana'))
  await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar turno' })) })
  await waitFor(() => expect(within(dialog).getByRole('alert')).toHaveTextContent('Não foi possível salvar'))
  expect(within(dialog).getByLabelText('Data inicial')).toHaveValue('2026-09-24')
})

test('shows opening hours separately and filters the calendar through a search dialog', async () => {
  await act(async () => { await i18n.changeLanguage('pt-BR') })
  const auth = vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ user: () => ({ role: 'OWNER' }) } as ReturnType<typeof AuthContext.useAuth>)
  restores.push(() => auth.mockRestore())
  restores.push(replaceProperty(api, 'get', vi.fn().mockImplementation(async (url: string) => ({ data: url === '/calendar/business-hours' ? { hours: [{ daysOfWeek: [1], startTime: '11:00', endTime: '23:00' }] } : { events: [], employees: [{ id: 'u-1', name: 'Ana', role: 'EMPLOYEE' }] } })) as typeof api.get))
  render(() => <QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><SchedulePage /></QueryClientProvider>)
  fireEvent.click(screen.getByRole('button', { name: 'Load visible week' }))
  await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
  await waitFor(() => expect(screen.getByRole('button', { name: 'Filtrar por Funcionário' })).toBeInTheDocument())
  expect(screen.getByRole('heading', { name: 'Funcionamento' })).toBeInTheDocument()
  expect(screen.queryByLabelText('segunda-feira Abertura')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Filtrar por Funcionário' }))
  fireEvent.click(within(screen.getByRole('dialog')).getByLabelText('Ana'))
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Aplicar filtro' }))
  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/calendar', { params: { from: '2026-09-20', to: '2026-09-27', userIds: 'u-1' } }))
})

test('opening a shift lists its associated employees and their individual times', async () => {
  await act(async () => { await i18n.changeLanguage('pt-BR') })
  const auth = vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ user: () => ({ role: 'OWNER' }) } as ReturnType<typeof AuthContext.useAuth>)
  restores.push(() => auth.mockRestore())
  const assignments = [
    { id: 'a-1', employeeId: 'u-1', employee: { id: 'u-1', name: 'Ana' }, startDate: '2026-09-24', startTime: '18:00', endDate: '2026-09-24', endTime: '23:00' },
    { id: 'a-2', employeeId: 'u-2', employee: { id: 'u-2', name: 'Bia' }, startDate: '2026-09-24', startTime: '17:00', endDate: '2026-09-24', endTime: '20:00' },
  ]
  const shift = { id: 'group-1', title: 'Noite', startDate: '2026-09-24', startTime: '18:00', endDate: '2026-09-24', endTime: '23:00', repeatWeekly: false, repeatUntil: null, assignments }
  restores.push(replaceProperty(api, 'get', vi.fn().mockImplementation(async (url: string) => ({ data: url === '/calendar/business-hours' ? { hours: [] } : { events: [], shifts: [shift], employees: [{ id: 'u-1', name: 'Ana' }, { id: 'u-2', name: 'Bia' }] } })) as typeof api.get))
  render(() => <QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><SchedulePage /></QueryClientProvider>)
  fireEvent.click(screen.getByRole('button', { name: 'Load visible week' }))
  await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
  await waitFor(() => expect(screen.getByRole('button', { name: 'Choose group' })).toBeInTheDocument())
  fireEvent.click(screen.getByRole('button', { name: 'Choose group' }))
  const dialog = screen.getByRole('dialog')
  expect(within(dialog).getByText('Ana')).toBeInTheDocument()
  expect(within(dialog).getByText('Bia')).toBeInTheDocument()
  expect(within(dialog).getByText('17:00–20:00')).toBeInTheDocument()
})

test('a recurring occurrence shows its own date and edits the whole series', async () => {
  await act(async () => { await i18n.changeLanguage('pt-BR') })
  const auth = vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ user: () => ({ role: 'OWNER' }) } as ReturnType<typeof AuthContext.useAuth>)
  restores.push(() => auth.mockRestore())
  const shift = { id: 'group-1', title: 'Noite', startDate: '2026-09-24', startTime: '18:00', endDate: '2026-09-25', endTime: '01:00', repeatWeekly: true, repeatUntil: null, assignments: [{ id: 'a-1', employeeId: 'u-1', employee: { id: 'u-1', name: 'Ana' }, startDate: '2026-09-24', startTime: '17:00', endDate: '2026-09-25', endTime: '00:30' }] }
  restores.push(replaceProperty(api, 'get', vi.fn().mockImplementation(async (url: string) => ({ data: url === '/calendar/business-hours' ? { hours: [] } : { events: [], shifts: [shift], employees: [{ id: 'u-1', name: 'Ana' }] } })) as typeof api.get))
  render(() => <QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><SchedulePage /></QueryClientProvider>)
  fireEvent.click(screen.getByRole('button', { name: 'Load visible week' }))
  await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/calendar', expect.anything()))
  fireEvent.click(screen.getByRole('button', { name: 'Choose recurring group' }))
  const dialog = screen.getByRole('dialog')
  expect(within(dialog).getByText('2026-10-01 18:00–2026-10-02 01:00')).toBeInTheDocument()
  expect(within(dialog).getByText('Ana')).toBeInTheDocument()
  expect(within(dialog).getByRole('button', { name: 'Editar série semanal' })).toBeInTheDocument()
})

test('keeps one calendar through refetches, destroys it and cancels the pending query when leaving', async () => {
  const auth = vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ user: () => ({ role: 'OWNER' }) } as ReturnType<typeof AuthContext.useAuth>)
  restores.push(() => auth.mockRestore())
  restores.push(replaceProperty(api, 'get', vi.fn().mockImplementation(async (url: string) => url === '/calendar/business-hours' ? { data: { hours: [] } } : new Promise(() => {}))))
  const before = lifecycle.created, destroyed = lifecycle.destroyed
  const view = render(() => <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><SchedulePage /></QueryClientProvider>)
  fireEvent.click(screen.getByRole('button', { name: 'Load visible week' }))
  await waitFor(() => expect(lifecycle.signals.at(-1)).toBeInstanceOf(AbortSignal))
  expect(lifecycle.created).toBe(before + 1)
  const signal = lifecycle.signals.at(-1)!
  view.unmount()
  expect(lifecycle.destroyed).toBe(destroyed + 1)
  expect(signal.aborted).toBe(true)
})
