import { Route } from '@solidjs/router'
import { screen, waitFor, within } from '@solidjs/testing-library'
import userEvent from '@testing-library/user-event'
import { toast } from 'solid-sonner'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n/config'
import { json, mockApi, type RecordedCall } from '@/test/api'
import { renderDashboard } from '@/test/dashboard'
import { ProductSelectionModal, type ProductSelectionModalProps } from './ProductSelectionModal'

const TYPE_ID = '550e8400-e29b-41d4-a716-446655440000'
const product = (id: string, name: string, priceCents: number) => ({
  id, name, priceCents, ingredients: null, imageUrl: null, updatedAt: '2026-01-01T00:00:00Z', productType: { id: TYPE_ID, description: 'BURGER', color: '#000000' },
})
const special = product('product-1', 'Hambúrguer Especial', 2450)

function catalogApi(pageFor: (call: RecordedCall) => { items: unknown[]; nextCursor: string | null; total: number } = () => ({ items: [special], nextCursor: null, total: 1 })) {
  return mockApi((call) => {
    if (call.path === '/v1/product-types') return json(200, [{ id: TYPE_ID, description: 'BURGER', color: '#000000', isActive: true, updatedAt: '2026-01-01T00:00:00Z' }])
    if (call.path === '/v1/products') return json(200, pageFor(call))
    return undefined
  })
}

function renderModal(props: Partial<ProductSelectionModalProps> = {}) {
  const onConfirm = vi.fn(async () => undefined)
  const onClose = vi.fn()
  renderDashboard('/', () => <Route path="/" component={() => (
    <ProductSelectionModal isOpen onClose={onClose} onConfirm={onConfirm} title="New order" {...props} />
  )} />)
  return { onConfirm, onClose }
}

describe('ProductSelectionModal', () => {
  beforeEach(async () => { await i18n.changeLanguage('en') })
  afterEach(() => { vi.unstubAllGlobals() })

  it('translates the modal chrome and the item controls, keeping business names', async () => {
    catalogApi()
    renderModal({ initialClientName: 'Mesa 7', initialItems: [{ productId: special.id, quantity: 2, name: special.name, unitPriceCents: 2450 }] })

    expect(await screen.findByText('Select products and enter the customer.')).toBeInTheDocument()
    expect(screen.getByLabelText('Customer / Table')).toHaveValue('Mesa 7')
    expect(screen.getByPlaceholderText('E.g. Table 10 or customer name')).toBeInTheDocument()
    expect(screen.getByText('Selected items')).toBeInTheDocument()
    expect(screen.getByText('Total:')).toBeInTheDocument()
    expect(screen.getByText('R$49.00')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Close' }).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument()
    expect(screen.getByText('Available products')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Add product' })).toBeInTheDocument()
    expect(screen.getAllByText('Hambúrguer Especial')).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Decrease quantity' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Increase quantity' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove item' })).toBeInTheDocument()
    expect(screen.queryByText('Selecione os produtos e informe o cliente.')).not.toBeInTheDocument()
  })

  it('uses the read-only sale actions and does not load the catalog', async () => {
    const api = catalogApi()
    renderModal({ title: 'Sale details', readOnly: true, onCancelSale: vi.fn(async () => undefined) })
    expect(await screen.findByRole('button', { name: 'Cancel sale' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Close' }).length).toBeGreaterThan(0)
    expect(api.calls).toHaveLength(0)
  })

  it('passes an empty customer through instead of a translated fallback', async () => {
    catalogApi()
    const user = userEvent.setup()
    const { onConfirm, onClose } = renderModal({ initialItems: [{ productId: 'p4', quantity: 1, name: 'Burger', unitPriceCents: 1200 }] })
    await user.click(await screen.findByRole('button', { name: 'Confirm' }))
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith('', [{ productId: 'p4', quantity: 1, unitPriceCents: 1200 }]))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('adds, merges and counts items in cents', async () => {
    catalogApi()
    const user = userEvent.setup()
    const { onConfirm } = renderModal({ mergeSameProducts: true, allowDelivery: true })
    const add = await screen.findByRole('button', { name: 'Add product' })
    await user.click(add)
    await user.click(add)
    await user.click(screen.getByRole('button', { name: 'Increase quantity' }))
    await user.type(screen.getByLabelText('Customer / Table'), ' Mesa 3 ')
    await user.click(screen.getByRole('button', { name: 'Confirm' }))
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith('Mesa 3', [{ productId: 'product-1', quantity: 3, unitPriceCents: 2450 }], { isDelivery: false, deliveryAddress: null }))
  })

  it('asks for at least one item before confirming', async () => {
    catalogApi()
    const warning = vi.spyOn(toast, 'warning').mockImplementation(() => '')
    const user = userEvent.setup()
    const { onConfirm } = renderModal()
    await user.click(await screen.findByRole('button', { name: 'Confirm' }))
    expect(warning).toHaveBeenCalledWith('Please select at least one product.')
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('filters by type and pages the catalog with the cursor, 20 at a time', async () => {
    const api = catalogApi(({ query }) => (query.get('cursor') === 'c2'
      ? { items: [product('p21', 'Water', 450)], nextCursor: null, total: 21 }
      : { items: [special], nextCursor: 'c2', total: 21 }))
    const user = userEvent.setup()
    renderModal()
    expect(await screen.findByText('Page 1 of 2')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(await screen.findByText('Water')).toBeInTheDocument()
    expect(api.to('/v1/products').at(-1)!.query.get('limit')).toBe('20')

    await user.click(screen.getByRole('button', { name: /^Category/ }))
    await user.click(await screen.findByRole('option', { name: 'BURGER' }))
    await waitFor(() => expect(api.to('/v1/products').at(-1)!.query.get('productTypeId')).toBe(TYPE_ID))
    expect(api.to('/v1/products').at(-1)!.query.get('cursor')).toBeNull()
    expect(within(screen.getByRole('dialog')).getByText('Page 1 of 2')).toBeInTheDocument()
  })
})
