import { fireEvent, render, screen, waitFor, within } from '@solidjs/testing-library'
import { afterEach, expect, test, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/solid-query'
import { i18n } from '@/i18n/config'
import * as calendarApi from '@/api/calendar'
const api = { get: vi.fn(), put: vi.fn(), post: vi.fn(), delete: vi.fn() }
vi.mock('@/api/calendar', async (original) => ({ ...await original<typeof calendarApi>(), getCalendar: (...args: any[]) => api.get('/calendar', { params: args[0] }).then((r: any) => r.data), getBusinessHours: () => api.get('/calendar/business-hours').then((r: any) => r.data.hours), saveBusinessHours: (hours: any) => api.put('/calendar/business-hours', { hours }).then((r: any) => r.data.hours), createShift: (body: any) => api.post('/calendar/shifts', body), updateShift: (id: string, body: any) => api.put(`/calendar/shifts/${id}`, body), deleteShift: (id: string) => api.delete(`/calendar/shifts/${id}`) }))
const act = async (fn: () => Promise<void>) => fn()
const replaceProperty = (target: any, key: string, value: any) => { const old = target[key]; target[key] = value; return () => { target[key] = old } }
import ShiftGroupDialog from './ShiftGroupDialog'

const restores: (() => void)[] = []
afterEach(() => { while (restores.length) restores.pop()?.() })

test('assigns several employees automatically and saves one custom exception', async () => {
  await act(async () => { await i18n.changeLanguage('pt-BR') })
  restores.push(replaceProperty(api, 'post', vi.fn().mockResolvedValue({ data: {} }) as typeof api.post))
  const onSaved = vi.fn()
  render(() => <QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><ShiftGroupDialog initial={null} defaultDate="2026-09-24" hours={[{ daysOfWeek: [4], startTime: '18:00', endTime: '23:00' }]} employees={[{ id: 'ana', name: 'Ana' }, { id: 'bia', name: 'Bia' }]} initialEmployeeIds={[]} onClose={() => {}} onSaved={onSaved} /></QueryClientProvider>)
  const dialog = screen.getByRole('dialog')
  expect(within(dialog).getByLabelText('Início')).toHaveValue('18:00')
  fireEvent.click(within(dialog).getByLabelText('Ana'))
  fireEvent.click(within(dialog).getByLabelText('Bia'))
  fireEvent.click(within(dialog).getByLabelText('Horário diferente para Bia'))
  fireEvent.input(within(dialog).getByLabelText('Entrada de Bia'), { target: { value: '17:00' } })
  fireEvent.input(within(dialog).getByLabelText('Saída de Bia'), { target: { value: '20:00' } })
  await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar turno' })) })
  expect(api.post).toHaveBeenCalledWith('/calendar/shifts', expect.objectContaining({ startTime: '18:00', endTime: '23:00', members: [{ employeeId: 'ana' }, { employeeId: 'bia', startDate: '2026-09-24', startTime: '17:00', endDate: '2026-09-24', endTime: '20:00' }] }))
  await waitFor(() => expect(onSaved).toHaveBeenCalled())
})

test('keeps an overnight shift ending on the following day when its date changes', async () => {
  await act(async () => { await i18n.changeLanguage('pt-BR') })
  const initial = { id: 'shift-1', title: null, startDate: '2026-09-24', startTime: '18:00', endDate: '2026-09-25', endTime: '01:00', repeatWeekly: true, repeatUntil: null, assignments: [{ id: 'a-1', employeeId: 'ana', employee: { id: 'ana', name: 'Ana' }, startDate: '2026-09-24', startTime: '18:00', endDate: '2026-09-25', endTime: '01:00' }] }
  render(() => <QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><ShiftGroupDialog initial={initial} defaultDate="2026-09-24" hours={[]} employees={[{ id: 'ana', name: 'Ana' }]} initialEmployeeIds={[]} onClose={() => {}} onSaved={() => {}} /></QueryClientProvider>)
  const dialog = screen.getByRole('dialog')
  fireEvent.input(within(dialog).getByLabelText('Data inicial'), { target: { value: '2026-10-01' } })
  expect(within(dialog).getByLabelText('Data final')).toHaveValue('2026-10-02')
})

test('moves individual exceptions with the shift date and saves the new dates', async () => {
  await act(async () => { await i18n.changeLanguage('pt-BR') })
  restores.push(replaceProperty(api, 'put', vi.fn().mockResolvedValue({ data: {} }) as typeof api.put))
  const initial = { id: 'shift-1', title: 'Noite', startDate: '2026-09-24', startTime: '18:00', endDate: '2026-09-25', endTime: '01:00', repeatWeekly: false, repeatUntil: null, assignments: [
    { id: 'a-1', employeeId: 'ana', employee: { id: 'ana', name: 'Ana' }, startDate: '2026-09-24', startTime: '18:00', endDate: '2026-09-25', endTime: '01:00' },
    { id: 'a-2', employeeId: 'bia', employee: { id: 'bia', name: 'Bia' }, startDate: '2026-09-24', startTime: '17:00', endDate: '2026-09-25', endTime: '00:30' },
  ] }
  render(() => <QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><ShiftGroupDialog initial={initial} defaultDate="2026-09-24" hours={[]} employees={[{ id: 'ana', name: 'Ana' }, { id: 'bia', name: 'Bia' }]} initialEmployeeIds={[]} onClose={() => {}} onSaved={() => {}} /></QueryClientProvider>)
  const dialog = screen.getByRole('dialog')
  fireEvent.input(within(dialog).getByLabelText('Data inicial'), { target: { value: '2026-10-01' } })
  expect(within(dialog).getByLabelText('Data de entrada de Bia')).toHaveValue('2026-10-01')
  expect(within(dialog).getByLabelText('Data de saída de Bia')).toHaveValue('2026-10-02')
  await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar turno' })) })
  expect(api.put).toHaveBeenCalledWith('/calendar/shifts/shift-1', expect.objectContaining({ startDate: '2026-10-01', endDate: '2026-10-02', members: [
    { employeeId: 'ana' },
    { employeeId: 'bia', startDate: '2026-10-01', startTime: '17:00', endDate: '2026-10-02', endTime: '00:30' },
  ] }))
})

test('preserves the focused member input through consecutive custom-time edits', async () => {
  await i18n.changeLanguage('pt-BR')
  render(() => <QueryClientProvider client={new QueryClient()}><ShiftGroupDialog initial={null} defaultDate="2026-10-01" hours={[]} employees={[{ id: 'ana', name: 'Ana' }]} initialEmployeeIds={['ana']} onClose={() => {}} onSaved={() => {}} /></QueryClientProvider>)
  fireEvent.click(screen.getByLabelText('Horário diferente para Ana'))
  const input = screen.getByLabelText('Entrada de Ana')
  input.focus()
  fireEvent.input(input, { target: { value: '17:01' } })
  expect(screen.getByLabelText('Entrada de Ana')).toBe(input)
  expect(input).toHaveFocus()
  fireEvent.input(input, { target: { value: '17:02' } })
  expect(input).toHaveFocus()
  expect(input).toHaveValue('17:02')
})
