import { Route } from '@solidjs/router'
import { screen, waitFor } from '@solidjs/testing-library'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { toast } from 'solid-sonner'
import { i18n } from '@/i18n/config'
import { json, mockApi, problem } from '@/test/api'
import { resetAuthMocks, setMockUser } from '@/test/auth-mock'
import { renderDashboard } from '@/test/dashboard'
import PlanSelectionPage from './PlanSelectionPage'
vi.mock('@/contexts/AuthContext', () => import('@/test/auth-mock'))
const establishment = { id: 'e1', tradeName: 'Cafe', status: 'PENDING_PAYMENT' as const, plan: 'FREE' as const, category: null, preferencesRevision: 1 }
const renderPage = () => renderDashboard('/plan', () => <><Route path="/plan" component={PlanSelectionPage}/><Route path="/dashboard" component={() => <p>Dashboard page</p>} /></>)
beforeEach(async () => { toast.dismiss(); resetAuthMocks(); setMockUser({ role: 'OWNER', establishment }); await i18n.changeLanguage('en') })
afterEach(() => vi.unstubAllGlobals())
it('ports the React three-tier pricing test', () => {
  renderPage()
  expect(screen.getByText(/14.90/)).toBeVisible(); expect(screen.getByText(/79.90/)).toBeVisible(); expect(screen.getByText(/R\$\s?0/)).toBeVisible()
})
it.each([['monthly', 'PAID'], ['annual', 'PAID'], ['monthly', 'ENTERPRISE']] as const)('ports checkout %s/%s through the Go contract', async (interval, plan) => {
  const navigation = vi.spyOn(window.location, 'assign').mockImplementation(() => {})
  const mock = mockApi(() => json(200, { url: 'https://checkout.stripe.com/x' }))
  const user = userEvent.setup(); renderPage()
  if (interval === 'annual') await user.click(screen.getByRole('button', { name: 'Annual' }))
  await user.click(screen.getByRole('button', { name: plan === 'ENTERPRISE' ? /subscribe.*enterprise/i : interval === 'annual' ? /subscribe annually/i : /subscribe monthly/i }))
  await waitFor(() => expect(navigation).toHaveBeenCalledWith('https://checkout.stripe.com/x'))
  expect(mock.calls[0]).toMatchObject({ path: '/v1/billing/checkout', body: { plan, interval } })
})
it('ports Free continuation and allows the free dashboard without a billing write', async () => {
  setMockUser({ role: 'OWNER', establishment: { ...establishment, status: 'ACTIVE' } })
  const mock = mockApi(() => undefined); const user = userEvent.setup(); renderPage()
  await user.click(screen.getByRole('button', { name: /continue.*free/i }))
  expect(await screen.findByText('Dashboard page')).toBeVisible(); expect(mock.calls).toHaveLength(0)
})
it('redirects active paid users to the dashboard', async () => {
  setMockUser({ role: 'OWNER', establishment: { ...establishment, status: 'ACTIVE', plan: 'PAID' } }); renderPage()
  expect(await screen.findByText('Dashboard page')).toBeVisible()
})
it('blocks duplicate checkout writes and restores the selected interval after a translated failure', async () => {
  let answer!: (response: Response) => void
  const mock = mockApi(() => new Promise<Response>(resolve => { answer = resolve }))
  const user = userEvent.setup(); renderPage()
  await user.click(screen.getByRole('button', { name: 'Annual' }))
  await user.dblClick(screen.getByRole('button', { name: /subscribe annually/i }))
  expect(mock.calls).toHaveLength(1)
  expect(screen.getAllByRole('button', { name: 'Processing...' }).every(button => button.hasAttribute('disabled'))).toBe(true)
  answer(problem(502, 'BILLING_CHECKOUT_FAILED'))
  expect(await screen.findByText('Error processing payment. Check that your session is active.')).toBeVisible()
  expect(screen.getByRole('button', { name: /subscribe annually/i })).toBeEnabled()
})
it.each(['javascript:alert(1)', undefined])('shows the translated URL error for an unusable response %s', async url => {
  const navigation = vi.spyOn(window.location, 'assign').mockImplementation(() => {})
  mockApi(() => json(200, { url })); const user = userEvent.setup(); renderPage()
  await user.click(screen.getByRole('button', { name: /subscribe monthly/i }))
  expect(await screen.findByText('Unable to start payment: URL not found.')).toBeVisible()
  expect(navigation).not.toHaveBeenCalled()
})
it('keeps paid checkout restricted to the owner', () => {
  setMockUser({ role: 'MANAGER', establishment }); const mock = mockApi(() => undefined); renderPage()
  expect(screen.getByRole('button', { name: /subscribe monthly/i })).toBeDisabled()
  expect(screen.getByRole('button', { name: /subscribe.*enterprise/i })).toBeDisabled()
  expect(screen.getByRole('button', { name: /continue.*free/i })).toBeEnabled()
  expect(mock.calls).toHaveLength(0)
})
it('does not navigate when a checkout response arrives after leaving the route', async () => {
  let answer!: (response: Response) => void
  mockApi(() => new Promise<Response>(resolve => { answer = resolve }))
  const navigation = vi.spyOn(window.location, 'assign').mockImplementation(() => {})
  const user = userEvent.setup(); const view = renderPage()
  await user.click(screen.getByRole('button', { name: /subscribe monthly/i })); view.unmount()
  answer(json(200, { url: 'https://checkout.stripe.com/x' })); await Promise.resolve(); await Promise.resolve()
  expect(navigation).not.toHaveBeenCalled()
})
