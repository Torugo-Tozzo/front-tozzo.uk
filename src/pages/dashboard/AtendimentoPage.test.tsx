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

  it('defaults to the Pedidos tab and shows the matching action button', async () => {
    renderAt('/dashboard/atendimento')
    expect(await screen.findByRole('button', { name: /Novo Pedido/i })).toBeInTheDocument()
  })

  it('reads the initial tab from the ?tab= query param', async () => {
    renderAt('/dashboard/atendimento?tab=vendas')
    expect(await screen.findByRole('button', { name: /Nova Venda/i })).toBeInTheDocument()
  })

  it('switches the action button label when the user changes tabs', async () => {
    const user = userEvent.setup()
    renderAt('/dashboard/atendimento')
    await screen.findByRole('button', { name: /Novo Pedido/i })

    await user.click(screen.getByRole('tab', { name: 'Produtos' }))

    expect(await screen.findByRole('button', { name: /Novo Produto/i })).toBeInTheDocument()
  })

  it('falls back to the Pedidos tab when ?tab= has an invalid value', async () => {
    renderAt('/dashboard/atendimento?tab=nonsense')
    expect(await screen.findByRole('button', { name: /Novo Pedido/i })).toBeInTheDocument()
  })

  it('clicking the header button calls the currently active tab handler, not a stale one', async () => {
    const user = userEvent.setup()
    renderAt('/dashboard/atendimento')
    await screen.findByRole('button', { name: /Novo Pedido/i })

    await user.click(screen.getByRole('tab', { name: 'Produtos' }))
    const actionButton = await screen.findByRole('button', { name: /Novo Produto/i })

    await user.click(actionButton)

    expect(await screen.findByText('Produto novo')).toBeInTheDocument()
  })
})
