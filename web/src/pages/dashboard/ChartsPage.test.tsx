import { Route } from '@solidjs/router'
import { screen, waitFor, within } from '@solidjs/testing-library'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { i18n } from '@/i18n/config'
import { json, mockApi, problem, type RecordedCall } from '@/test/api'
import { resetAuthMocks, setMockUser } from '@/test/auth-mock'
import { renderDashboard } from '@/test/dashboard'
import ChartsPage from './ChartsPage'
vi.mock('@/contexts/AuthContext', () => import('@/test/auth-mock'))
// Actual chart rendering is exercised in Playwright; no canvas in this DOM.
vi.mock('@/components/reports/echarts-runtime', () => ({ init: () => ({ setOption() {}, resize() {}, dispose() {} }) }))
const top = { products: [{ id: 'p1', name: 'Burger', quantity: 4, revenueCents: 12345 }], others: null, totals: { revenueCents: 22345, units: 7, salesCount: 3 } }
const row = { id: 'p1', name: 'Burger', quantity: 4, revenueCents: 12345, unitPriceCents: 3000, productType: { id: 't1', description: 'Food' } }
let calls: RecordedCall[]
let failure: string | undefined
const renderPage = () => renderDashboard('/dashboard/charts', () => <><Route path="/dashboard/charts" component={ChartsPage}/><Route path="/dashboard" component={() => <p>Dashboard home</p>}/></>)
beforeEach(async () => {
  resetAuthMocks(); setMockUser({ role: 'MANAGER' }); failure = undefined
  await i18n.changeLanguage('en')
  calls = mockApi(({ path, query, method }) => {
    if (path === '/v1/product-types') return json(200, [{ id: 't1', description: 'Food' }])
    if (failure) return problem(403, failure)
    if (path === '/v1/reports/top-products') return json(200, top)
    if (path === '/v1/reports/products') return json(200, { items: [{ ...row, name: query.get('cursor') ? 'Second product' : 'Burger' }], total: 11, nextCursor: query.get('cursor') ? null : 'next' })
    if (path === '/v1/reports/sales-by-hour') return json(200, { hours: Array.from({ length: 24 }, (_, hour) => ({ hour, salesCount: hour === 12 ? 1 : 0, revenueCents: hour === 12 ? 12345 : 0 })), sales: [{ id: 's1', customerName: 'Jo', soldAt: '2026-10-01T15:00:00Z', totalCents: 12345 }] })
    if (method === 'POST') return json(202, { id: 'job', status: 'pending' })
    return undefined
  }).calls
})
afterEach(() => vi.unstubAllGlobals())
it.each(['PLAN_UPGRADE_REQUIRED', 'REPORT_QUOTA_EXCEEDED'])('ports the React paywall test: %s', async code => {
  failure = code; renderPage()
  expect(await screen.findByRole('alert')).toHaveTextContent(code === 'PLAN_UPGRADE_REQUIRED' ? 'This feature is only available on paid plans.' : 'You have reached your monthly report limit.')
})
it('redirects employees before mounting report queries', async () => {
  setMockUser({ role: 'EMPLOYEE' }); renderPage()
  expect(await screen.findByText('Dashboard home')).toBeInTheDocument()
  expect(calls).toHaveLength(0)
})
it('shows full totals rather than only the ranking and formats table revenue in cents', async () => {
  renderPage()
  const table = await screen.findByRole('table')
  expect(await within(table).findByText('Burger')).toBeInTheDocument()
  expect(within(table).getByText(/123.45/)).toBeInTheDocument()
  expect(screen.getByText(/223.45/)).toBeInTheDocument()
  expect(screen.queryByText('Suspended')).toBeNull()
})
it('uses cursors and only applies edited filters when Search is clicked, resetting the page', async () => {
  const user = userEvent.setup(); renderPage()
  await screen.findByText('Burger')
  await user.click(screen.getByRole('button', { name: 'Next' }))
  await screen.findByText('Second product')
  const input = screen.getByLabelText('Start date')
  const before = calls.filter(c => c.path.endsWith('/products')).length
  await user.clear(input); await user.type(input, '2026-09-01')
  expect(calls.filter(c => c.path.endsWith('/products'))).toHaveLength(before)
  await user.click(screen.getByRole('button', { name: 'Search' }))
  await screen.findByText('Burger')
  expect(screen.getByText('Page 1 of 2')).toBeInTheDocument()
  expect(calls.filter(c => c.path.endsWith('/products')).at(-1)?.query.has('cursor')).toBe(false)
  expect(calls.filter(c => c.path.endsWith('/products')).at(-1)?.query.get('from')).toBe(new Date('2026-09-01T00:00:00').toISOString())
})
it('navigates hourly days and restarts at the first day for a new search', async () => {
  const user = userEvent.setup(); renderPage()
  await screen.findByText('Burger')
  await user.click(screen.getByRole('tab', { name: 'Sales by hour' }))
  await user.clear(screen.getByLabelText('Start date')); await user.type(screen.getByLabelText('Start date'), '2026-10-01')
  await user.clear(screen.getByLabelText('End date')); await user.type(screen.getByLabelText('End date'), '2026-10-03')
  await user.click(screen.getByRole('button', { name: 'Search' }))
  await user.click(screen.getByRole('button', { name: 'Next' }))
  await waitFor(() => expect(calls.filter(c => c.path.endsWith('/sales-by-hour')).at(-1)?.query.get('date')).toBe('2026-10-02'))
  await user.click(screen.getByRole('button', { name: 'Search' }))
  await waitFor(() => expect(calls.filter(c => c.path.endsWith('/sales-by-hour')).at(-1)?.query.get('date')).toBe('2026-10-01'))
  expect(calls.filter(c => c.path.endsWith('/sales-by-hour')).at(-1)?.query.get('tzOffsetMinutes')).toBe('-180')
})
it('captures the filters and locale when exporting and prevents duplicate submissions', async () => {
  const user = userEvent.setup(); renderPage(); await screen.findByText('Burger')
  await user.dblClick(screen.getByRole('button', { name: 'Generate Excel' }))
  await waitFor(() => expect(calls.filter(c => c.method === 'POST')).toHaveLength(1))
  expect(calls.find(c => c.method === 'POST')?.body).toMatchObject({ format: 'xlsx', locale: 'en', tzOffsetMinutes: -180 })
  expect(screen.getByRole('button', { name: 'Generate PDF' })).toBeDisabled()
})

it('does not present cached totals, chart or detail as current after a failed refetch', async () => {
  const user = userEvent.setup(); renderPage()
  await screen.findByText(/223.45/)
  failure = 'REPORT_QUERY_INVALID'
  await user.click(screen.getByRole('button', { name: 'Search' }))
  await waitFor(() => expect(screen.queryByText(/223.45/)).toBeNull())
  expect(screen.queryByText('Burger')).toBeNull()
  expect(screen.queryByRole('img', { name: 'Sales visualization' })).toBeNull()
})
