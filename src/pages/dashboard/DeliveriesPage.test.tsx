import { Route } from '@solidjs/router'
import { screen, waitFor, within } from '@solidjs/testing-library'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n/config'
import { json, mockApi, problem, type RecordedCall } from '@/test/api'
import { resetAuthMocks, setMockUser } from '@/test/auth-mock'
import { dialogClosed, renderDashboard } from '@/test/dashboard'
import DeliveriesPage from './DeliveriesPage'

vi.mock('@/contexts/AuthContext', () => import('@/test/auth-mock'))

type Status = 'IN_PREPARATION' | 'READY' | 'DELIVERED'
const item = (id: string, productName: string, status: Status = 'READY') =>
  ({ id, productId: `product-${id}`, productName, quantity: 1, unitPriceCents: 200, status, kitchenReadyAt: null })
const order = (extra: Record<string, unknown> = {}, delivery: Record<string, unknown> = {}) => ({
  id: 'order-1',
  customerName: 'Ana',
  status: 'OPEN',
  isDelivery: true,
  deliveryAddress: 'Rua A',
  totalCents: 2000,
  openedAt: '2026-09-23T12:00:00.000Z',
  updatedAt: '2026-09-23T12:00:00.000Z',
  seller: { id: 'usr-1', name: 'Ana' },
  items: [item('item-1', 'Burger')],
  ...extra,
  delivery: { stage: 'WAITING', startedAt: null, driver: null, externalDriverName: null, externalDriverPhone: null, ...delivery },
})
const joao = { id: 'driver-1', name: 'João', phone: '123', available: true }
const board = (orders: unknown[], drivers: unknown[] = []) => ({ items: orders, drivers, nextCursor: null, total: orders.length })

type Handler = (call: RecordedCall) => Response | undefined
function deliveryApi(state: () => ReturnType<typeof board>, handler: Handler = () => undefined) {
  return mockApi((call) => handler(call) ?? (call.method === 'GET' && call.path === '/v1/delivery/orders' ? json(200, state()) : undefined))
}
const renderDeliveries = () => renderDashboard('/dashboard/deliveries', () => <Route path="/dashboard/deliveries" component={DeliveriesPage} />)
const writes = (calls: RecordedCall[]) => calls.filter((call) => call.method !== 'GET')
const boardGets = (calls: RecordedCall[]) => calls.filter((call) => call.method === 'GET' && call.path === '/v1/delivery/orders')

describe('DeliveriesPage', () => {
  beforeEach(async () => {
    resetAuthMocks()
    setMockUser({ role: 'OWNER', establishment: { tradeName: 'Bistro' } as never })
    await i18n.changeLanguage('pt-BR')
  })
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

  it('assigns a fixed driver and starts only a ready order', async () => {
    const api = deliveryApi(() => board([order()], [joao]), ({ method }) => (method === 'PATCH' ? json(200, order()) : undefined))
    const user = userEvent.setup()
    renderDeliveries()

    await screen.findByText('Ana')
    await user.click(screen.getByRole('button', { name: /atribuir/i }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).queryByRole('combobox', { name: /entregador fixo/i })).not.toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /João.*Disponível/i }))
    await user.click(within(dialog).getByRole('button', { name: /salvar entregador/i }))
    await dialogClosed()
    expect(writes(api.calls)).toEqual([expect.objectContaining({
      method: 'PATCH', path: '/v1/delivery/orders/order-1', body: { action: 'ASSIGN', driverId: 'driver-1', expectedUpdatedAt: '2026-09-23T12:00:00.000Z' },
    })])
  })

  it('starts a ready order without a driver', async () => {
    const api = deliveryApi(() => board([order()]), ({ method }) => (method === 'PATCH' ? json(200, order()) : undefined))
    const user = userEvent.setup()
    renderDeliveries()

    const start = await screen.findByRole('button', { name: 'Saiu para entrega' })
    expect(start).toBeEnabled()
    await user.click(start)
    await waitFor(() => expect(writes(api.calls)).toHaveLength(1))
    expect(writes(api.calls)[0].body).toEqual({ action: 'START', expectedUpdatedAt: '2026-09-23T12:00:00.000Z' })
  })

  it('asks before marking pending items ready and starting delivery (confirmReady)', async () => {
    const api = deliveryApi(() => board([order({ items: [item('item-1', 'Burger', 'IN_PREPARATION')] })]), ({ method }) => (method === 'PATCH' ? json(200, order()) : undefined))
    const user = userEvent.setup()
    renderDeliveries()

    await user.click(await screen.findByRole('button', { name: 'Saiu para entrega' }))
    let dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/Burger/)).toBeInTheDocument()
    expect(writes(api.calls)).toEqual([])
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }))
    await dialogClosed()
    expect(writes(api.calls)).toEqual([])
    await user.click(screen.getByRole('button', { name: 'Saiu para entrega' }))
    dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: /confirmar/i }))
    await dialogClosed()
    expect(writes(api.calls)[0].body).toEqual({ action: 'START', confirmReady: true, expectedUpdatedAt: '2026-09-23T12:00:00.000Z' })
  })

  for (const [code, status, message] of [
    ['DELIVERY_CONFLICT', 409, 'O pedido mudou'],
    ['ORDER_NOT_READY', 409, 'Todos os itens precisam estar prontos'],
    ['DELIVERY_ALREADY_STARTED', 409, 'O pedido mudou'],
  ] as const) {
    it(`explains a failed start (${code}) and reads the board again`, async () => {
      const api = deliveryApi(() => board([order()]), ({ method }) => (method === 'PATCH' ? problem(status, code) : undefined))
      const user = userEvent.setup()
      renderDeliveries()

      const start = await screen.findByRole('button', { name: 'Saiu para entrega' })
      const before = boardGets(api.calls).length
      await user.click(start)
      expect(await screen.findByRole('alert')).toHaveTextContent(message)
      await waitFor(() => expect(boardGets(api.calls).length).toBeGreaterThan(before))
    })
  }

  it('says when the driver is already delivering', async () => {
    deliveryApi(() => board([order()], [joao]), ({ method }) => (method === 'PATCH' ? problem(409, 'DRIVER_BUSY') : undefined))
    const user = userEvent.setup()
    renderDeliveries()

    await user.click(await screen.findByRole('button', { name: 'Atribuir entregador' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: /João/ }))
    await user.click(within(dialog).getByRole('button', { name: 'Salvar entregador' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Este entregador já está em uma entrega.')
  })

  it('shows busy drivers as disabled in the assignment dialog', async () => {
    deliveryApi(() => board([order({ items: [] })], [{ ...joao, available: false }]))
    const user = userEvent.setup()
    renderDeliveries()

    await user.click(await screen.findByRole('button', { name: 'Atribuir entregador' }))
    expect(within(await screen.findByRole('dialog')).getByRole('button', { name: /João.*Ocupado/i })).toBeDisabled()
    // An order without items cannot go out.
    expect(screen.getByRole('button', { name: 'Saiu para entrega', hidden: true })).toBeDisabled()
  })

  it('keeps large orders compact and opens all items in the existing order modal', async () => {
    const items = Array.from({ length: 10 }, (_, index) => item(`item-${index + 1}`, `Item ${index + 1}`))
    deliveryApi(() => board([order({ items })]))
    const user = userEvent.setup()
    renderDeliveries()

    expect(await screen.findByText(/Item 3/)).toBeInTheDocument()
    expect(screen.queryByText(/Item 4/)).not.toBeInTheDocument()
    expect(screen.getByText('…')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ver pedido' }))
    const dialog = await screen.findByRole('dialog', { name: 'Detalhes do pedido' })
    expect(within(dialog).getByText('Item 10')).toBeInTheDocument()
    expect(within(dialog).getByText('Rua A')).toBeInTheDocument()
  })

  it('starting delivery does not close the order; finishing explicitly closes it with payment', async () => {
    let stage = 'WAITING'
    const api = deliveryApi(() => board([order({}, { stage, driver: { id: 'driver-1', name: 'João', phone: '123' } })]), ({ method, path }) => {
      if (method === 'PATCH') { stage = 'DELIVERING'; return json(200, order()) }
      if (method === 'POST' && path === '/v1/orders/order-1/close') return json(200, { order: order(), sale: { id: 'sale-1' } })
      return undefined
    })
    const user = userEvent.setup()
    renderDeliveries()

    await waitFor(() => expect(screen.getByRole('button', { name: 'Saiu para entrega' })).toBeEnabled())
    expect(screen.getByRole('button', { name: 'Editar entregador' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Atribuir entregador' })).not.toBeInTheDocument()
    expect(screen.getByText('Entregadores')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Saiu para entrega' }))
    await waitFor(() => expect(writes(api.calls)[0]).toMatchObject({ method: 'PATCH', body: { action: 'START' } }))
    expect(writes(api.calls).some((call) => call.method === 'POST')).toBe(false)
    await user.click(await screen.findByRole('button', { name: 'Finalizar entrega' }))
    await user.selectOptions(await screen.findByRole('combobox', { name: 'Método de pagamento' }), 'PIX')
    await user.click(screen.getByRole('button', { name: 'Fechar pedido e gerar venda' }))
    await waitFor(() => expect(writes(api.calls).at(-1)).toMatchObject({ method: 'POST', path: '/v1/orders/order-1/close', body: { paymentMethod: 'PIX' } }))
  })

  it('returns a delivering order to waiting (WAIT)', async () => {
    const api = deliveryApi(() => board([order({}, { stage: 'DELIVERING', startedAt: '2026-09-23T12:10:00.000Z' })]), ({ method }) => (method === 'PATCH' ? json(200, order()) : undefined))
    const user = userEvent.setup()
    renderDeliveries()

    await user.click(await screen.findByRole('button', { name: 'Voltar para aguardando' }))
    await waitFor(() => expect(writes(api.calls)[0]?.body).toEqual({ action: 'WAIT', expectedUpdatedAt: '2026-09-23T12:00:00.000Z' }))
  })

  it('registers a temporary third-party driver on the order', async () => {
    const api = deliveryApi(() => board([order()]), ({ method }) => (method === 'PATCH' ? json(200, order()) : undefined))
    const user = userEvent.setup()
    renderDeliveries()

    await user.click(await screen.findByRole('button', { name: 'Atribuir entregador' }))
    await user.click(await screen.findByRole('radio', { name: 'Terceirizado' }))
    await user.type(screen.getByRole('textbox', { name: 'Nome do entregador' }), ' João iFood ')
    await user.type(screen.getByRole('textbox', { name: /Contato do entregador/ }), '999')
    await user.click(screen.getByRole('button', { name: 'Salvar entregador' }))
    await dialogClosed()
    expect(writes(api.calls)[0].body).toEqual({ action: 'ASSIGN', externalDriverName: 'João iFood', externalDriverPhone: '999', expectedUpdatedAt: '2026-09-23T12:00:00.000Z' })
  })

  it('shows the external driver on the card', async () => {
    deliveryApi(() => board([order({}, { externalDriverName: 'João iFood', externalDriverPhone: '999' })]))
    renderDeliveries()
    expect(await screen.findByText(/Entregador: João iFood · 999/)).toBeInTheDocument()
  })

  it('a DRIVER sees no roster and can only start', async () => {
    setMockUser({ role: 'DRIVER', establishment: { tradeName: 'Bistro' } as never })
    const api = deliveryApi(() => board([order(), order({ id: 'order-2', customerName: 'Bruno' }, { stage: 'DELIVERING' })], [joao]), ({ method }) => (method === 'PATCH' ? json(200, order()) : undefined))
    const user = userEvent.setup()
    renderDeliveries()

    await screen.findByText('Ana')
    expect(screen.queryByText('Entregadores')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Atribuir entregador' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Voltar para aguardando' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Finalizar entrega' })).not.toBeInTheDocument()
    // The delivering card cannot be moved by keyboard either.
    const bruno = screen.getByText('Bruno').closest('article')!
    expect(within(bruno).getByRole('button', { name: 'Arraste o pedido para outra coluna' })).toHaveAttribute('aria-disabled', 'true')
    await user.click(screen.getByRole('button', { name: 'Saiu para entrega' }))
    await waitFor(() => expect(writes(api.calls)[0]?.body).toEqual({ action: 'START', expectedUpdatedAt: '2026-09-23T12:00:00.000Z' }))
  })

  it('moves an order with the keyboard, asking about pending items first', async () => {
    const api = deliveryApi(() => board([order({ items: [item('item-1', 'Burger', 'IN_PREPARATION')] })]), ({ method }) => (method === 'PATCH' ? json(200, order()) : undefined))
    const user = userEvent.setup()
    renderDeliveries()

    const grip = within((await screen.findByText('Ana')).closest('article')!).getByRole('button', { name: 'Arraste o pedido para outra coluna' })
    grip.focus()
    await user.keyboard(' ')
    expect(screen.getByText('Cartão selecionado.')).toBeInTheDocument()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByText('Coluna: Entregando.')).toBeInTheDocument()
    await user.keyboard(' ')
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Itens ainda não estão prontos')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /confirmar/i }))
    await waitFor(() => expect(writes(api.calls)[0]?.body).toEqual({ action: 'START', confirmReady: true, expectedUpdatedAt: '2026-09-23T12:00:00.000Z' }))
  })

  it('removes the driver (UNASSIGN) from the edit dialog', async () => {
    let assigned = true
    const api = deliveryApi(() => board([order({}, assigned ? { externalDriverName: 'João iFood' } : {})]), ({ method }) => {
      if (method !== 'PATCH') return undefined
      assigned = false
      return json(200, order())
    })
    const user = userEvent.setup()
    renderDeliveries()

    await user.click(await screen.findByRole('button', { name: 'Editar entregador' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Remover entregador' }))
    await dialogClosed()
    expect(writes(api.calls).map((call) => call.body)).toEqual([{ action: 'UNASSIGN', expectedUpdatedAt: '2026-09-23T12:00:00.000Z' }])
    expect(await screen.findByRole('button', { name: 'Atribuir entregador' })).toBeInTheDocument()
  })

  it('has no "Remover entregador" for an order without a driver', async () => {
    deliveryApi(() => board([order()]))
    const user = userEvent.setup()
    renderDeliveries()

    await user.click(await screen.findByRole('button', { name: 'Atribuir entregador' }))
    expect(within(await screen.findByRole('dialog')).queryByRole('button', { name: 'Remover entregador' })).not.toBeInTheDocument()
  })

  it('a dialog sends the version of the order it opened on, so a change made since is a conflict', async () => {
    let current = order({}, {}) as ReturnType<typeof order>
    const api = deliveryApi(() => board([current], [joao]), ({ method, body }) => {
      if (method !== 'PATCH') return undefined
      return (body as { expectedUpdatedAt: string }).expectedUpdatedAt === current.updatedAt ? json(200, current) : problem(409, 'DELIVERY_CONFLICT')
    })
    const user = userEvent.setup()
    const { queryClient } = renderDeliveries()

    await user.click(await screen.findByRole('button', { name: 'Atribuir entregador' }))
    const dialog = await screen.findByRole('dialog')
    // Someone else edits the order (same column) while the dialog is open.
    current = order({ updatedAt: '2026-09-23T12:09:00.000Z' }, { externalDriverName: 'Carla' })
    await queryClient.invalidateQueries({ queryKey: ['delivery'] })
    await user.click(within(dialog).getByRole('button', { name: /João/ }))
    await user.click(within(dialog).getByRole('button', { name: 'Salvar entregador' }))

    expect(await screen.findByText('O pedido mudou. Confira os itens atualizados e tente novamente.')).toBeInTheDocument()
    expect(writes(api.calls)[0].body).toMatchObject({ action: 'ASSIGN', expectedUpdatedAt: '2026-09-23T12:00:00.000Z' })
  })

  it('an open dialog closes and says so when its order leaves the column', async () => {
    let stage = 'WAITING'
    const api = deliveryApi(() => board([order({}, { stage })]))
    const user = userEvent.setup()
    const { queryClient } = renderDeliveries()

    await user.click(await screen.findByRole('button', { name: 'Atribuir entregador' }))
    await screen.findByRole('dialog')
    stage = 'DELIVERING'
    await queryClient.invalidateQueries({ queryKey: ['delivery'] })
    await dialogClosed()
    expect(screen.getByRole('alert')).toHaveTextContent('O pedido mudou')
    expect(writes(api.calls)).toEqual([])
  })

  it('the error clears when the board is read again', async () => {
    deliveryApi(() => board([order()]), ({ method }) => (method === 'PATCH' ? problem(500, 'INTERNAL_ERROR') : undefined))
    const user = userEvent.setup()
    const { queryClient } = renderDeliveries()

    await user.click(await screen.findByRole('button', { name: 'Saiu para entrega' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível atualizar a entrega.')
    await queryClient.invalidateQueries({ queryKey: ['delivery'] })
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  })

  it('reads the board again when the driver no longer exists (DRIVER_NOT_FOUND)', async () => {
    const api = deliveryApi(() => board([order()], [joao]), ({ method }) => (method === 'PATCH' ? problem(404, 'DRIVER_NOT_FOUND') : undefined))
    const user = userEvent.setup()
    renderDeliveries()

    await user.click(await screen.findByRole('button', { name: 'Atribuir entregador' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: /João/ }))
    const before = boardGets(api.calls).length
    await user.click(within(dialog).getByRole('button', { name: 'Salvar entregador' }))
    await waitFor(() => expect(boardGets(api.calls).length).toBeGreaterThan(before))
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível atualizar a entrega.')
  })
})
