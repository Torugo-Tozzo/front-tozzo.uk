import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { expect, test } from 'bun:test'
import { I18nProvider } from '@/i18n/provider'
import { i18n } from '@/i18n/config'
import EmployeeFilterDialog from './EmployeeFilterDialog'

test('searches employees and displays one employee at a time', async () => {
  await act(async () => { await i18n.changeLanguage('pt-BR') })
  const applied: { id: string | null } = { id: null }
  render(<I18nProvider><EmployeeFilterDialog employees={[{ id: 'ana', name: 'Ana' }, { id: 'bia', name: 'Bia' }, { id: 'joao', name: 'João' }]} selectedId={null} onApply={id => { applied.id = id }} /></I18nProvider>)
  fireEvent.click(screen.getByRole('button', { name: 'Filtrar por Funcionário' }))
  const dialog = screen.getByRole('dialog')
  fireEvent.change(within(dialog).getByPlaceholderText('Buscar funcionário'), { target: { value: 'joao' } })
  expect(within(dialog).getByLabelText('João')).toBeInTheDocument()
  expect(within(dialog).queryByLabelText('Bia')).not.toBeInTheDocument()
  fireEvent.click(within(dialog).getByLabelText('João'))
  fireEvent.change(within(dialog).getByPlaceholderText('Buscar funcionário'), { target: { value: 'Bia' } })
  fireEvent.click(within(dialog).getByLabelText('Bia'))
  fireEvent.click(within(dialog).getByRole('button', { name: 'Aplicar filtro' }))
  expect(applied.id).toBe('bia')
})
