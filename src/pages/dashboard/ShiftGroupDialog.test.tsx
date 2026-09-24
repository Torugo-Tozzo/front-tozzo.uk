import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'bun:test'
import { I18nProvider } from '@/i18n/provider'
import { i18n } from '@/i18n/config'
import api from '@/services/api'
import { replaceProperty } from '@/test/replace-property'
import ShiftGroupDialog from './ShiftGroupDialog'

const restores: (() => void)[] = []
afterEach(() => { while (restores.length) restores.pop()?.() })

test('assigns several employees automatically and saves one custom exception', async () => {
  await act(async () => { await i18n.changeLanguage('pt-BR') })
  restores.push(replaceProperty(api, 'post', vi.fn().mockResolvedValue({ data: {} }) as typeof api.post))
  const onSaved = vi.fn()
  render(<I18nProvider><ShiftGroupDialog initial={null} defaultDate="2026-09-24" hours={[{ daysOfWeek: [4], startTime: '18:00', endTime: '23:00' }]} employees={[{ id: 'ana', name: 'Ana' }, { id: 'bia', name: 'Bia' }]} initialEmployeeIds={[]} onClose={() => {}} onSaved={onSaved} /></I18nProvider>)
  const dialog = screen.getByRole('dialog')
  expect(within(dialog).getByLabelText('Início')).toHaveValue('18:00')
  fireEvent.click(within(dialog).getByLabelText('Ana'))
  fireEvent.click(within(dialog).getByLabelText('Bia'))
  fireEvent.click(within(dialog).getByLabelText('Horário diferente para Bia'))
  fireEvent.change(within(dialog).getByLabelText('Entrada de Bia'), { target: { value: '17:00' } })
  fireEvent.change(within(dialog).getByLabelText('Saída de Bia'), { target: { value: '20:00' } })
  await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar turno' })) })
  expect(api.post).toHaveBeenCalledWith('/calendar/shifts', expect.objectContaining({ startTime: '18:00', endTime: '23:00', members: [{ employeeId: 'ana' }, { employeeId: 'bia', startDate: '2026-09-24', startTime: '17:00', endDate: '2026-09-24', endTime: '20:00' }] }))
  expect(onSaved).toHaveBeenCalled()
})

test('keeps an overnight shift ending on the following day when its date changes', async () => {
  await act(async () => { await i18n.changeLanguage('pt-BR') })
  const initial = { id: 'shift-1', title: null, startDate: '2026-09-24', startTime: '18:00', endDate: '2026-09-25', endTime: '01:00', repeatWeekly: true, repeatUntil: null, assignments: [{ id: 'a-1', employeeId: 'ana', employee: { id: 'ana', name: 'Ana' }, startDate: '2026-09-24', startTime: '18:00', endDate: '2026-09-25', endTime: '01:00' }] }
  render(<I18nProvider><ShiftGroupDialog initial={initial} defaultDate="2026-09-24" hours={[]} employees={[{ id: 'ana', name: 'Ana' }]} initialEmployeeIds={[]} onClose={() => {}} onSaved={() => {}} /></I18nProvider>)
  const dialog = screen.getByRole('dialog')
  fireEvent.change(within(dialog).getByLabelText('Data inicial'), { target: { value: '2026-10-01' } })
  expect(within(dialog).getByLabelText('Data final')).toHaveValue('2026-10-02')
})

test('moves individual exceptions with the shift date and saves the new dates', async () => {
  await act(async () => { await i18n.changeLanguage('pt-BR') })
  restores.push(replaceProperty(api, 'put', vi.fn().mockResolvedValue({ data: {} }) as typeof api.put))
  const initial = { id: 'shift-1', title: 'Noite', startDate: '2026-09-24', startTime: '18:00', endDate: '2026-09-25', endTime: '01:00', repeatWeekly: false, repeatUntil: null, assignments: [
    { id: 'a-1', employeeId: 'ana', employee: { id: 'ana', name: 'Ana' }, startDate: '2026-09-24', startTime: '18:00', endDate: '2026-09-25', endTime: '01:00' },
    { id: 'a-2', employeeId: 'bia', employee: { id: 'bia', name: 'Bia' }, startDate: '2026-09-24', startTime: '17:00', endDate: '2026-09-25', endTime: '00:30' },
  ] }
  render(<I18nProvider><ShiftGroupDialog initial={initial} defaultDate="2026-09-24" hours={[]} employees={[{ id: 'ana', name: 'Ana' }, { id: 'bia', name: 'Bia' }]} initialEmployeeIds={[]} onClose={() => {}} onSaved={() => {}} /></I18nProvider>)
  const dialog = screen.getByRole('dialog')
  fireEvent.change(within(dialog).getByLabelText('Data inicial'), { target: { value: '2026-10-01' } })
  expect(within(dialog).getByLabelText('Data de entrada de Bia')).toHaveValue('2026-10-01')
  expect(within(dialog).getByLabelText('Data de saída de Bia')).toHaveValue('2026-10-02')
  await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar turno' })) })
  expect(api.put).toHaveBeenCalledWith('/calendar/shifts/shift-1', expect.objectContaining({ startDate: '2026-10-01', endDate: '2026-10-02', members: [
    { employeeId: 'ana' },
    { employeeId: 'bia', startDate: '2026-10-01', startTime: '17:00', endDate: '2026-10-02', endTime: '00:30' },
  ] }))
})
