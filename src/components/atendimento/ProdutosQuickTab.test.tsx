import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProdutosQuickTab } from './ProdutosQuickTab'
import api from '@/services/api'

vi.mock('@/services/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
  getErrorMessage: (_err: unknown, fallback: string) => fallback,
}))

describe('ProdutosQuickTab', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset()
    vi.mocked(api.post).mockReset()
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/tipos') return Promise.resolve({ data: [{ id: 1, descricao: 'Lanches' }] })
      return Promise.resolve({ data: [{ id: 10, nome: 'X-Bacon', preco: '25.00', tipoProdutoId: 1 }] })
    })
  })

  it('lists products with their type name and formatted price', async () => {
    render(<ProdutosQuickTab />)
    expect(await screen.findByText('X-Bacon')).toBeInTheDocument()
    expect(screen.getByText('Lanches')).toBeInTheDocument()
    expect(screen.getByText(/R\$\s*25,00/)).toBeInTheDocument()
  })

  it('exposes an openCreate handler via onReady that opens the quick-create dialog', async () => {
    let handlers: { openCreate: () => void } | null = null
    render(<ProdutosQuickTab onReady={(h) => { handlers = h }} />)
    await waitFor(() => expect(handlers).not.toBeNull())

    handlers!.openCreate()
    expect(await screen.findByText('Produto novo')).toBeInTheDocument()
  })

  it('creates a product and refreshes the list', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: {} })
    const user = userEvent.setup()
    let handlers: { openCreate: () => void } | null = null
    render(<ProdutosQuickTab onReady={(h) => { handlers = h }} />)
    await waitFor(() => expect(handlers).not.toBeNull())
    handlers!.openCreate()

    await user.type(await screen.findByLabelText('Nome'), 'Coca-Cola')
    await user.type(screen.getByLabelText('Preço'), '600')
    await user.click(screen.getByRole('combobox'))
    await user.click(await screen.findByRole('option', { name: 'Lanches' }))
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/produtos', {
      nome: 'Coca-Cola',
      preco: 6,
      ingredientes: '',
      tipoProdutoId: 1,
    }))
  })
})
