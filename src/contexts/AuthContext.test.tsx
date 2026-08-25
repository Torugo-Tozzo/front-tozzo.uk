import { afterEach, beforeEach, describe, expect, it, vi } from 'bun:test'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import api from '@/services/api'
import ProtectedRoute from '@/components/ProtectedRoute'
import { replaceProperty } from '@/test/replace-property'
import { AuthProvider, useAuth } from './AuthContext'

function tokenFor(payload: Record<string, unknown>) {
  return `header.${btoa(JSON.stringify(payload))}.signature`
}

function AuthState() {
  const { isAuthenticated, isLoading, user } = useAuth()

  return (
    <div data-testid="auth-state">
      {isLoading ? 'loading' : `${isAuthenticated}:${user?.establishment?.status ?? 'none'}`}
    </div>
  )
}

describe('AuthProvider', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem('tozzo_token', tokenFor({ id: 42, nome: 'Ana', role: 'DONO' }))
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('keeps a pending user authenticated and on the allowed plan route', async () => {
    const getMock = vi.fn()
      .mockResolvedValueOnce({
        data: { name: 'Ana', email: 'ana@example.com', role: 'OWNER' },
      } as never)
      .mockResolvedValueOnce({
        data: {
          id: 9,
          nomeFantasia: 'Bar da Ana',
          status: 'PENDENTE_PAGAMENTO',
        },
      } as never)
    const restoreGet = replaceProperty(api, 'get', getMock as typeof api.get)

    try {
      render(
        <MemoryRouter initialEntries={['/plan']}>
          <AuthProvider>
            <AuthState />
            <Routes>
              <Route path="/login" element={<div>login page</div>} />
              <Route element={<ProtectedRoute allowPending />}>
                <Route path="/plan" element={<div>plan page</div>} />
              </Route>
            </Routes>
          </AuthProvider>
        </MemoryRouter>,
      )

      await waitFor(() => {
        expect(screen.getByTestId('auth-state')).toHaveTextContent('true:PENDING_PAYMENT')
      })
      expect(screen.getByText('plan page')).toBeInTheDocument()
      expect(screen.queryByText('login page')).not.toBeInTheDocument()
    } finally {
      restoreGet()
    }
  })
})
