import { render, screen } from '@solidjs/testing-library'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n/config'
import { I18nProvider } from '@/i18n/solid'
import { FiltersBar, type FiltersBarProps } from './FiltersBar'

const renderBar = (props: FiltersBarProps) => render(() => <I18nProvider><FiltersBar {...props} /></I18nProvider>)
const dateRange = () => ({
  startDate: '', startTime: '', endDate: '', endTime: '',
  onStartDateChange: vi.fn(), onStartTimeChange: vi.fn(), onEndDateChange: vi.fn(), onEndTimeChange: vi.fn(),
})

describe('FiltersBar', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
  })

  it('renders translated filter chrome and placeholders', () => {
    renderBar({
      dateRange: dateRange(),
      status: { value: 'REQUESTED', onChange: vi.fn(), options: [{ value: 'REQUESTED', label: 'Requested' }] },
      customerName: { value: '', onChange: vi.fn() },
      createdBy: { value: '', onChange: vi.fn() },
      totalRange: { min: '', max: '', onMinChange: vi.fn(), onMaxChange: vi.fn() },
      onFilter: vi.fn(),
    })

    expect(screen.getByText('Filters')).toBeInTheDocument()
    expect(screen.getByLabelText('Start date')).toBeInTheDocument()
    expect(screen.getByLabelText('Start time')).toBeInTheDocument()
    expect(screen.getByLabelText('End date')).toBeInTheDocument()
    expect(screen.getByLabelText('End time')).toBeInTheDocument()
    // Kobalte names the trigger by its label and its value.
    expect(screen.getByRole('button', { name: /^Status/ })).toHaveTextContent('Requested')
    expect(screen.getByLabelText('Customer / Table')).toHaveAttribute('placeholder', 'Search customer/table...')
    expect(screen.getByLabelText('Created by')).toHaveAttribute('placeholder', 'Search employee...')
    expect(screen.getByLabelText('Minimum total')).toBeInTheDocument()
    expect(screen.getByLabelText('Maximum total')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Search' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Expand filters' })).toBeInTheDocument()
  })

  it('localizes monetary input placeholders', async () => {
    await i18n.changeLanguage('pt-BR')
    renderBar({ totalRange: { min: '', max: '', onMinChange: vi.fn(), onMaxChange: vi.fn() }, onFilter: vi.fn() })

    const totalInputs = screen.getAllByRole('textbox')
    expect(totalInputs[0].getAttribute('placeholder')).toBe('0,00')
    expect(totalInputs[1].getAttribute('placeholder')).toBe('0,00')
  })

  it('renders only the sections whose props are provided', () => {
    renderBar({
      customerName: { value: '', onChange: vi.fn() },
      totalRange: { min: '', max: '', onMinChange: vi.fn(), onMaxChange: vi.fn() },
      onFilter: vi.fn(),
    })
    expect(screen.getByLabelText('Customer / Table')).toBeInTheDocument()
    expect(screen.getByLabelText('Minimum total')).toBeInTheDocument()
    expect(screen.getByLabelText('Maximum total')).toBeInTheDocument()
    expect(screen.queryByLabelText('Start date')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Created by')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^New/ })).not.toBeInTheDocument()
  })

  it('calls onFilter when the Search button is clicked', async () => {
    const onFilter = vi.fn()
    const user = userEvent.setup()
    renderBar({ customerName: { value: '', onChange: vi.fn() }, onFilter })
    await user.click(screen.getByRole('button', { name: /search/i }))
    expect(onFilter).toHaveBeenCalledTimes(1)
  })

  it('calls the field onChange handler when typing', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    renderBar({ customerName: { value: '', onChange }, onFilter: vi.fn() })
    await user.type(screen.getByLabelText('Customer / Table'), 'a')
    expect(onChange).toHaveBeenCalledWith('a')
  })

  it('disables inputs and the button while isLoading', () => {
    renderBar({ customerName: { value: '', onChange: vi.fn() }, onFilter: vi.fn(), isLoading: true })
    expect(screen.getByLabelText('Customer / Table')).toBeDisabled()
    expect(screen.getByRole('button', { name: /search/i })).toBeDisabled()
  })

  it('renders the date range before the status field', () => {
    renderBar({
      status: { value: 'REQUESTED', onChange: vi.fn(), options: [{ value: 'REQUESTED', label: 'Requested' }] },
      dateRange: dateRange(),
      onFilter: vi.fn(),
    })
    const labels = screen.getAllByText(/^(Start date|Start time|End date|End time|Status)$/)
    expect(labels.map((label) => label.textContent)).toEqual(['Start date', 'Start time', 'End date', 'End time', 'Status'])
  })

  it('masks total range input as cents (typed digits become the decimals)', async () => {
    const onMinChange = vi.fn()
    const user = userEvent.setup()
    renderBar({ totalRange: { min: '', max: '', onMinChange, onMaxChange: vi.fn() }, onFilter: vi.fn() })
    await user.type(screen.getByLabelText('Minimum total'), '6')
    expect(onMinChange).toHaveBeenLastCalledWith('0.06')
  })

  it('a total field with no digits is empty, not "0.00"', async () => {
    const onMinChange = vi.fn()
    const user = userEvent.setup()
    renderBar({ totalRange: { min: '', max: '', onMinChange, onMaxChange: vi.fn() }, onFilter: vi.fn() })
    const min = screen.getByLabelText('Minimum total')
    await user.type(min, '12')
    expect(onMinChange).toHaveBeenLastCalledWith('0.12')
    await user.clear(min)
    expect(onMinChange).toHaveBeenLastCalledWith('')
    expect(min).toHaveValue('')
  })

  it('picks a status option', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    renderBar({
      status: { value: 'OPEN', onChange, options: [{ value: 'OPEN', label: 'Open' }, { value: 'CLOSED', label: 'Closed' }] },
      onFilter: vi.fn(),
    })
    await user.click(screen.getByRole('button', { name: /^Status/ }))
    await user.click(await screen.findByRole('option', { name: 'Closed' }))
    expect(onChange).toHaveBeenCalledWith('CLOSED')
  })

  it('renders the primary action button and calls its onClick', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    renderBar({ customerName: { value: '', onChange: vi.fn() }, primaryAction: { label: 'New order', onClick }, onFilter: vi.fn() })
    await user.click(screen.getByRole('button', { name: 'New order' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('toggles the mobile filter panel via the expand/collapse button', async () => {
    const user = userEvent.setup()
    renderBar({ customerName: { value: '', onChange: vi.fn() }, onFilter: vi.fn() })

    const toggle = screen.getByRole('button', { name: 'Expand filters' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByLabelText('Customer / Table').closest('.hidden')).not.toBeNull()

    await user.click(toggle)

    expect(screen.getByRole('button', { name: 'Collapse filters' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByLabelText('Customer / Table').closest('.hidden')).toBeNull()
  })
})
