import { describe, it, expect, vi } from 'bun:test'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StatusSelect } from './status-select'

describe('StatusSelect', () => {
  it('shows the current status label', () => {
    render(<StatusSelect value="IN_PREPARATION" onValueChange={vi.fn()} />)
    expect(screen.getByText('Em Preparo')).toBeInTheDocument()
  })

  it('applies the status color as the trigger border color', () => {
    render(<StatusSelect value="OPEN" onValueChange={vi.fn()} />)
    const trigger = screen.getByRole('combobox')
    expect(trigger).toHaveStyle({ borderColor: '#dc2626' })
  })

  it('calls onValueChange with the new status when an option is picked', async () => {
    const onValueChange = vi.fn()
    const user = userEvent.setup()
    render(<StatusSelect value="OPEN" onValueChange={onValueChange} />)
    await user.click(screen.getByRole('combobox'))
    await user.click(await screen.findByRole('option', { name: 'Em Preparo' }))
    expect(onValueChange).toHaveBeenCalledWith('IN_PREPARATION')
  })

  it('is disabled when disabled=true', () => {
    render(<StatusSelect value="CLOSED" onValueChange={vi.fn()} disabled />)
    expect(screen.getByRole('combobox')).toBeDisabled()
  })
})
