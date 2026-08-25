import { afterEach, beforeEach, describe, expect, it, vi } from 'bun:test'
import { act, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import api from '@/services/api'
import { I18nProvider } from '@/i18n/provider'
import { i18n } from '@/i18n/config'
import { ConfirmProvider } from '@/contexts/ConfirmContext'
import { Navbar } from '@/components/Navbar'
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
      <span data-testid="trade-name">{user?.establishment?.tradeName ?? ''}</span>
    </div>
  )
}

describe('AuthProvider', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem('tozzo_token', tokenFor({ id: 42, nome: 'Ana', role: 'DONO' }))
  })

  afterEach(async () => {
    localStorage.clear()
    await act(async () => {
      await i18n.changeLanguage('en')
    })
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
        <I18nProvider>
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
          </MemoryRouter>
        </I18nProvider>,
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

  it('keeps a structured pending status and localizes the 402 presentation', async () => {
    await act(async () => {
      await i18n.changeLanguage('pt-BR')
    })
    const getMock = vi.fn()
      .mockResolvedValueOnce({
        data: { name: 'Ana', email: 'ana@example.com', role: 'OWNER' },
      } as never)
      .mockRejectedValueOnce({ response: { status: 402 } } as never)
    const restoreGet = replaceProperty(api, 'get', getMock as typeof api.get)

    try {
      render(
        <I18nProvider>
          <MemoryRouter initialEntries={['/plan']}>
            <AuthProvider>
              <ConfirmProvider>
                <AuthState />
                <Navbar />
              </ConfirmProvider>
            </AuthProvider>
          </MemoryRouter>
        </I18nProvider>,
      )

      await waitFor(() => {
        expect(screen.getByTestId('auth-state')).toHaveTextContent('true:PENDING_PAYMENT')
      })
      expect(screen.getByTestId('trade-name').textContent).toBe('')
      expect(screen.getByText('Pagamento pendente')).toBeInTheDocument()

      await act(async () => {
        await i18n.changeLanguage('en')
      })
      expect(screen.getByText('Payment pending')).toBeInTheDocument()
      expect(screen.queryByText('Pagamento pendente')).not.toBeInTheDocument()
    } finally {
      restoreGet()
    }
  })
})
