import { Route } from '@solidjs/router'
import { fireEvent, screen, waitFor } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n/config'
import { json, mockApi, problem, type RecordedCall } from '@/test/api'
import { resetAuthMocks, setMockUser } from '@/test/auth-mock'
import { dialogClosed, renderDashboard } from '@/test/dashboard'
import KitchenPage from './KitchenPage'

vi.mock('@/contexts/AuthContext', () => import('@/test/auth-mock'))

const establishment = { id: 'est-1', tradeName: 'Bistro', status: 'ACTIVE' as const, plan: 'PAID' as const, category: null, preferencesRevision: 0 }
const kitchenOrder = {
  id: 'order-123', customerName: null, openedAt: '2026-09-23T12:00:00.000Z', updatedAt: '2026-09-23T12:00:00.000Z',
  items: [{ id: 'item-1', productId: 'product-1', productName: '', quantity: 2, stage: 'IN_PREPARATION', kitchenReadyAt: null }],
}
const board = (items: unknown[], nextCursor: string | null = null) => json(200, { items, nextCursor, total: items.length })
const renderKitchen = () => renderDashboard('/dashboard/kitchen', () => <Route path="/dashboard/kitchen" component={KitchenPage} />)

describe('KitchenPage translations', () => {
  beforeEach(async () => {
    resetAuthMocks()
    setMockUser({ role: 'OWNER', establishment })
    await i18n.changeLanguage('en')
  })
  afterEach(() => { vi.unstubAllGlobals() })

  it('translates the board and item details when the language changes', async () => {
    mockApi(({ path }) => (path === '/v1/kitchen/orders' ? board([kitchenOrder]) : undefined))
    renderKitchen()

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Kitchen — Bistro' })).toBeInTheDocument())
    expect(screen.getByText('Kitchen orders')).toBeInTheDocument()
    expect(screen.getByText('In preparation')).toBeInTheDocument()
    expect(screen.getByText('2× Unavailable product')).toBeInTheDocument()
    expect(screen.getByText('Order order-')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous 10 items in In preparation' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next 10 items in In preparation' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Previous 10 items in Ready to serve' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next 10 items in Ready to serve' })).toBeDisabled()
    expect(screen.getAllByText('Items · 1/1')).toHaveLength(2)
    await waitFor(() => expect(screen.getByText(/^Drag an item to another column with a pointer\./)).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'View item details' }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('Order details')
    expect(dialog).toHaveTextContent('Not informed')
    expect(dialog).toHaveTextContent('Placed at')
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    await dialogClosed()

    const headings = {
      'pt-BR': 'Cozinha — Bistro',
      es: 'Cocina — Bistro',
      fr: 'Cuisine — Bistro',
      zh: '厨房 — Bistro',
      hi: 'रसोई — Bistro',
    } as const
    for (const [locale, heading] of Object.entries(headings)) {
      await i18n.changeLanguage(locale)
      expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument()
    }
  })

  it('translates the initial loading and load error states', async () => {
    let fail: () => void = () => {}
    mockApi(({ path }) => (path === '/v1/kitchen/orders'
      ? new Promise<Response>((_resolve, reject) => { fail = () => reject(new TypeError('offline')) })
      : undefined))
    renderKitchen()

    expect(await screen.findByRole('status')).toHaveTextContent('Loading kitchen…')
    fail()
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Could not load the kitchen.'))
  })
})

describe('KitchenPage moves', () => {
  beforeEach(async () => {
    resetAuthMocks()
    setMockUser({ role: 'COOK', establishment })
    await i18n.changeLanguage('en')
  })
  afterEach(() => { vi.unstubAllGlobals() })

  const twoBurgers = {
    id: 'order-9', customerName: 'Table 4', openedAt: '2026-09-23T12:00:00.000Z', updatedAt: '2026-09-23T12:05:00.123Z',
    items: [
      { id: 'item-a', productId: 'product-1', productName: 'Burger', quantity: 1, stage: 'IN_PREPARATION', kitchenReadyAt: null },
      { id: 'item-b', productId: 'product-1', productName: 'Burger', quantity: 2, stage: 'IN_PREPARATION', kitchenReadyAt: null },
    ],
  }

  function kitchenApi(answer: (call: RecordedCall) => Response | undefined) {
    return mockApi((call) => answer(call) ?? (call.path === '/v1/kitchen/orders' ? board([twoBurgers]) : undefined))
  }

  it('follows the cursor to load the whole board', async () => {
    const api = mockApi(({ path, query }) => {
      if (path !== '/v1/kitchen/orders') return undefined
      return query.get('cursor') === 'next'
        ? board([{ ...kitchenOrder, id: 'order-2', customerName: 'Table 2' }])
        : board([{ ...kitchenOrder, customerName: 'Table 1' }], 'next')
    })
    renderKitchen()

    expect(await screen.findByText('Table 2')).toBeInTheDocument()
    expect(screen.getByText('Table 1')).toBeInTheDocument()
    expect(api.to('/v1/kitchen/orders').map((call) => call.query.get('limit'))).toEqual(['100', '100'])
  })

  it('moves the grouped items with the keyboard: Space picks up, the arrow picks the column, Space drops', async () => {
    const api = kitchenApi((call) => (call.method === 'PATCH' ? json(200, { orderId: 'order-9', updatedAt: '2026-09-23T12:06:00.000Z', items: [] }) : undefined))
    renderKitchen()

    const card = (await screen.findByText('3× Burger')).closest('[role="button"]') as HTMLElement
    card.focus()
    fireEvent.keyDown(card, { key: ' ' })
    expect(screen.getByText('Item selected.')).toBeInTheDocument()
    fireEvent.keyDown(card, { key: 'ArrowRight' })
    expect(screen.getByText('Move to another column.')).toBeInTheDocument()
    fireEvent.keyDown(card, { key: ' ' })

    await waitFor(() => expect(api.calls.filter((call) => call.method === 'PATCH')).toHaveLength(1))
    const patch = api.calls.find((call) => call.method === 'PATCH')!
    expect(patch.path).toBe('/v1/kitchen/orders/order-9/items')
    expect(patch.body).toEqual({ action: 'MOVE', itemIds: ['item-a', 'item-b'], targetStage: 'READY', expectedUpdatedAt: '2026-09-23T12:05:00.123Z' })
    expect(screen.getByText('Item moved.')).toBeInTheDocument()
    // The board reloads after the move.
    await waitFor(() => expect(api.to('/v1/kitchen/orders').length).toBeGreaterThan(1))
  })

  it('Escape cancels a keyboard move and nothing is sent', async () => {
    const api = kitchenApi(() => undefined)
    renderKitchen()

    const card = (await screen.findByText('3× Burger')).closest('[role="button"]') as HTMLElement
    fireEvent.keyDown(card, { key: 'Enter' })
    fireEvent.keyDown(card, { key: 'ArrowRight' })
    fireEvent.keyDown(card, { key: 'Escape' })
    expect(screen.getByText('Move canceled.')).toBeInTheDocument()
    fireEvent.keyDown(card, { key: 'ArrowLeft' })
    expect(api.calls.filter((call) => call.method === 'PATCH')).toHaveLength(0)
  })

  it('explains a conflict when the order changed in the meantime', async () => {
    kitchenApi((call) => (call.method === 'PATCH' ? problem(409, 'KITCHEN_CONFLICT') : undefined))
    renderKitchen()

    const card = (await screen.findByText('3× Burger')).closest('[role="button"]') as HTMLElement
    fireEvent.keyDown(card, { key: ' ' })
    fireEvent.keyDown(card, { key: 'ArrowRight' })
    fireEvent.keyDown(card, { key: ' ' })

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('The order changed. The queue will update shortly.'))
  })
})
