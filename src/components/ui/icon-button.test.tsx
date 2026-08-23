import { describe, it, expect, vi } from 'bun:test'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Trash2 } from 'lucide-react'
import { IconButton } from './icon-button'

describe('IconButton', () => {
  it('renders the icon and exposes an accessible label', () => {
    render(<IconButton icon={<Trash2 data-testid="icon" />} label="Excluir pedido" />)
    expect(screen.getByRole('button', { name: 'Excluir pedido' })).toBeInTheDocument()
    expect(screen.getByTestId('icon')).toBeInTheDocument()
  })

  it('fires onClick when enabled', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(<IconButton icon={<Trash2 />} label="Excluir" onClick={onClick} />)
    await user.click(screen.getByRole('button', { name: 'Excluir' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('does not fire onClick when disabled', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(<IconButton icon={<Trash2 />} label="Excluir" onClick={onClick} disabled />)
    await user.click(screen.getByRole('button', { name: 'Excluir' }))
    expect(onClick).not.toHaveBeenCalled()
  })
})
