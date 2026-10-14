import { expect, test, type Page } from '@playwright/test'
import { mockV1Api } from './visual/support/mock-v1'

// The dashboard shell of the Solid app (plan S1) against the toV1() dataset:
// session from the refresh cookie, route guards, sidebar, logout and realtime.

const sidebar = (page: Page) => page.getByRole('navigation', { name: 'Dashboard' })
const v1Requests = (page: Page) => {
  const seen: string[] = []
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.hostname === 'api.visual.test') seen.push(`${request.method()} ${url.pathname}${url.search}`)
  })
  return seen
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('tozzo.locale', 'pt-BR'))
})

test('without a session the dashboard sends the user to /login', async ({ page }) => {
  await mockV1Api(page, { role: null })
  await page.goto('/dashboard/orders')
  await expect(page).toHaveURL(/\/login$/)
})

test('an owner lands on orders, with the sidebar counters from the /v1 totals', async ({ page }) => {
  const requests = v1Requests(page)
  const mock = await mockV1Api(page, { role: 'OWNER' })
  await page.goto('/dashboard')

  await expect(page).toHaveURL(/\/dashboard\/orders$/)
  await expect(page.getByText('Victor Tozzo')).toBeVisible()
  await expect(sidebar(page).getByRole('link', { name: /Pedidos/ })).toContainText('6')
  await expect(sidebar(page).getByRole('link', { name: /Cozinha/ })).toContainText('5')
  await expect(sidebar(page).getByRole('link', { name: /Entregas/ })).toContainText('2')
  await expect(sidebar(page).getByRole('link', { name: /^Serviços/ })).toContainText('2')
  expect(requests).toContain('POST /v1/auth/refresh')
  expect(requests).toContain('GET /v1/orders?limit=1')

  await sidebar(page).getByRole('link', { name: /Vendas/ }).click()
  await expect(page).toHaveURL(/\/dashboard\/sales$/)
  await expect(sidebar(page).getByRole('link', { name: /Vendas/ }).getByRole('button')).toHaveClass(/bg-primary/)
  expect(mock.unknown).toEqual([])
})

test('the collapsed sidebar survives a reload', async ({ page }) => {
  await mockV1Api(page, { role: 'OWNER' })
  await page.goto('/dashboard/orders')
  await page.getByRole('button', { name: 'Recolher menu' }).click()
  await expect(page.getByRole('button', { name: 'Expandir menu' })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('button', { name: 'Expandir menu' })).toBeVisible()
})

test('logout asks first, then ends the session and goes to /login', async ({ page }) => {
  const requests = v1Requests(page)
  await mockV1Api(page, { role: 'OWNER' })
  await page.goto('/dashboard/orders')

  await page.getByRole('button', { name: 'Sair', exact: true }).last().click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Cancelar' }).click()
  await expect(dialog).toBeHidden()
  await expect(page).toHaveURL(/\/dashboard\/orders$/)

  await page.getByRole('button', { name: 'Sair', exact: true }).last().click()
  await page.getByRole('dialog').getByRole('button', { name: 'Sair', exact: true }).click()
  await expect(page).toHaveURL(/\/login$/)
  expect(requests).toContain('POST /v1/auth/logout')
})

test('a cook only gets the kitchen', async ({ page }) => {
  await mockV1Api(page, { role: 'COOK' })
  await page.goto('/dashboard/orders')
  await expect(page).toHaveURL(/\/dashboard\/kitchen$/)
  await expect(sidebar(page).getByRole('link')).toHaveCount(1)
  await expect(sidebar(page).getByRole('link', { name: /Cozinha/ })).toBeVisible()
})

test('a realtime event refreshes the sidebar counters', async ({ page }) => {
  const requests = v1Requests(page)
  await mockV1Api(page, { role: 'OWNER' })
  await page.goto('/dashboard/orders')
  await expect(sidebar(page).getByRole('link', { name: /Pedidos/ })).toContainText('6')
  expect(requests).toContain('POST /v1/events/ticket')
  const opened = await page.evaluate(() => (window as unknown as { __eventStreams: { url: string }[] }).__eventStreams.map((stream) => stream.url))
  expect(opened).toEqual(['http://api.visual.test/v1/events?ticket=visual-fixture'])

  const before = requests.filter((entry) => entry.startsWith('GET /v1/kitchen/orders')).length
  await page.evaluate(() => (window as unknown as { __eventStreams: { emit: (data: unknown) => void }[] }).__eventStreams[0].emit({ type: 'order.changed', id: 'x' }))
  await expect.poll(() => requests.filter((entry) => entry.startsWith('GET /v1/kitchen/orders')).length).toBeGreaterThan(before)
})
