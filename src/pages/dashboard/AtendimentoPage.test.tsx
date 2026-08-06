import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import AtendimentoPage from './AtendimentoPage'
import api from '@/services/api'

vi.mock('@/services/api', () => ({
  default: { get: vi.fn().mockResolvedValue({ data: [], headers: {} }), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  getErrorMessage: (_err: unknown, fallback: string) => fallback,
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { estabelecimento: { nomeFantasia: 'Loja Teste' } } }),
}))

vi.mock('@/hooks/useRealtimeEvents', () => ({
  useRealtimeEvents: () => {},
}))

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AtendimentoPage />
    </MemoryRouter>
  )
}

describe('AtendimentoPage', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockClear()
  })

  it('defaults to the Pedidos tab', async () => {
    renderAt('/dashboard/atendimento')
    expect(await screen.findByText('Nenhum pedido encontrado.')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Pedidos' })).toHaveAttribute('aria-selected', 'true')
  })

  it('reads the initial tab from the ?tab= query param', async () => {
    renderAt('/dashboard/atendimento?tab=vendas')
    expect(await screen.findByText('Nenhuma venda encontrada no período.')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Vendas' })).toHaveAttribute('aria-selected', 'true')
  })

  it('switches tab content when the user clicks a different tab', async () => {
    const user = userEvent.setup()
    renderAt('/dashboard/atendimento')
    await screen.findByText('Nenhum pedido encontrado.')

    await user.click(screen.getByRole('tab', { name: 'Produtos' }))

    expect(await screen.findByText('Nenhum produto encontrado.')).toBeInTheDocument()
  })

  it('falls back to the Pedidos tab when ?tab= has an invalid value', async () => {
    renderAt('/dashboard/atendimento?tab=nonsense')
    expect(await screen.findByText('Nenhum pedido encontrado.')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Pedidos' })).toHaveAttribute('aria-selected', 'true')
  })
})
