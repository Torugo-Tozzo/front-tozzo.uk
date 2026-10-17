import { fireEvent, render, screen, waitFor, within } from '@solidjs/testing-library'
import { afterEach, expect, test, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/solid-query'
import { i18n } from '@/i18n/config'
import * as calendarApi from '@/api/calendar'
const api = { get: vi.fn(), put: vi.fn(), post: vi.fn(), delete: vi.fn() }
vi.mock('@/api/calendar', async (original) => ({ ...await original<typeof calendarApi>(), getCalendar: (...args: any[]) => api.get('/calendar', { params: args[0] }).then((r: any) => r.data), getBusinessHours: () => api.get('/calendar/business-hours').then((r: any) => r.data.hours), saveBusinessHours: (hours: any) => api.put('/calendar/business-hours', { hours }).then((r: any) => r.data.hours), createShift: (body: any) => api.post('/calendar/shifts', body), updateShift: (id: string, body: any) => api.put(`/calendar/shifts/${id}`, body), deleteShift: (id: string) => api.delete(`/calendar/shifts/${id}`) }))
const act = async (fn: () => Promise<void>) => fn()
const replaceProperty = (target: any, key: string, value: any) => { const old = target[key]; target[key] = value; return () => { target[key] = old } }
import BusinessHoursPanel from './BusinessHoursPanel'

const restores: (() => void)[] = []
afterEach(() => { while (restores.length) restores.pop()?.() })

test('shows opening hours separately and applies a shared schedule with day exceptions', async () => {
  await act(async () => { await i18n.changeLanguage('pt-BR') })
  restores.push(replaceProperty(api, 'put', vi.fn().mockResolvedValue({ data: { hours: [] } }) as typeof api.put))
  const onSaved = vi.fn()
  render(() => <QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><BusinessHoursPanel hours={[{ daysOfWeek: [1, 2, 3, 4, 5, 6], startTime: '11:00', endTime: '23:00' }]} canManage onSaved={onSaved} /></QueryClientProvider>)
  expect(screen.getByRole('heading', { name: 'Funcionamento' })).toBeInTheDocument()
  expect(screen.queryByLabelText('Abertura padrão')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Editar funcionamento' }))
  const dialog = screen.getByRole('dialog')
  fireEvent.input(within(dialog).getByLabelText('Abertura padrão'), { target: { value: '12:00' } })
  fireEvent.click(within(dialog).getByLabelText('sábado: Aberto'))
  fireEvent.click(within(dialog).getByLabelText('Personalizar segunda-feira'))
  fireEvent.input(within(dialog).getByLabelText('segunda-feira Fechamento'), { target: { value: '21:00' } })
  await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar funcionamento' })) })
  const payload = (api.put as ReturnType<typeof vi.fn>).mock.calls[0][1] as { hours: { daysOfWeek: number[]; startTime: string; endTime: string }[] }
  expect(payload.hours).toHaveLength(5)
  expect(payload.hours).toContainEqual({ daysOfWeek: [1], startTime: '11:00', endTime: '21:00' })
  expect(payload.hours).toContainEqual({ daysOfWeek: [2], startTime: '12:00', endTime: '23:00' })
  await waitFor(() => expect(onSaved).toHaveBeenCalled())
})

test('preserves the focused custom-day input through consecutive edits', async () => {
  await i18n.changeLanguage('pt-BR')
  render(() => <QueryClientProvider client={new QueryClient()}><BusinessHoursPanel hours={[{ daysOfWeek: [1], startTime: '11:00', endTime: '23:00' }]} canManage onSaved={() => {}} /></QueryClientProvider>)
  fireEvent.click(screen.getByRole('button', { name: 'Editar funcionamento' }))
  fireEvent.click(screen.getByLabelText('Personalizar segunda-feira'))
  const input = screen.getByLabelText('segunda-feira Fechamento')
  input.focus()
  fireEvent.input(input, { target: { value: '21:01' } })
  expect(screen.getByLabelText('segunda-feira Fechamento')).toBe(input)
  expect(input).toHaveFocus()
  fireEvent.input(input, { target: { value: '21:02' } })
  expect(input).toHaveFocus()
  expect(input).toHaveValue('21:02')
})
