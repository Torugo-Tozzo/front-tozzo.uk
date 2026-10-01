import type { Page } from '@playwright/test'
import type { ServiceOffering, ServiceOrder, ServiceOrderItem } from '../src/domain/services'

// Browser assertions use a controlled HTTP boundary; persistence and concurrency
// are covered by the API's disposable PostgreSQL tests.
export async function serviceWorkspace(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('tozzo.locale', 'en')
    const expiresAt = Math.floor(Date.now() / 1000) + 3600
    const token = [btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })), btoa(JSON.stringify({ sub: 'browser-fixture', exp: expiresAt, aal: 'aal1' })), 'fixture'].join('.')
    localStorage.setItem('supabase.auth.token', JSON.stringify({
      access_token: token, refresh_token: 'browser-fixture', token_type: 'bearer',
      expires_at: expiresAt, expires_in: 3600,
      user: { id: 'browser-fixture', email: 'fixture@example.invalid', app_metadata: {}, user_metadata: {}, aud: 'authenticated', created_at: new Date().toISOString() },
    }))
    const nativeFetch = window.fetch.bind(window)
    window.fetch = (input, init) => {
      const target = input instanceof Request ? input.url : String(input)
      if (!target.includes('/events?token=')) return nativeFetch(input, init)
      const stream = new ReadableStream<Uint8Array>({ start(controller) {
        ;(window as any).__serviceFixtureEvents = controller
        controller.enqueue(new TextEncoder().encode(': connected\n\n'))
      } })
      return Promise.resolve(new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } }))
    }
  })
  const longDescription = 'Vacuum the seats and floor, clean accessories, polish panels, and inspect every surface.\n'.repeat(45)
  const offerings: ServiceOffering[] = [{ id: 'catalog-1', establishmentId: 'tenant-1', name: 'Detailed cleaning', description: longDescription, referencePrice: 102.5 }]
  const products = [{ id: 'oil-1', name: 'Motor oil', ingredients: 'Synthetic lubricant for engine maintenance', price: 40 }]
  const orders: ServiceOrder[] = []
  const requests: { method: string; path: string; body: any }[] = []
  let revision = 0
  const stamp = () => new Date(Date.UTC(2026, 9, 1, 12, 0, ++revision)).toISOString()
  const lines = (inputs: any[], supplement = false): ServiceOrderItem[] => inputs.map((input, index) => {
    const offering = offerings.find(item => item.id === input.serviceOfferingId)
    return {
      id: `line-${revision}-${index}`, kind: input.productId ? 'PRODUCT' : 'SERVICE',
      productId: input.productId ?? null, serviceOfferingId: input.serviceOfferingId ?? null,
      description: input.productId ? 'Motor oil' : offering?.name ?? input.description,
      details: input.details ?? offering?.description ?? null,
      quantity: input.quantity, unitPrice: input.productId ? 40 : input.unitPrice ?? offering?.referencePrice ?? 0,
      isSupplement: supplement,
    }
  })
  const total = (items: ServiceOrderItem[]) => items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)

  await page.route('**/*', async route => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname.replace(/^\/api(?=\/)/, '')
    const isApi = url.pathname.startsWith('/api/') || ['/servicos', '/ordens-servico', '/usuarios/me', '/estabelecimentos', '/auth/sse-token', '/events', '/produtos', '/usuarios'].some(prefix => path === prefix || path.startsWith(`${prefix}/`))
    if (!isApi) return route.continue()
    const method = request.method()
    const body = request.postData() ? request.postDataJSON() : undefined
    requests.push({ method, path, body })
    const reply = (data: unknown, status = 200, count?: number) => route.fulfill({
      status, contentType: 'application/json', body: JSON.stringify(data),
      headers: count === undefined ? {} : { 'x-total-count': String(count) },
    })
    if (path === '/auth/sse-token') return reply({ token: 'fixture' })
    if (path === '/events') return route.fulfill({ contentType: 'text/event-stream', body: ': fixture\n\n' })
    if (path === '/usuarios/me') return reply({ id: 'owner-1', name: 'Workshop owner', role: 'OWNER', email: 'fixture@example.invalid' })
    if (path === '/estabelecimentos') return reply([{ id: 'tenant-1', tradeName: 'Test workshop', status: 'ACTIVE', businessProfiles: ['SERVICES'], visibleModules: ['SERVICES', 'ESTIMATES', 'SERVICE_ORDERS', 'SALES', 'PRODUCTS', 'EMPLOYEES', 'DEVICES', 'REPORTS', 'SETTINGS'] }])
    if (path === '/usuarios') return reply([{ id: 'owner-1', name: 'Workshop owner' }], 200, 1)
    if (path === '/produtos') {
      const search = (url.searchParams.get('search') ?? '').toLowerCase()
      const result = products.filter(item => `${item.name} ${item.ingredients}`.toLowerCase().includes(search))
      const limit = Number(url.searchParams.get('limit') ?? 10)
      const offset = (Number(url.searchParams.get('page') ?? 1) - 1) * limit
      return reply(result.slice(offset, offset + limit), 200, result.length)
    }
    if (path === '/servicos') {
      if (method === 'POST') {
        const offering = { ...body, id: `catalog-${offerings.length + 1}`, establishmentId: 'tenant-1' }
        offerings.push(offering)
        return reply(offering, 201)
      }
      const search = (url.searchParams.get('search') ?? '').toLowerCase()
      const result = offerings.filter(item => `${item.name} ${item.description ?? ''}`.toLowerCase().includes(search))
      const limit = Number(url.searchParams.get('limit') ?? 10)
      const offset = (Number(url.searchParams.get('page') ?? 1) - 1) * limit
      return reply(result.slice(offset, offset + limit), 200, result.length)
    }
    if (path.startsWith('/servicos/')) {
      const id = path.split('/')[2]
      const index = offerings.findIndex(item => item.id === id)
      if (method === 'DELETE') {
        const references = orders.filter(order => ['ABERTA', 'ORCADA', 'APROVADA', 'EM_EXECUCAO'].includes(order.status) && [...order.items, ...(order.pendingItems ?? [])].some(item => item.serviceOfferingId === id))
        if (references.length) return reply({ code: 'SERVICE_IN_USE', references: references.map(({ id, customerName, status }) => ({ id, customerName, status })) }, 409)
        offerings.splice(index, 1)
        return reply({ deleted: true })
      }
      if (method === 'PATCH') Object.assign(offerings[index]!, body)
      return reply(offerings[index])
    }
    if (path === '/ordens-servico') {
      if (method === 'POST') {
        const order: ServiceOrder = { ...body, id: `order-${orders.length + 1}`, establishmentId: 'tenant-1', status: 'ABERTA', dueAt: null, responsibleId: null, completedAt: null, updatedAt: stamp(), items: [], acceptedQuote: null, pendingItems: [], events: [], total: 0 }
        orders.push(order)
        return reply(order, 201)
      }
      const execution = url.searchParams.get('stage') === 'services'
      const openOnly = url.searchParams.get('open') === 'true'
      const result = orders.filter(order => (!execution || order.acceptedQuote) && (!openOnly || (execution ? ['APROVADA', 'EM_EXECUCAO'] : ['ABERTA', 'ORCADA']).includes(order.status)))
      return reply(result, 200, result.length)
    }
    if (path.startsWith('/ordens-servico/')) {
      const [, , id, action] = path.split('/')
      const order = orders.find(item => item.id === id)!
      if (method === 'GET') return reply(order)
      if (method === 'DELETE') { orders.splice(orders.indexOf(order), 1); return reply({ deleted: true }) }
      if (action === 'orcamento') { order.items = lines(body.items); order.status = 'ORCADA' }
      else if (action === 'adicionais') order.pendingItems = lines(body.items, true)
      else if (action === 'aprovar-adicionais') { order.items.push(...(order.pendingItems ?? [])); order.pendingItems = [] }
      else if (action === 'aprovar') { order.status = 'APROVADA'; order.acceptedQuote = structuredClone(order.items).map(item => ({ ...item, serviceOfferingId: null })) }
      else if (action === 'iniciar') order.status = 'EM_EXECUCAO'
      else if (action === 'fechar') {
        order.status = 'CONCLUIDA'
        order.completedAt = stamp()
        order.sale = { id: 'sale-1', total: total(order.items) }
        order.items = order.items.map(item => ({ ...item, serviceOfferingId: null }))
      }
      else if (action === 'cancelar') order.status = 'CANCELADA'
      else Object.assign(order, body)
      order.total = total(order.items)
      order.updatedAt = stamp()
      await reply(action === 'fechar' ? { order, sale: order.sale } : order)
      await page.evaluate(() => {
        ;(window as any).__serviceFixtureEvents?.enqueue(new TextEncoder().encode('data: {"tipo":"ordens-servico"}\n\n'))
      })
      return
    }
    return reply([], 200, 0)
  })
  return { offerings, products, orders, requests, longDescription }
}
