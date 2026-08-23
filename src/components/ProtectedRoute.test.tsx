import { describe, it, expect, vi, beforeEach } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import ProtectedRoute from './ProtectedRoute'

const mockUseAuth = vi.fn()
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

function renderAt(path: string, allowPending = false) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<div>login page</div>} />
        <Route path="/plan" element={<div>plan page</div>} />
        <Route element={<ProtectedRoute allowPending={allowPending} />}>
          <Route path="/dashboard" element={<div>dashboard content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  )
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    mockUseAuth.mockReset()
  })

  it('shows a loading state while auth is resolving', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false, isLoading: true, user: null })
    const { container } = renderAt('/dashboard')
    expect(container.querySelector('.animate-spin')).toBeTruthy()
  })

  it('redirects to /login when not authenticated', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false, isLoading: false, user: null })
    renderAt('/dashboard')
    expect(screen.getByText('login page')).toBeInTheDocument()
  })

  it('renders the protected content when authenticated and estabelecimento is ATIVO', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { estabelecimento: { status: 'ATIVO' } },
    })
    renderAt('/dashboard')
    expect(screen.getByText('dashboard content')).toBeInTheDocument()
  })

  it('redirects to /plan when authenticated but establishment is not ATIVO', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { estabelecimento: { status: 'PENDENTE_PAGAMENTO' } },
    })
    renderAt('/dashboard')
    expect(screen.getByText('plan page')).toBeInTheDocument()
  })

  it('allows pending establishments through when allowPending is true', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { estabelecimento: { status: 'PENDENTE_PAGAMENTO' } },
    })
    renderAt('/dashboard', true)
    expect(screen.getByText('dashboard content')).toBeInTheDocument()
  })
})
