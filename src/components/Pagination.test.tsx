import { render, screen } from '@solidjs/testing-library'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n/config'
import { Pagination } from './Pagination'

describe('Pagination', () => {
  beforeEach(async () => { await i18n.changeLanguage('en') })

  it('renders locale-aware chrome and accessible navigation labels', () => {
    render(() => <Pagination currentPage={2} totalPages={4} hasMore onPageChange={() => {}} pageSize={10} onPageSizeChange={() => {}} />)
    expect(screen.getByText('Rows per page')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Rows per page/ })).toHaveTextContent('10')
    expect(screen.getByText('Page 2 of 4')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled()
  })

  it('moves one page and changes the page size', async () => {
    const onPageChange = vi.fn()
    const onPageSizeChange = vi.fn()
    const user = userEvent.setup()
    render(() => <Pagination currentPage={2} totalPages={4} onPageChange={onPageChange} pageSize={10} onPageSizeChange={onPageSizeChange} />)
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await user.click(screen.getByRole('button', { name: 'Previous' }))
    expect(onPageChange.mock.calls).toEqual([[3], [1]])
    await user.click(screen.getByRole('button', { name: /^Rows per page/ }))
    await user.click(await screen.findByRole('option', { name: '35' }))
    expect(onPageSizeChange).toHaveBeenCalledWith(35)
  })

  it('shows only the page without a total, and disables the ends', () => {
    render(() => <Pagination currentPage={1} totalPages={0} hasMore={false} onPageChange={() => {}} pageSize={10} onPageSizeChange={() => {}} />)
    expect(screen.getByText('Page 1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
  })

  it('disables everything while loading', () => {
    render(() => <Pagination currentPage={2} totalPages={4} onPageChange={() => {}} pageSize={10} onPageSizeChange={() => {}} isLoading />)
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()
  })
})
