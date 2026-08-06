import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FiltersBar } from './FiltersBar'

describe('FiltersBar', () => {
  it('renders only the sections whose props are provided', () => {
    render(
      <FiltersBar
        cliente={{ value: '', onChange: vi.fn() }}
        totalRange={{ min: '', max: '', onMinChange: vi.fn(), onMaxChange: vi.fn() }}
        onFilter={vi.fn()}
      />
    )
    expect(screen.getByLabelText('Cliente / Mesa')).toBeInTheDocument()
    expect(screen.getByLabelText('Total mínimo')).toBeInTheDocument()
    expect(screen.getByLabelText('Total máximo')).toBeInTheDocument()
    expect(screen.queryByLabelText('Data Inicial')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Criado por')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Nome')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Preço mínimo')).not.toBeInTheDocument()
  })

  it('calls onFilter when the Filtrar button is clicked', async () => {
    const onFilter = vi.fn()
    const user = userEvent.setup()
    render(<FiltersBar cliente={{ value: '', onChange: vi.fn() }} onFilter={onFilter} />)
    await user.click(screen.getByRole('button', { name: /filtrar/i }))
    expect(onFilter).toHaveBeenCalledTimes(1)
  })

  it('calls the field onChange handler when typing', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<FiltersBar cliente={{ value: '', onChange }} onFilter={vi.fn()} />)
    await user.type(screen.getByLabelText('Cliente / Mesa'), 'a')
    expect(onChange).toHaveBeenCalledWith('a')
  })

  it('disables inputs and the button while isLoading', () => {
    render(<FiltersBar cliente={{ value: '', onChange: vi.fn() }} onFilter={vi.fn()} isLoading />)
    expect(screen.getByLabelText('Cliente / Mesa')).toBeDisabled()
    expect(screen.getByRole('button', { name: /filtrar/i })).toBeDisabled()
  })
})
