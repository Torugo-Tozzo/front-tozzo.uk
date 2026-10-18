import { fireEvent, render, screen, within } from '@solidjs/testing-library'
import { expect, it } from 'vitest'

import { i18n } from '@/i18n/config'
import EmployeeFilterDialog from './EmployeeFilterDialog'

it('searches employees and displays one employee at a time', async () => {
  await i18n.changeLanguage('pt-BR')
  const applied: { id: string | null } = { id: null }
  render(() => <EmployeeFilterDialog employees={[{ id: 'ana', name: 'Ana' }, { id: 'bia', name: 'Bia' }, { id: 'joao', name: 'João' }]} selectedId={null} onApply={(id) => { applied.id = id }} />)
  fireEvent.click(screen.getByRole('button', { name: 'Filtrar por Funcionário' }))
  const dialog = await screen.findByRole('dialog')
  fireEvent.input(within(dialog).getByPlaceholderText('Buscar funcionário'), { target: { value: 'joao' } })
  expect(within(dialog).getByLabelText('João')).toBeInTheDocument()
  expect(within(dialog).queryByLabelText('Bia')).not.toBeInTheDocument()
  fireEvent.click(within(dialog).getByLabelText('João'))
  fireEvent.input(within(dialog).getByPlaceholderText('Buscar funcionário'), { target: { value: 'Bia' } })
  fireEvent.click(within(dialog).getByLabelText('Bia'))
  fireEvent.click(within(dialog).getByRole('button', { name: 'Aplicar filtro' }))
  expect(applied.id).toBe('bia')
})
