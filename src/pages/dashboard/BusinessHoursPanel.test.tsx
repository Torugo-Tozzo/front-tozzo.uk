import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'bun:test'
import { I18nProvider } from '@/i18n/provider'
import { i18n } from '@/i18n/config'
import api from '@/services/api'
import { replaceProperty } from '@/test/replace-property'
import BusinessHoursPanel from './BusinessHoursPanel'

const restores: (() => void)[] = []
afterEach(() => { while (restores.length) restores.pop()?.() })

test('shows opening hours separately and applies a shared schedule with day exceptions', async () => {
  await act(async () => { await i18n.changeLanguage('pt-BR') })
  restores.push(replaceProperty(api, 'put', vi.fn().mockResolvedValue({ data: { hours: [] } }) as typeof api.put))
  const onSaved = vi.fn()
  render(<I18nProvider><BusinessHoursPanel hours={[{ daysOfWeek: [1, 2, 3, 4, 5, 6], startTime: '11:00', endTime: '23:00' }]} canManage onSaved={onSaved} /></I18nProvider>)
  expect(screen.getByRole('heading', { name: 'Funcionamento' })).toBeInTheDocument()
  expect(screen.queryByLabelText('Abertura padrão')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Editar funcionamento' }))
  const dialog = screen.getByRole('dialog')
  fireEvent.change(within(dialog).getByLabelText('Abertura padrão'), { target: { value: '12:00' } })
  fireEvent.click(within(dialog).getByLabelText('sábado: Aberto'))
  fireEvent.click(within(dialog).getByLabelText('Personalizar segunda-feira'))
  fireEvent.change(within(dialog).getByLabelText('segunda-feira Fechamento'), { target: { value: '21:00' } })
  await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar funcionamento' })) })
  const payload = (api.put as ReturnType<typeof vi.fn>).mock.calls[0][1] as { hours: { daysOfWeek: number[]; startTime: string; endTime: string }[] }
  expect(payload.hours).toHaveLength(5)
  expect(payload.hours).toContainEqual({ daysOfWeek: [1], startTime: '11:00', endTime: '21:00' })
  expect(payload.hours).toContainEqual({ daysOfWeek: [2], startTime: '12:00', endTime: '23:00' })
  expect(onSaved).toHaveBeenCalled()
})
