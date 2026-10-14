import { Route } from '@solidjs/router'
import { screen, waitFor, within } from '@solidjs/testing-library'
import userEvent from '@testing-library/user-event'
import { toast } from 'solid-sonner'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n/config'
import { json, mockApi, noContent, problem, type RecordedCall } from '@/test/api'
import { resetAuthMocks, setMockUser } from '@/test/auth-mock'
import { confirmDialog, dialogClosed, renderDashboard } from '@/test/dashboard'
import ProductsPage from './ProductsPage'

vi.mock('@/contexts/AuthContext', () => import('@/test/auth-mock'))

const UUID_TYPE = '550e8400-e29b-41d4-a716-446655440000'
type TypeRow = { id: string; description: string; color?: string; isActive?: boolean }
const typeRow = ({ id, description, color = '#9E9E9E', isActive = true }: TypeRow) => ({ id, description, color, isActive, updatedAt: '2026-01-01T00:00:00Z' })
const product = (id: string, name: string, priceCents: number, type: TypeRow | null = null, extra: Record<string, unknown> = {}) => ({
  id, name, priceCents, ingredients: null, imageUrl: null, updatedAt: '2026-01-01T00:00:00Z',
  productType: type ? { id: type.id, description: type.description, color: type.color ?? '#9E9E9E' } : null, ...extra,
})

type Handler = (call: RecordedCall) => Response | undefined
function catalogApi(types: TypeRow[], products: unknown[] = [], handler: Handler = () => undefined) {
  return mockApi((call) => {
    const answer = handler(call)
    if (answer) return answer
    if (call.method === 'GET' && call.path === '/v1/product-types') return json(200, types.map(typeRow))
    if (call.method === 'GET' && call.path === '/v1/products') return json(200, { items: products, nextCursor: null, total: products.length })
    return undefined
  })
}

const renderPage = () => renderDashboard('/dashboard/products', () => <Route path="/dashboard/products" component={ProductsPage} />)
const firstPost = (calls: RecordedCall[], path: string) => calls.find((call) => call.method === 'POST' && call.path === path)

describe('ProductsPage', () => {
  beforeEach(async () => {
    resetAuthMocks()
    localStorage.clear()
    await i18n.changeLanguage('en')
  })
  afterEach(() => { vi.unstubAllGlobals() })

  for (const role of ['OWNER', 'MANAGER'] as const) {
    it(`allows ${role} to create a product without types`, async () => {
      setMockUser({ role })
      const api = catalogApi([], [], ({ method, path }) => (method === 'POST' && path === '/v1/products' ? json(201, product('p1', 'Coffee', 500)) : undefined))
      const user = userEvent.setup()
      renderPage()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'New product' }))
      await user.type(await screen.findByRole('textbox', { name: 'Name' }), 'Coffee')
      await user.type(screen.getByRole('textbox', { name: 'Price' }), '500')
      expect(screen.getByRole('textbox', { name: 'Price' })).toHaveValue('5.00')
      await user.click(screen.getByRole('button', { name: 'Save' }))
      await waitFor(() => expect(firstPost(api.calls, '/v1/products')?.body).toEqual({ name: 'Coffee', priceCents: 500, ingredients: '' }))
    })
  }

  it('renders an untyped product without a type badge or color', async () => {
    setMockUser({ role: 'OWNER' })
    catalogApi([], [product('p1', 'Coffee', 500)])
    renderPage()
    const row = (await screen.findByText('Coffee')).closest('tr')!
    expect(within(row).getAllByRole('cell')[2]).toBeEmptyDOMElement()
    expect(within(row).getByText('R$5.00')).toBeInTheDocument()
  })

  it('clears an existing type when editing a product', async () => {
    setMockUser({ role: 'OWNER' })
    const drinks = { id: 't1', description: 'Drinks' }
    const api = catalogApi([drinks], [product('p1', 'Coffee', 500, drinks)], ({ method }) => (method === 'PATCH' ? json(200, product('p1', 'Coffee', 500)) : undefined))
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Edit' }))
    await user.click(await screen.findByRole('button', { name: /^Type/ }))
    await user.click(await screen.findByRole('option', { name: 'No type' }))
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(api.calls.find((call) => call.method === 'PATCH')).toMatchObject({
      path: '/v1/products/p1',
      body: { name: 'Coffee', priceCents: 500, ingredients: '', productTypeId: null },
    }))
  })

  it('keeps product creation available and submits the selected active type', async () => {
    setMockUser({ role: 'OWNER' })
    const api = catalogApi([{ id: '1', description: 'Burger' }], [], ({ method, path }) => (method === 'POST' && path === '/v1/products' ? json(201, product('p1', 'Burger', 1250)) : undefined))
    const user = userEvent.setup()
    renderPage()

    const newProduct = screen.getByRole('button', { name: 'New product' })
    expect(newProduct).toBeEnabled()
    await user.click(newProduct)
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByRole('textbox', { name: 'Name' }), 'Burger')
    await user.type(within(dialog).getByRole('textbox', { name: 'Price' }), '1250')
    const typeSelect = dialog.querySelector('select[name="productTypeId"]') as HTMLSelectElement
    expect(typeSelect).not.toBeNull()
    expect(typeSelect.hasAttribute('required')).toBe(false)

    await user.click(within(dialog).getByRole('button', { name: /^Type/ }))
    await user.click(await screen.findByRole('option', { name: 'Burger' }))
    expect(typeSelect).toHaveValue('1')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(firstPost(api.calls, '/v1/products')?.body).toEqual({ name: 'Burger', priceCents: 1250, ingredients: '', productTypeId: '1' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('renders the chrome with the establishment name and preserves UUID type ids', async () => {
    setMockUser({ role: 'OWNER', establishment: { id: 'e', tradeName: 'Café da Nina', status: 'ACTIVE', plan: 'PAID', category: null, preferencesRevision: 0 } })
    const custom = { id: UUID_TYPE, description: 'CUSTOM_UUID_TYPE' }
    const api = catalogApi([custom], [product('42', 'Existing UUID Burger', 1500, custom, { ingredients: 'beef' })], ({ method }) => (method === 'PATCH' ? json(200, product('42', 'Existing UUID Burger', 1500, custom)) : undefined))
    const user = userEvent.setup()
    renderPage()

    expect(screen.getByRole('heading', { name: 'Management — Café da Nina' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Products' })).toBeInTheDocument()
    expect(await screen.findByText('Total records: 1')).toBeInTheDocument()
    expect(await screen.findByText('CUSTOM_UUID_TYPE')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Edit' }))
    await user.click(await screen.findByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(api.calls.find((call) => call.method === 'PATCH')?.body).toEqual({
      name: 'Existing UUID Burger', priceCents: 1500, ingredients: 'beef', productTypeId: UUID_TYPE,
    }))
  })

  it('explains the plan product limit', async () => {
    setMockUser({ role: 'OWNER' })
    catalogApi([], [], ({ method }) => (method === 'POST' ? problem(403, 'PRODUCT_LIMIT_REACHED') : undefined))
    const toastError = vi.spyOn(toast, 'error').mockImplementation(() => '')
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: 'New product' }))
    await user.type(await screen.findByRole('textbox', { name: 'Name' }), 'Coffee')
    await user.type(screen.getByRole('textbox', { name: 'Price' }), '500')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Product limit reached on your current plan.'))
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Coffee')
  })

  it('deletes a product after confirming', async () => {
    setMockUser({ role: 'OWNER' })
    let deleted = false
    const api = mockApi(({ method, path }) => {
      if (method === 'DELETE' && path === '/v1/products/p1') { deleted = true; return noContent() }
      if (path === '/v1/product-types') return json(200, [])
      if (path === '/v1/products') return json(200, { items: deleted ? [] : [product('p1', 'Coffee', 500)], nextCursor: null, total: deleted ? 0 : 1 })
      return undefined
    })
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Delete' }))
    await confirmDialog(user, 'Delete')
    await waitFor(() => expect(api.calls.some((call) => call.method === 'DELETE')).toBe(true))
    expect(await screen.findByText('No products found.')).toBeInTheDocument()
  })

  it('searches products and pages with the cursor', async () => {
    setMockUser({ role: 'OWNER' })
    const api = mockApi(({ path, query }) => {
      if (path === '/v1/product-types') return json(200, [])
      if (path !== '/v1/products') return undefined
      if (query.get('cursor') === 'c2') return json(200, { items: [product('p11', 'Water', 450)], nextCursor: null, total: 11 })
      if (query.get('search') === 'x') return json(200, { items: [product('p3', 'X-Burger', 2490)], nextCursor: null, total: 1 })
      return json(200, { items: [product('p1', 'Coffee', 500)], nextCursor: 'c2', total: 11 })
    })
    const user = userEvent.setup()
    renderPage()
    expect(await screen.findByText('Page 1 of 2')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(await screen.findByText('Water')).toBeInTheDocument()
    expect(screen.getByText('11')).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText('Search products...'), 'x')
    expect(await screen.findByText('X-Burger')).toBeInTheDocument()
    const last = api.to('/v1/products').at(-1)!
    expect([last.query.get('search'), last.query.get('cursor'), last.query.get('limit')]).toEqual(['x', null, '10'])
  })

  it('lists, creates, edits and deletes product types', async () => {
    setMockUser({ role: 'OWNER' })
    let types: TypeRow[] = [{ id: 't1', description: 'Drinks', color: '#3b82f6' }, { id: 't2', description: 'Old', isActive: false }]
    const api = mockApi(({ method, path, body }) => {
      if (method === 'GET' && path === '/v1/product-types') return json(200, types.map(typeRow))
      if (method === 'GET' && path === '/v1/products') return json(200, { items: [], nextCursor: null, total: 0 })
      if (method === 'POST' && path === '/v1/product-types') {
        const created = { id: 't3', ...(body as { description: string; color: string }) }
        types = [...types, created]
        return json(201, typeRow(created))
      }
      if (method === 'PATCH' && path === '/v1/product-types/t1') return json(200, typeRow({ id: 't1', description: 'Beverages' }))
      if (method === 'DELETE' && path === '/v1/product-types/t2') { types = types.filter((type) => type.id !== 't2'); return noContent() }
      return undefined
    })
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('tab', { name: 'Types' }))
    expect(await screen.findByText('Drinks')).toBeInTheDocument()
    expect(screen.getByText('Old (inactive)')).toBeInTheDocument()
    expect(screen.getByText('Total records: 2')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'New type' }))
    const createDialog = await screen.findByRole('dialog')
    await user.type(within(createDialog).getByLabelText('Description'), 'Desserts')
    await user.click(within(createDialog).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(firstPost(api.calls, '/v1/product-types')?.body).toEqual({ description: 'Desserts', color: '#000000' }))
    expect(await screen.findByText('Desserts')).toBeInTheDocument()

    await dialogClosed()
    const drinksRow = screen.getByText('Drinks').closest('tr')!
    await user.click(within(drinksRow).getByRole('button', { name: 'Edit' }))
    const editDialog = await screen.findByRole('dialog')
    const description = within(editDialog).getByLabelText('Description')
    await user.clear(description)
    await user.type(description, 'Beverages')
    await user.click(within(editDialog).getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(api.calls.find((call) => call.method === 'PATCH')?.body).toEqual({ description: 'Beverages', color: '#3b82f6' }))
    await dialogClosed()

    const oldRow = screen.getByText('Old (inactive)').closest('tr')!
    await user.click(within(oldRow).getByRole('button', { name: 'Delete' }))
    await confirmDialog(user, 'Delete')
    await waitFor(() => expect(screen.queryByText('Old (inactive)')).toBeNull())
    // Deleting a type deletes its products: the product list is loaded again.
    expect(api.to('/v1/products').length).toBeGreaterThan(1)
  })

  it('shows its own skeleton while the list loads, not the suspense fallback', async () => {
    setMockUser({ role: 'OWNER' })
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Products' })).toBeInTheDocument()
    expect(screen.getByText('Total records: 0')).toBeInTheDocument()
    expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
    expect(screen.queryByText('Suspended')).toBeNull()
  })

  describe('image upload', () => {
    const png = () => new File([new Uint8Array(16)], 'photo.png', { type: 'image/png' })

    it('uploads through the pre-signed URL and associates the key with the product', async () => {
      setMockUser({ role: 'OWNER' })
      const put = vi.fn()
      const api = catalogApi([], [product('p1', 'Coffee', 500)], ({ method, path }) => {
        if (method === 'POST' && path === '/v1/uploads') {
          return json(200, { uploadUrl: 'https://bucket.r2.test/establishments/e/products/p1/u.png?sig=1', objectKey: 'establishments/e/products/p1/u.png', expiresAt: '2026-10-01T18:05:00Z', headers: { 'Content-Type': 'image/png', 'Content-Length': '16' } })
        }
        if (method === 'PUT' && path === '/establishments/e/products/p1/u.png') { put(); return new Response(null, { status: 200 }) }
        if (method === 'PATCH' && path === '/v1/products/p1') return json(200, product('p1', 'Coffee', 500, null, { imageUrl: 'https://media.r2.test/establishments/e/products/p1/u.png' }))
        return undefined
      })
      const toastSuccess = vi.spyOn(toast, 'success').mockImplementation(() => '')
      const user = userEvent.setup()
      renderPage()
      await user.click(await screen.findByRole('button', { name: 'Edit' }))
      await user.upload(await screen.findByLabelText('Image'), png())

      await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Image updated.'))
      expect(firstPost(api.calls, '/v1/uploads')?.body).toEqual({ kind: 'product', targetId: 'p1', contentType: 'image/png', sizeBytes: 16 })
      expect(put).toHaveBeenCalledTimes(1)
      expect(api.calls.find((call) => call.method === 'PATCH')?.body).toEqual({ imageKey: 'establishments/e/products/p1/u.png' })
      expect(screen.getByRole('img', { name: 'Current product image' })).toHaveAttribute('src', 'https://media.r2.test/establishments/e/products/p1/u.png')
    })

    it('keeps the form of the product open now when an earlier upload finishes', async () => {
      setMockUser({ role: 'OWNER' })
      let finishUpload: (response: Response) => void = () => {}
      const api = catalogApi([], [product('pA', 'Coffee', 500), product('pB', 'Tea', 700)], ({ method, path }) => {
        if (method === 'POST' && path === '/v1/uploads') return undefined
        if (method === 'PATCH' && path === '/v1/products/pA') return json(200, product('pA', 'Coffee', 500, null, { imageUrl: 'https://media.r2.test/a.png' }))
        if (method === 'PATCH' && path === '/v1/products/pB') return json(200, product('pB', 'Green tea', 700))
        return undefined
      })
      // The upload of A answers only when the test says so.
      const handled = vi.mocked(fetch).getMockImplementation()!
      vi.mocked(fetch).mockImplementation(async (input, init) => {
        const request = input instanceof Request ? input : new Request(input as string, init)
        if (new URL(request.url).pathname === '/v1/uploads') {
          return new Promise<Response>((resolve) => { finishUpload = resolve })
        }
        if (request.method === 'PUT') return new Response(null, { status: 200 })
        return handled(input, init)
      })
      vi.spyOn(toast, 'success').mockImplementation(() => '')
      const user = userEvent.setup()
      renderPage()

      const coffee = (await screen.findByText('Coffee')).closest('tr')!
      await user.click(within(coffee).getByRole('button', { name: 'Edit' }))
      await user.upload(await screen.findByLabelText('Image'), png())
      await user.keyboard('{Escape}')
      await dialogClosed()

      await user.click(within(screen.getByText('Tea').closest('tr')!).getByRole('button', { name: 'Edit' }))
      const nameInput = await screen.findByRole('textbox', { name: 'Name' })
      expect(nameInput).toHaveValue('Tea')

      finishUpload(json(200, { uploadUrl: 'https://bucket.r2.test/a.png', objectKey: 'k/a.png', expiresAt: '2026-10-01T18:05:00Z', headers: {} }))
      await waitFor(() => expect(api.calls.some((call) => call.method === 'PATCH' && call.path === '/v1/products/pA')).toBe(true))
      expect(nameInput).toHaveValue('Tea')
      expect(screen.queryByRole('img', { name: 'Current product image' })).toBeNull()

      await user.clear(nameInput)
      await user.type(nameInput, 'Green tea')
      await waitFor(() => expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled())
      await user.click(screen.getByRole('button', { name: 'Save changes' }))
      await waitFor(() => expect(api.calls.find((call) => call.path === '/v1/products/pB')?.body).toEqual({
        name: 'Green tea', priceCents: 700, ingredients: '', productTypeId: null,
      }))
      expect(api.calls.filter((call) => call.method === 'PATCH' && call.path === '/v1/products/pA')).toHaveLength(1)
    })

    it('explains that uploads are off when the API has no bucket (503 NOT_READY)', async () => {
      setMockUser({ role: 'OWNER' })
      const api = catalogApi([], [product('p1', 'Coffee', 500)], ({ method, path }) => (method === 'POST' && path === '/v1/uploads' ? problem(503, 'NOT_READY') : undefined))
      const toastError = vi.spyOn(toast, 'error').mockImplementation(() => '')
      const user = userEvent.setup()
      renderPage()
      await user.click(await screen.findByRole('button', { name: 'Edit' }))
      await user.upload(await screen.findByLabelText('Image'), png())

      await waitFor(() => expect(toastError).toHaveBeenCalledWith('Image upload is not available yet.'))
      expect(api.calls.some((call) => call.method === 'PATCH')).toBe(false)
      // The dialog stays usable.
      expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled()
    })

    it('refuses a file the API would not take, without calling it', async () => {
      setMockUser({ role: 'OWNER' })
      const api = catalogApi([], [product('p1', 'Coffee', 500)])
      const toastError = vi.spyOn(toast, 'error').mockImplementation(() => '')
      const user = userEvent.setup({ applyAccept: false })
      renderPage()
      await user.click(await screen.findByRole('button', { name: 'Edit' }))
      await user.upload(await screen.findByLabelText('Image'), new File(['x'], 'doc.gif', { type: 'image/gif' }))
      await waitFor(() => expect(toastError).toHaveBeenCalledWith('Use a JPEG, PNG or WebP image up to 5 MB.'))
      expect(firstPost(api.calls, '/v1/uploads')).toBeUndefined()
    })
  })
})
