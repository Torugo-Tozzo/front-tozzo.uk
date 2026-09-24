import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'bun:test'
import { MemoryRouter } from 'react-router-dom'
import { I18nProvider } from '@/i18n/provider'
import { i18n } from '@/i18n/config'
import api from '@/services/api'
import * as AuthContext from '@/contexts/AuthContext'
import { replaceProperty } from '@/test/replace-property'
import SchedulePage from './SchedulePage'

vi.mock('@fullcalendar/react', () => ({ default: (props: any) => <div><button onClick={() => props.datesSet({ startStr: '2026-09-20T00:00:00', endStr: '2026-09-27T00:00:00' })}>Load visible week</button><button onClick={() => props.dateClick({ dateStr: '2026-09-24' })}>Choose date</button><button onClick={() => props.eventClick({ event: { id: 'group-1', extendedProps: { shiftId: 'group-1' } } })}>Choose group</button><button onClick={() => props.eventClick({ event: { id: 'group-1', start: new Date(2026, 9, 1, 18), extendedProps: { shiftId: 'group-1' } } })}>Choose recurring group</button></div> }))

const restores: (() => void)[] = []
afterEach(() => { while (restores.length) restores.pop()?.() })

test('loads the visible range and creates a shift with an employee', async () => {
  await act(async () => { await i18n.changeLanguage('pt-BR') })
  const auth = vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ user: { role: 'OWNER' } } as ReturnType<typeof AuthContext.useAuth>)
  restores.push(() => auth.mockRestore())
  restores.push(replaceProperty(api, 'get', vi.fn().mockImplementation(async (url: string) => ({ data: url === '/calendar/business-hours' ? { hours: [] } : { events: [], employees: [{ id: 'u-1', name: 'Ana', role: 'EMPLOYEE' }] } })) as typeof api.get))
  restores.push(replaceProperty(api, 'post', vi.fn().mockResolvedValue({ data: {} }) as typeof api.post))
  render(<MemoryRouter><I18nProvider><SchedulePage /></I18nProvider></MemoryRouter>)
  fireEvent.click(screen.getByRole('button', { name: 'Load visible week' }))
  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/calendar', { params: { from: '2026-09-20', to: '2026-09-27', userIds: undefined } }))
  fireEvent.click(screen.getByRole('button', { name: 'Choose date' }))
  const dialog = screen.getByRole('dialog')
  fireEvent.click(within(dialog).getByLabelText('Ana'))
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Salvar turno' })) })
  expect(api.post).toHaveBeenCalledWith('/calendar/shifts', expect.objectContaining({ members: [{ employeeId: 'u-1' }], startDate: '2026-09-24', repeatWeekly: false }))
})

test('keeps the shift form open with an inline error when saving fails', async () => {
  await act(async () => { await i18n.changeLanguage('pt-BR') })
  const auth = vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ user: { role: 'OWNER' } } as ReturnType<typeof AuthContext.useAuth>)
  restores.push(() => auth.mockRestore())
  restores.push(replaceProperty(api, 'get', vi.fn().mockImplementation(async (url: string) => ({ data: url === '/calendar/business-hours' ? { hours: [] } : { events: [], employees: [{ id: 'u-1', name: 'Ana', role: 'EMPLOYEE' }] } })) as typeof api.get))
  restores.push(replaceProperty(api, 'post', vi.fn().mockRejectedValue(new Error('bad dates')) as typeof api.post))
  render(<MemoryRouter><I18nProvider><SchedulePage /></I18nProvider></MemoryRouter>)
  fireEvent.click(screen.getByRole('button', { name: 'Load visible week' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Filtrar por Funcionário' })).toBeInTheDocument())
  fireEvent.click(screen.getByRole('button', { name: 'Choose date' }))
  const dialog = screen.getByRole('dialog')
  fireEvent.click(within(dialog).getByLabelText('Ana'))
  await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar turno' })) })
  expect(within(dialog).getByRole('alert')).toHaveTextContent('Não foi possível salvar')
  expect(within(dialog).getByLabelText('Data inicial')).toHaveValue('2026-09-24')
})

test('shows opening hours separately and filters the calendar through a search dialog', async () => {
  await act(async () => { await i18n.changeLanguage('pt-BR') })
  const auth = vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ user: { role: 'OWNER' } } as ReturnType<typeof AuthContext.useAuth>)
  restores.push(() => auth.mockRestore())
  restores.push(replaceProperty(api, 'get', vi.fn().mockImplementation(async (url: string) => ({ data: url === '/calendar/business-hours' ? { hours: [{ daysOfWeek: [1], startTime: '11:00', endTime: '23:00' }] } : { events: [], employees: [{ id: 'u-1', name: 'Ana', role: 'EMPLOYEE' }] } })) as typeof api.get))
  render(<MemoryRouter><I18nProvider><SchedulePage /></I18nProvider></MemoryRouter>)
  fireEvent.click(screen.getByRole('button', { name: 'Load visible week' }))
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
  const auth = vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ user: { role: 'OWNER' } } as ReturnType<typeof AuthContext.useAuth>)
  restores.push(() => auth.mockRestore())
  const assignments = [
    { id: 'a-1', employeeId: 'u-1', employee: { id: 'u-1', name: 'Ana' }, startDate: '2026-09-24', startTime: '18:00', endDate: '2026-09-24', endTime: '23:00' },
    { id: 'a-2', employeeId: 'u-2', employee: { id: 'u-2', name: 'Bia' }, startDate: '2026-09-24', startTime: '17:00', endDate: '2026-09-24', endTime: '20:00' },
  ]
  const shift = { id: 'group-1', title: 'Noite', startDate: '2026-09-24', startTime: '18:00', endDate: '2026-09-24', endTime: '23:00', repeatWeekly: false, repeatUntil: null, assignments }
  restores.push(replaceProperty(api, 'get', vi.fn().mockImplementation(async (url: string) => ({ data: url === '/calendar/business-hours' ? { hours: [] } : { events: [], shifts: [shift], employees: [{ id: 'u-1', name: 'Ana' }, { id: 'u-2', name: 'Bia' }] } })) as typeof api.get))
  render(<MemoryRouter><I18nProvider><SchedulePage /></I18nProvider></MemoryRouter>)
  fireEvent.click(screen.getByRole('button', { name: 'Load visible week' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Choose group' })).toBeInTheDocument())
  fireEvent.click(screen.getByRole('button', { name: 'Choose group' }))
  const dialog = screen.getByRole('dialog')
  expect(within(dialog).getByText('Ana')).toBeInTheDocument()
  expect(within(dialog).getByText('Bia')).toBeInTheDocument()
  expect(within(dialog).getByText('17:00–20:00')).toBeInTheDocument()
})

test('a recurring occurrence shows its own date and edits the whole series', async () => {
  await act(async () => { await i18n.changeLanguage('pt-BR') })
  const auth = vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ user: { role: 'OWNER' } } as ReturnType<typeof AuthContext.useAuth>)
  restores.push(() => auth.mockRestore())
  const shift = { id: 'group-1', title: 'Noite', startDate: '2026-09-24', startTime: '18:00', endDate: '2026-09-25', endTime: '01:00', repeatWeekly: true, repeatUntil: null, assignments: [{ id: 'a-1', employeeId: 'u-1', employee: { id: 'u-1', name: 'Ana' }, startDate: '2026-09-24', startTime: '17:00', endDate: '2026-09-25', endTime: '00:30' }] }
  restores.push(replaceProperty(api, 'get', vi.fn().mockImplementation(async (url: string) => ({ data: url === '/calendar/business-hours' ? { hours: [] } : { events: [], shifts: [shift], employees: [{ id: 'u-1', name: 'Ana' }] } })) as typeof api.get))
  render(<MemoryRouter><I18nProvider><SchedulePage /></I18nProvider></MemoryRouter>)
  fireEvent.click(screen.getByRole('button', { name: 'Load visible week' }))
  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/calendar', expect.anything()))
  fireEvent.click(screen.getByRole('button', { name: 'Choose recurring group' }))
  const dialog = screen.getByRole('dialog')
  expect(within(dialog).getByText('2026-10-01 18:00–2026-10-02 01:00')).toBeInTheDocument()
  expect(within(dialog).getByText('Ana')).toBeInTheDocument()
  expect(within(dialog).getByRole('button', { name: 'Editar série semanal' })).toBeInTheDocument()
})
