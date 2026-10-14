import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@solidjs/testing-library'
import { Route, type RouteSectionProps } from '@solidjs/router'
import ProtectedRoute from './ProtectedRoute'
import { renderAt } from '@/test/router'

const mockUseAuth = vi.fn()
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

function auth(state: { isAuthenticated: boolean; isLoading: boolean; user: unknown }) {
  mockUseAuth.mockReturnValue({ isAuthenticated: () => state.isAuthenticated, isLoading: () => state.isLoading, user: () => state.user })
}

function renderRoutes(path: string, allowPending = false) {
  return renderAt(path, () => (
    <>
      <Route path="/login" component={() => <div>login page</div>} />
      <Route path="/plan" component={() => <div>plan page</div>} />
      <Route path="/dashboard/kitchen" component={() => <div>kitchen page</div>} />
      <Route component={(props: RouteSectionProps) => <ProtectedRoute allowPending={allowPending}>{props.children}</ProtectedRoute>}>
        <Route path="/dashboard" component={() => <div>dashboard content</div>} />
      </Route>
    </>
  ))
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    mockUseAuth.mockReset()
  })

  it('shows a loading state while auth is resolving', () => {
    auth({ isAuthenticated: false, isLoading: true, user: null })
    const { container } = renderRoutes('/dashboard')
    expect(container.querySelector('.animate-spin')).toBeTruthy()
  })

  it('redirects to /login when not authenticated', async () => {
    auth({ isAuthenticated: false, isLoading: false, user: null })
    renderRoutes('/dashboard')
    expect(await screen.findByText('login page')).toBeInTheDocument()
  })

  it('renders the protected content when authenticated and establishment is ACTIVE', () => {
    auth({ isAuthenticated: true, isLoading: false, user: { establishment: { status: 'ACTIVE' } } })
    renderRoutes('/dashboard')
    expect(screen.getByText('dashboard content')).toBeInTheDocument()
  })

  it('redirects to /plan when authenticated but establishment is not ACTIVE', async () => {
    auth({ isAuthenticated: true, isLoading: false, user: { establishment: { status: 'PENDING_PAYMENT' } } })
    renderRoutes('/dashboard')
    expect(await screen.findByText('plan page')).toBeInTheDocument()
  })

  it('allows pending establishments through when allowPending is true', () => {
    auth({ isAuthenticated: true, isLoading: false, user: { establishment: { status: 'PENDING_PAYMENT' } } })
    renderRoutes('/dashboard', true)
    expect(screen.getByText('dashboard content')).toBeInTheDocument()
  })

  it('sends a cook to the kitchen', async () => {
    auth({ isAuthenticated: true, isLoading: false, user: { role: 'COOK', establishment: { status: 'ACTIVE' } } })
    renderRoutes('/dashboard')
    expect(await screen.findByText('kitchen page')).toBeInTheDocument()
  })
})
