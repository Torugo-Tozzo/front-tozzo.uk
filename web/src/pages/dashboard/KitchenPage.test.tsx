import { Route } from '@solidjs/router'
import { fireEvent, screen, waitFor, within } from '@solidjs/testing-library'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n/config'
import { json, mockApi, problem, type RecordedCall } from '@/test/api'
import { resetAuthMocks, setMockUser } from '@/test/auth-mock'
import { dialogClosed, renderDashboard } from '@/test/dashboard'
import KitchenPage from './KitchenPage'

vi.mock('@/contexts/AuthContext', () => import('@/test/auth-mock'))

type Stage = 'IN_PREPARATION' | 'READY'
const item = (id: string, productId: string, productName: string, stage: Stage = 'IN_PREPARATION', quantity = 1) =>
  ({ id, productId, productName, quantity, stage, kitchenReadyAt: stage === 'READY' ? '2026-09-23T12:05:00.000Z' : null })
const order = (id: string, items: ReturnType<typeof item>[], extra: Record<string, unknown> = {}) =>
  ({ id, customerName: null, openedAt: '2026-09-23T12:00:00.000Z', updatedAt: '2026-09-23T12:00:00.000Z', items, ...extra })
const page = (items: unknown[], nextCursor: string | null = null) => ({ items, nextCursor, total: items.length })

type Handler = (call: RecordedCall) => Response | undefined
function kitchenApi(list: () => unknown[], handler: Handler = () => undefined) {
  return mockApi((call) => handler(call) ?? (call.method === 'GET' && call.path === '/v1/kitchen/orders' ? json(200, page(list())) : undefined))
}
const renderKitchen = () => renderDashboard('/dashboard/kitchen', () => <Route path="/dashboard/kitchen" component={KitchenPage} />)
const boardGets = (calls: RecordedCall[]) => calls.filter((call) => call.method === 'GET' && call.path === '/v1/kitchen/orders')
const patches = (calls: RecordedCall[]) => calls.filter((call) => call.method === 'PATCH')
// The keyboard handle of the card that shows `name`.
const card = (name: string | RegExp) => screen.getByText(name).closest('[data-board-card]')!.querySelector('[role="button"][aria-roledescription="draggable"]') as HTMLElement
const findCard = async (name: string) => { await screen.findByText(name); return card(name) }

describe('KitchenPage', () => {
  beforeEach(async () => {
    resetAuthMocks()
    setMockUser({ role: 'OWNER', establishment: { tradeName: 'Bistro' } as never })
    await i18n.changeLanguage('en')
  })
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

  it('translates the board and item details when the language changes', async () => {
    kitchenApi(() => [order('order-123', [item('item-1', 'product-1', '', 'IN_PREPARATION', 2)])])
    renderKitchen()

    expect(await screen.findByRole('heading', { name: 'Kitchen — Bistro' })).toBeInTheDocument()
    expect(screen.getByText('Kitchen orders')).toBeInTheDocument()
    expect(screen.getByText('In preparation')).toBeInTheDocument()
    expect(screen.getByText('2× Unavailable product')).toBeInTheDocument()
    expect(screen.getByText('Order order-')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous 10 items in In preparation' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next 10 items in In preparation' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Previous 10 items in Ready to serve' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next 10 items in Ready to serve' })).toBeDisabled()
    expect(screen.getAllByText('Items · 1/1')).toHaveLength(2)
    expect(screen.getByText(/Drag an item to another column with a pointer\./)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'View item details' }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('Order details')
    expect(dialog).toHaveTextContent('Not informed')
    expect(dialog).toHaveTextContent('Placed at')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
    await dialogClosed()

    const headings = { 'pt-BR': 'Cozinha — Bistro', es: 'Cocina — Bistro', fr: 'Cuisine — Bistro', zh: '厨房 — Bistro', hi: 'रसोई — Bistro' } as const
    for (const [locale, heading] of Object.entries(headings)) {
      await i18n.changeLanguage(locale)
      expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument()
    }
  })

  it('translates the initial loading and load error states', async () => {
    let fail: (() => void) | undefined
    mockApi((call) => (call.path === '/v1/kitchen/orders' ? new Promise<Response>((resolve) => { fail = () => resolve(problem(500, 'INTERNAL_ERROR')) }) : undefined))
    renderKitchen()

    expect(await screen.findByRole('status')).toHaveTextContent('Loading kitchen…')
    await waitFor(() => expect(fail).toBeDefined())
    fail!()
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the kitchen.')
  })

  it('reads every /v1 cursor page and groups one product of an order into one card', async () => {
    const api = mockApi((call) => {
      if (call.path !== '/v1/kitchen/orders') return undefined
      return call.query.get('cursor') === 'c2'
        ? json(200, page([order('order-2', [item('item-9', 'product-9', 'Fries')], { customerName: 'Table 2' })]))
        : json(200, page([order('order-1', [item('item-1', 'product-1', 'Burger'), item('item-2', 'product-1', 'Burger', 'IN_PREPARATION', 2)], { customerName: 'Table 1' })], 'c2'))
    })
    renderKitchen()

    expect(await screen.findByText('3× Burger')).toBeInTheDocument()
    expect(screen.getByText('1× Fries')).toBeInTheDocument()
    expect(boardGets(api.calls).map((call) => call.query.toString())).toEqual(['limit=100', 'cursor=c2&limit=100'])
  })

  it('moves a card with the keyboard: Space, an arrow, Space', async () => {
    let orders = [order('order-1', [item('item-1', 'product-1', 'Burger'), item('item-2', 'product-1', 'Burger')], { customerName: 'Table 1' })]
    const api = kitchenApi(() => orders, ({ method }) => {
      if (method !== 'PATCH') return undefined
      orders = [order('order-1', [item('item-1', 'product-1', 'Burger', 'READY'), item('item-2', 'product-1', 'Burger', 'READY')], { customerName: 'Table 1', updatedAt: '2026-09-23T12:05:00.000Z' })]
      return json(200, { orderId: 'order-1', updatedAt: '2026-09-23T12:05:00.000Z', items: orders[0].items })
    })
    const user = userEvent.setup()
    renderKitchen()

    const burger = await findCard('2× Burger')
    expect(burger).toHaveAttribute('aria-describedby')
    expect(document.getElementById(burger.getAttribute('aria-describedby')!)).toHaveTextContent('With the keyboard')
    burger.focus()
    await user.keyboard(' ')
    expect(screen.getByText('Item selected.')).toBeInTheDocument()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByText('Column: Ready to serve.')).toBeInTheDocument()
    await user.keyboard(' ')

    await waitFor(() => expect(patches(api.calls)).toHaveLength(1))
    expect(patches(api.calls)[0]).toMatchObject({
      path: '/v1/kitchen/orders/order-1/items',
      body: { action: 'MOVE', itemIds: ['item-1', 'item-2'], targetStage: 'READY', expectedUpdatedAt: '2026-09-23T12:00:00.000Z' },
    })
    // "Moved" only once it went through, and the focus follows the card to its new column.
    expect(await screen.findByText('Item moved.')).toBeInTheDocument()
    const ready = screen.getByText('Ready to serve').closest('div.flex.min-h-\\[360px\\]') as HTMLElement
    await waitFor(() => expect(within(ready).getByText('2× Burger')).toBeInTheDocument())
    await waitFor(() => expect(document.activeElement).toBe(card('2× Burger')))
    expect(document.activeElement).toHaveAttribute('data-dnd-key', 'item-1')
  })

  it('two moves in a row on the same order: the second carries the version the first produced', async () => {
    let version = '2026-09-23T12:00:00.000Z'
    let stages: Record<string, 'IN_PREPARATION' | 'READY'> = { 'item-1': 'IN_PREPARATION', 'item-2': 'IN_PREPARATION' }
    const current = () => [order('order-1', [item('item-1', 'product-1', 'Burger', stages['item-1']), item('item-2', 'product-2', 'Fries', stages['item-2'])], { updatedAt: version })]
    const api = kitchenApi(current, ({ method, body }) => {
      if (method !== 'PATCH') return undefined
      const input = body as { itemIds: string[]; expectedUpdatedAt: string }
      if (input.expectedUpdatedAt !== version) return problem(409, 'KITCHEN_CONFLICT')
      stages = { ...stages, ...Object.fromEntries(input.itemIds.map((id) => [id, 'READY' as const])) }
      version = version === '2026-09-23T12:00:00.000Z' ? '2026-09-23T12:05:00.000Z' : '2026-09-23T12:06:00.000Z'
      return json(200, { orderId: 'order-1', updatedAt: version, items: current()[0].items })
    })
    const user = userEvent.setup()
    renderKitchen()

    ;(await findCard('1× Burger')).focus()
    await user.keyboard(' {ArrowRight} ')
    // Right after the first move went through, the second one.
    await screen.findByText('Item moved.')
    card('1× Fries').focus()
    await user.keyboard(' {ArrowRight} ')

    await waitFor(() => expect(patches(api.calls)).toHaveLength(2))
    expect(patches(api.calls).map((call) => (call.body as { expectedUpdatedAt: string }).expectedUpdatedAt))
      .toEqual(['2026-09-23T12:00:00.000Z', '2026-09-23T12:05:00.000Z'])
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('Escape cancels a keyboard move, and dropping on the same column does nothing', async () => {
    const api = kitchenApi(() => [order('order-1', [item('item-1', 'product-1', 'Burger')])])
    const user = userEvent.setup()
    renderKitchen()

    const burger = await findCard('1× Burger')
    burger.focus()
    await user.keyboard(' {ArrowRight}{Escape}')
    expect(screen.getByText('Move canceled.')).toBeInTheDocument()
    await user.keyboard('  ')
    expect(patches(api.calls)).toEqual([])
  })

  it('a refetch that changes the board keeps a picked card focused and the move going', async () => {
    let orders = [order('order-1', [item('item-1', 'product-1', 'Burger')])]
    const api = kitchenApi(() => orders)
    const user = userEvent.setup()
    const { queryClient } = renderKitchen()

    const burger = await findCard('1× Burger')
    burger.focus()
    await user.keyboard(' ')
    orders = [...orders, order('order-2', [item('item-2', 'product-2', 'Fries', 'READY')])]
    await queryClient.invalidateQueries({ queryKey: ['kitchen'] })
    await screen.findByText('1× Fries')
    expect(document.activeElement).toBe(burger)
    await user.keyboard('{ArrowRight} ')
    await waitFor(() => expect(patches(api.calls)).toHaveLength(1))
  })

  it('a refused move says the order changed, reads the board again and keeps the message until the next read', async () => {
    const api = kitchenApi(() => [order('order-1', [item('item-1', 'product-1', 'Burger')])], ({ method }) => (method === 'PATCH' ? problem(409, 'KITCHEN_CONFLICT') : undefined))
    const user = userEvent.setup()
    const { queryClient } = renderKitchen()

    const burger = await findCard('1× Burger')
    const before = boardGets(api.calls).length
    burger.focus()
    await user.keyboard(' {ArrowRight} ')

    expect(await screen.findByRole('alert')).toHaveTextContent('The order changed. The queue will update shortly.')
    expect(screen.queryByText('Item moved.')).not.toBeInTheDocument()
    await waitFor(() => expect(boardGets(api.calls).length).toBe(before + 1))
    expect(screen.getByRole('alert')).toHaveTextContent('The order changed.')

    await queryClient.invalidateQueries({ queryKey: ['kitchen'] })
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  })

  it('a second move while one is saving is ignored', async () => {
    let release: (() => void) | undefined
    const api = mockApi((call) => {
      if (call.method === 'PATCH') {
        return new Promise<Response>((resolve) => { release = () => resolve(json(200, { orderId: 'order-1', updatedAt: '2026-09-23T12:05:00.000Z', items: [] })) })
      }
      if (call.path === '/v1/kitchen/orders') return json(200, page([order('order-1', [item('item-1', 'product-1', 'Burger'), item('item-2', 'product-2', 'Fries')])]))
      return undefined
    })
    const user = userEvent.setup()
    renderKitchen()

    ;(await findCard('1× Burger')).focus()
    await user.keyboard(' {ArrowRight} ')
    card('1× Fries').focus()
    await user.keyboard(' {ArrowRight} ')
    await waitFor(() => expect(release).toBeDefined())
    expect(patches(api.calls)).toHaveLength(1)
    release!()
  })

  it('a failed refresh with the board on screen keeps it and says so', async () => {
    let fail = false
    mockApi((call) => (call.path === '/v1/kitchen/orders' ? (fail ? problem(500, 'INTERNAL_ERROR') : json(200, page([order('order-1', [item('item-1', 'product-1', 'Burger')])]))) : undefined))
    const { queryClient } = renderKitchen()

    await screen.findByText('1× Burger')
    fail = true
    await queryClient.invalidateQueries({ queryKey: ['kitchen'] })
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not refresh the kitchen.')
    expect(screen.getByText('1× Burger')).toBeInTheDocument()
  })
})
