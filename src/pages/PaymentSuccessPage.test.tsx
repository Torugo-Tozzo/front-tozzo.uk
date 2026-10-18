import { Route } from '@solidjs/router'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@solidjs/testing-library'
import { authMocks, resetAuthMocks, setMockUser } from '@/test/auth-mock'
import { renderDashboard } from '@/test/dashboard'
import { i18n } from '@/i18n/config'
import PaymentSuccessPage from './PaymentSuccessPage'
vi.mock('@/contexts/AuthContext', () => import('@/test/auth-mock'))
beforeEach(async () => { resetAuthMocks(); await i18n.changeLanguage('en'); vi.useFakeTimers() })
afterEach(() => vi.useRealTimers())
it('shows the existing success message then signs out after three seconds', async () => {
  renderDashboard('/payment/success?session_id=untrusted', () => <Route path="/payment/success" component={PaymentSuccessPage} />)
  expect(screen.getByRole('heading', { name: 'Payment confirmed!' })).toBeVisible()
  await vi.advanceTimersByTimeAsync(2999); expect(authMocks.logout).not.toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(1); expect(authMocks.logout).toHaveBeenCalledTimes(1)
})
it('clears the sign-out timer when leaving', async () => {
  const view = renderDashboard('/payment/success', () => <Route path="/payment/success" component={PaymentSuccessPage} />)
  view.unmount(); await vi.advanceTimersByTimeAsync(3000)
  expect(authMocks.logout).not.toHaveBeenCalled()
})

it('offers a retry when logout returns with the session still active after a server failure', async () => {
  setMockUser({ role: 'OWNER' })
  renderDashboard('/payment/success', () => <Route path="/payment/success" component={PaymentSuccessPage} />)
  await vi.advanceTimersByTimeAsync(3000)
  expect(screen.getByRole('alert')).toHaveTextContent('Could not sign out')
  fireEvent.click(screen.getByRole('button', { name: 'Log out' }))
  await vi.advanceTimersByTimeAsync(0)
  expect(authMocks.logout).toHaveBeenCalledTimes(2)
})
