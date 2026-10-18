import { beforeEach, describe, it, expect, vi } from 'vitest'
import { render, screen } from '@solidjs/testing-library'
import userEvent from '@testing-library/user-event'
import type { JSX } from 'solid-js'
import { I18nProvider } from '@/i18n/solid'
import { i18n } from '@/i18n/config'
import { StatusSelect } from './status-select'

function renderWithI18n(ui: () => JSX.Element) {
  return render(() => <I18nProvider>{ui()}</I18nProvider>)
}

describe('StatusSelect', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('pt-BR')
  })

  it('shows the current status label', () => {
    renderWithI18n(() => <StatusSelect value="IN_PREPARATION" onValueChange={vi.fn()} />)
    expect(screen.getByText('Em preparo')).toBeInTheDocument()
  })

  it('normalizes the legacy requested value and offers preparation, ready and delivered', async () => {
    const user = userEvent.setup()
    renderWithI18n(() => <StatusSelect value="REQUESTED" onValueChange={vi.fn()} />)

    await user.click(screen.getByRole('button'))

    expect(await screen.findByRole('option', { name: 'Em preparo' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Solicitado' })).not.toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Pronto' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Entregue' })).toBeInTheDocument()
  })

  it('calls onValueChange with the new status when an option is picked', async () => {
    const onValueChange = vi.fn()
    const user = userEvent.setup()
    renderWithI18n(() => <StatusSelect value="READY" onValueChange={onValueChange} />)
    await user.click(screen.getByRole('button'))
    await user.click(await screen.findByRole('option', { name: 'Em preparo' }))
    expect(onValueChange).toHaveBeenCalledWith('IN_PREPARATION')
  })

  it('is disabled when disabled=true', () => {
    renderWithI18n(() => <StatusSelect value="DELIVERED" onValueChange={vi.fn()} disabled />)
    expect(screen.getByRole('button')).toBeDisabled()
  })
})
