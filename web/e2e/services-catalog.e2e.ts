import { expect, test, type Page } from '@playwright/test'
import { mockV1Api } from './visual/support/mock-v1'

type Service = { id: string; name: string; description: string | null; referencePriceCents: number | null; createdAt: string; updatedAt: string }
const sample: Service = { id: 's1', name: 'Repair', description: 'General repair', referencePriceCents: 4500, createdAt: '2026-10-01T18:00:00Z', updatedAt: '2026-10-01T18:00:00Z' }
async function backend(page: Page, options: { role?: 'OWNER' | 'MANAGER'; blockDelete?: boolean; failEdit?: boolean } = {}) {
  await mockV1Api(page, { role: options.role ?? 'OWNER' })
  let services = [sample]
  let failEdit = !!options.failEdit
  const calls: { method: string; path: string; body: unknown }[] = []
  await page.route(url => url.hostname === 'api.visual.test' && url.pathname.startsWith('/v1/services'), async route => {
    const request = route.request()
    if (request.method() === 'OPTIONS') return route.fallback()
    const url = new URL(request.url())
    const method = request.method()
    const body = request.postDataJSON() as Partial<Service> | null
    if (method !== 'GET') calls.push({ method, path: url.pathname, body })
    let status = 200
    let reply: unknown
    if (method === 'GET') {
      const items = services.filter(service => service.name.toLowerCase().includes((url.searchParams.get('search') ?? '').toLowerCase()))
      reply = { items, nextCursor: null, total: items.length }
    } else if (method === 'POST') {
      const service = { ...sample, id: 's2', description: null, referencePriceCents: null, ...body }
      services.push(service); status = 201; reply = service
    } else if (method === 'PATCH') {
      if (failEdit) { failEdit = false; status = 409; reply = { title: 'Conflict', status, code: 'SERVICE_CONFLICT' } }
      else { services = services.map(service => service.id === url.pathname.split('/').at(-1) ? { ...service, ...body } : service); reply = services.find(service => service.id === url.pathname.split('/').at(-1)) }
    } else if (method === 'DELETE') {
      if (options.blockDelete) { status = 409; reply = { title: 'Conflict', status, code: 'SERVICE_IN_USE', references: [{ id: 'quote1', customerName: 'Jo', status: 'QUOTED' }, { id: 'work1', customerName: 'Sam', status: 'IN_PROGRESS' }] } }
      else { services = services.filter(service => service.id !== url.pathname.split('/').at(-1)); status = 204 }
    }
    await route.fulfill({ status, contentType: status >= 400 ? 'application/problem+json' : 'application/json', headers: { 'Access-Control-Allow-Origin': request.headers().origin ?? '*', 'Access-Control-Allow-Credentials': 'true' }, body: reply === undefined ? '' : JSON.stringify(reply) })
  })
  return calls
}

test.beforeEach(async ({ page }) => { await page.addInitScript(() => localStorage.setItem('tozzo.locale', 'en')) })

test('services: create with optional price, edit in cents, search and delete', async ({ page }) => {
  const calls = await backend(page)
  await page.goto('/dashboard/services', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('cell', { name: 'Repair', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'New service' }).click()
  await page.getByLabel('Service name', { exact: true }).fill('Inspection')
  await page.getByRole('button', { name: 'Create service', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(calls[0].body).toEqual({ name: 'Inspection' })
  await page.getByRole('button', { name: 'Edit service Inspection', exact: true }).click()
  await page.getByLabel('Reference price', { exact: true }).pressSequentially('1245')
  await page.getByLabel('Description', { exact: true }).fill('Detailed inspection')
  await page.getByRole('button', { name: 'Update service', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(calls[1].body).toEqual({ name: 'Inspection', description: 'Detailed inspection', referencePriceCents: 1245 })
  await page.getByRole('searchbox', { name: 'Search services' }).fill('Inspection')
  await expect(page.getByRole('cell', { name: 'Repair', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Delete service Inspection', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete service', exact: true }).click()
  await expect(page.locator('main').getByText('No services match your search.')).toBeVisible()
  expect(calls[2]).toMatchObject({ method: 'DELETE', path: '/v1/services/s2' })
})

test('services: failed edit preserves the form; in-use deletion links real references', async ({ page }) => {
  const calls = await backend(page, { failEdit: true, blockDelete: true })
  await page.goto('/dashboard/services', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Edit service Repair', exact: true }).click()
  await page.getByLabel('Service name', { exact: true }).fill('Repaired name')
  await page.getByRole('button', { name: 'Update service', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Could not save the service.')
  await expect(page.getByLabel('Service name', { exact: true })).toHaveValue('Repaired name')
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await page.getByRole('button', { name: 'Delete service Repair', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete service', exact: true }).click()
  await expect(page.getByRole('link', { name: /Jo/ })).toHaveAttribute('href', '/dashboard/estimates/quote1')
  await expect(page.getByRole('link', { name: /Sam/ })).toHaveAttribute('href', '/dashboard/service-orders/work1')
  expect(calls).toHaveLength(2)
})

test('services: manager reads the catalog without mutation controls', async ({ page }) => {
  await backend(page, { role: 'MANAGER' })
  await page.goto('/dashboard/services', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('cell', { name: 'Repair', exact: true })).toBeVisible({ timeout: 20_000 })
  await expect(page.getByRole('button', { name: /New service|Edit service|Delete service/ })).toHaveCount(0)
})
