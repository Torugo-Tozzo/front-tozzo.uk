import { describe, it, expect, vi } from 'bun:test'
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
    expect(screen.queryByRole('button', { name: /^Novo/ })).not.toBeInTheDocument()
  })

  it('calls onFilter when the Buscar button is clicked', async () => {
    const onFilter = vi.fn()
    const user = userEvent.setup()
    render(<FiltersBar cliente={{ value: '', onChange: vi.fn() }} onFilter={onFilter} />)
    await user.click(screen.getByRole('button', { name: /buscar/i }))
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
    expect(screen.getByRole('button', { name: /buscar/i })).toBeDisabled()
  })

  it('renders the date range before the status field', () => {
    render(
      <FiltersBar
        status={{ value: 'NAO_FECHADOS', onChange: vi.fn(), options: [{ value: 'NAO_FECHADOS', label: 'Não Fechados' }] }}
        dateRange={{
          startDate: '', startTime: '', endDate: '', endTime: '',
          onStartDateChange: vi.fn(), onStartTimeChange: vi.fn(), onEndDateChange: vi.fn(), onEndTimeChange: vi.fn(),
        }}
        onFilter={vi.fn()}
      />
    )
    const labels = screen.getAllByText(/Data Inicial|Hora Inicial|Data Final|Hora Final|Status/)
    expect(labels.map((l) => l.textContent)).toEqual(['Data Inicial', 'Hora Inicial', 'Data Final', 'Hora Final', 'Status'])
  })

  it('masks total range input as cents (typed digits become the decimals)', async () => {
    const onMinChange = vi.fn()
    const user = userEvent.setup()
    render(
      <FiltersBar
        totalRange={{ min: '', max: '', onMinChange, onMaxChange: vi.fn() }}
        onFilter={vi.fn()}
      />
    )
    await user.type(screen.getByLabelText('Total mínimo'), '6')
    expect(onMinChange).toHaveBeenLastCalledWith('0.06')
  })

  it('renders the primary action button and calls its onClick', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(
      <FiltersBar
        cliente={{ value: '', onChange: vi.fn() }}
        primaryAction={{ label: 'Novo Pedido', onClick }}
        onFilter={vi.fn()}
      />
    )
    const button = screen.getByRole('button', { name: 'Novo Pedido' })
    await user.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('toggles the mobile filter panel via the expand/collapse button', async () => {
    const user = userEvent.setup()
    render(<FiltersBar cliente={{ value: '', onChange: vi.fn() }} onFilter={vi.fn()} />)

    const toggle = screen.getByRole('button', { name: 'Expandir filtros' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByLabelText('Cliente / Mesa').closest('.hidden')).not.toBeNull()

    await user.click(toggle)

    expect(screen.getByRole('button', { name: 'Recolher filtros' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByLabelText('Cliente / Mesa').closest('.hidden')).toBeNull()
  })
})
