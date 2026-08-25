import { beforeEach, describe, it, expect, vi } from 'bun:test'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider } from '@/i18n/provider'
import { i18n } from '@/i18n/config'
import { StatusSelect } from './status-select'

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nProvider>{ui}</I18nProvider>)
}

describe('StatusSelect', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('pt-BR')
  })

  it('shows the current status label', () => {
    renderWithI18n(<StatusSelect value="IN_PREPARATION" onValueChange={vi.fn()} />)
    expect(screen.getByText('Em preparo')).toBeInTheDocument()
  })

  it('applies the status color as the trigger border color', () => {
    renderWithI18n(<StatusSelect value="OPEN" onValueChange={vi.fn()} />)
    const trigger = screen.getByRole('combobox')
    expect(trigger).toHaveStyle({ borderColor: '#dc2626' })
  })

  it('calls onValueChange with the new status when an option is picked', async () => {
    const onValueChange = vi.fn()
    const user = userEvent.setup()
    renderWithI18n(<StatusSelect value="OPEN" onValueChange={onValueChange} />)
    await user.click(screen.getByRole('combobox'))
    await user.click(await screen.findByRole('option', { name: 'Em preparo' }))
    expect(onValueChange).toHaveBeenCalledWith('IN_PREPARATION')
  })

  it('is disabled when disabled=true', () => {
    renderWithI18n(<StatusSelect value="CLOSED" onValueChange={vi.fn()} disabled />)
    expect(screen.getByRole('combobox')).toBeDisabled()
  })
})
