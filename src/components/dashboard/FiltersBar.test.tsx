import { describe, it, expect, beforeEach, vi } from 'bun:test'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider } from '@/i18n/provider'
import { i18n } from '@/i18n/config'
import { FiltersBar } from './FiltersBar'

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nProvider>{ui}</I18nProvider>)
}

describe('FiltersBar', () => {
  beforeEach(async () => {
    await act(async () => {
      await i18n.changeLanguage('en')
    })
  })

  it('renders translated filter chrome and placeholders', () => {
    renderWithI18n(
      <FiltersBar
        dateRange={{
          startDate: '', startTime: '', endDate: '', endTime: '',
          onStartDateChange: vi.fn(), onStartTimeChange: vi.fn(), onEndDateChange: vi.fn(), onEndTimeChange: vi.fn(),
        }}
        status={{ value: 'NOT_CLOSED', onChange: vi.fn(), options: [{ value: 'NOT_CLOSED', label: 'Not closed' }] }}
        customerName={{ value: '', onChange: vi.fn() }}
        createdBy={{ value: '', onChange: vi.fn() }}
        totalRange={{ min: '', max: '', onMinChange: vi.fn(), onMaxChange: vi.fn() }}
        onFilter={vi.fn()}
      />,
    )

    expect(screen.getByText('Filters')).toBeInTheDocument()
    expect(screen.getByLabelText('Start date')).toBeInTheDocument()
    expect(screen.getByLabelText('Start time')).toBeInTheDocument()
    expect(screen.getByLabelText('End date')).toBeInTheDocument()
    expect(screen.getByLabelText('End time')).toBeInTheDocument()
    expect(screen.getByLabelText('Status')).toBeInTheDocument()
    expect(screen.getByLabelText('Customer / Table')).toHaveAttribute('placeholder', 'Search customer/table...')
    expect(screen.getByLabelText('Created by')).toHaveAttribute('placeholder', 'Search employee...')
    expect(screen.getByLabelText('Minimum total')).toBeInTheDocument()
    expect(screen.getByLabelText('Maximum total')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Search' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Expand filters' })).toBeInTheDocument()
  })

  it('renders only the sections whose props are provided', () => {
    renderWithI18n(
      <FiltersBar
        customerName={{ value: '', onChange: vi.fn() }}
        totalRange={{ min: '', max: '', onMinChange: vi.fn(), onMaxChange: vi.fn() }}
        onFilter={vi.fn()}
      />
    )
    expect(screen.getByLabelText('Customer / Table')).toBeInTheDocument()
    expect(screen.getByLabelText('Minimum total')).toBeInTheDocument()
    expect(screen.getByLabelText('Maximum total')).toBeInTheDocument()
    expect(screen.queryByLabelText('Start date')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Created by')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^New/ })).not.toBeInTheDocument()
  })

  it('calls onFilter when the Buscar button is clicked', async () => {
    const onFilter = vi.fn()
    const user = userEvent.setup()
    renderWithI18n(<FiltersBar customerName={{ value: '', onChange: vi.fn() }} onFilter={onFilter} />)
    await user.click(screen.getByRole('button', { name: /search/i }))
    expect(onFilter).toHaveBeenCalledTimes(1)
  })

  it('calls the field onChange handler when typing', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    renderWithI18n(<FiltersBar customerName={{ value: '', onChange }} onFilter={vi.fn()} />)
    await user.type(screen.getByLabelText('Customer / Table'), 'a')
    expect(onChange).toHaveBeenCalledWith('a')
  })

  it('disables inputs and the button while isLoading', () => {
    renderWithI18n(<FiltersBar customerName={{ value: '', onChange: vi.fn() }} onFilter={vi.fn()} isLoading />)
    expect(screen.getByLabelText('Customer / Table')).toBeDisabled()
    expect(screen.getByRole('button', { name: /search/i })).toBeDisabled()
  })

  it('renders the date range before the status field', () => {
    renderWithI18n(
      <FiltersBar
        status={{ value: 'NOT_CLOSED', onChange: vi.fn(), options: [{ value: 'NOT_CLOSED', label: 'Não Fechados' }] }}
        dateRange={{
          startDate: '', startTime: '', endDate: '', endTime: '',
          onStartDateChange: vi.fn(), onStartTimeChange: vi.fn(), onEndDateChange: vi.fn(), onEndTimeChange: vi.fn(),
        }}
        onFilter={vi.fn()}
      />
    )
    const labels = screen.getAllByText(/Start date|Start time|End date|End time|Status/)
    expect(labels.map((l) => l.textContent)).toEqual(['Start date', 'Start time', 'End date', 'End time', 'Status'])
  })

  it('masks total range input as cents (typed digits become the decimals)', async () => {
    const onMinChange = vi.fn()
    const user = userEvent.setup()
    renderWithI18n(
      <FiltersBar
        totalRange={{ min: '', max: '', onMinChange, onMaxChange: vi.fn() }}
        onFilter={vi.fn()}
      />
    )
    await user.type(screen.getByLabelText('Minimum total'), '6')
    expect(onMinChange).toHaveBeenLastCalledWith('0.06')
  })

  it('renders the primary action button and calls its onClick', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    renderWithI18n(
      <FiltersBar
        customerName={{ value: '', onChange: vi.fn() }}
        primaryAction={{ label: 'New order', onClick }}
        onFilter={vi.fn()}
      />
    )
    const button = screen.getByRole('button', { name: 'New order' })
    await user.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('toggles the mobile filter panel via the expand/collapse button', async () => {
    const user = userEvent.setup()
    renderWithI18n(<FiltersBar customerName={{ value: '', onChange: vi.fn() }} onFilter={vi.fn()} />)

    const toggle = screen.getByRole('button', { name: 'Expand filters' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByLabelText('Customer / Table').closest('.hidden')).not.toBeNull()

    await user.click(toggle)

    expect(screen.getByRole('button', { name: 'Collapse filters' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByLabelText('Customer / Table').closest('.hidden')).toBeNull()
  })
})
