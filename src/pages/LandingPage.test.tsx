import { Route } from '@solidjs/router'
import { fireEvent, screen, waitFor } from '@solidjs/testing-library'
import { beforeEach, expect, it, vi } from 'vitest'
import { resetAuthMocks, setMockUser } from '@/test/auth-mock'
import { renderDashboard } from '@/test/dashboard'
import { i18n } from '@/i18n/config'
import LandingPage from './LandingPage'
vi.mock('@/contexts/AuthContext', () => import('@/test/auth-mock'))
beforeEach(async () => { resetAuthMocks(); await i18n.changeLanguage('en') })
const renderPage = () => renderDashboard('/', () => <><Route path="/" component={LandingPage}/><Route path="/login" component={() => <p>Signup destination</p>}/><Route path="/dashboard" component={() => <p>Dashboard destination</p>}/><Route path="/plan" component={() => <p>Plan destination</p>}/></>)
it('shows the existing landing, same nine images hosted locally and plan pricing', () => {
  renderPage()
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Smart management for')
  expect(screen.getAllByRole('img')).toHaveLength(9)
  expect(screen.getAllByRole('img').every(image => image.getAttribute('src')?.startsWith('/images/landing/'))).toBe(true)
  expect(screen.getByText(/14.90/)).toBeVisible()
})
it('starts signup from a plan CTA while signed out', async () => {
  const { history } = renderPage()
  fireEvent.click(screen.getByRole('button', { name: /subscribe monthly/i }))
  expect(await screen.findByText('Signup destination')).toBeVisible()
  await waitFor(() => expect(history.get()).toBe('/login?tab=register'))
})
it.each(['ACTIVE', 'PENDING_PAYMENT'] as const)('sends signed-in %s subscribers to the matching destination', async status => {
  setMockUser({ role: 'OWNER', establishment: { id: 'e1', tradeName: 'Cafe', status, plan: 'FREE', category: null, preferencesRevision: 1 } })
  renderPage(); fireEvent.click(screen.getByRole('button', { name: /subscribe monthly/i }))
  expect(await screen.findByText(status === 'ACTIVE' ? 'Dashboard destination' : 'Plan destination')).toBeVisible()
})
