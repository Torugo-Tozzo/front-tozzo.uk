import { expect, test } from '@playwright/test'

test('service estimate proceeds through execution and closes into one linked sale', async ({ page, baseURL }) => {
  const email = process.env.E2E_SERVICE_EMAIL
  const password = process.env.E2E_SERVICE_PASSWORD
  const host = new URL(baseURL ?? 'http://localhost:5173').hostname
  test.skip(!['localhost', '127.0.0.1'].includes(host) || !email || !password, 'Requires a dedicated test tenant and local E2E_SERVICE_EMAIL/E2E_SERVICE_PASSWORD credentials.')
  if (!email || !password) throw new Error('Configure E2E_SERVICE_EMAIL and E2E_SERVICE_PASSWORD together.')
  test.setTimeout(120_000)

  await page.goto('/login')
  await page.locator('#email').fill(email)
  await page.locator('#password').fill(password)
  await page.locator('form:has(#password) button[type="submit"]').click()
  await expect(page).toHaveURL(/\/dashboard(?:\/sales)?$/)

  const suffix = Date.now()
  const serviceName = `E2E repair ${suffix}`
  await page.goto('/dashboard/services')
  await page.getByRole('button', { name: 'New service' }).click()
  const serviceDialog = page.getByRole('dialog')
  await serviceDialog.getByRole('textbox', { name: 'Service name' }).fill(serviceName)
  await serviceDialog.getByRole('textbox', { name: 'Reference price' }).fill('9500')
  const serviceResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/servicos' && response.request().method() === 'POST')
  await serviceDialog.getByRole('button', { name: 'Create service' }).click()
  expect((await serviceResponse).status()).toBe(201)

  await page.goto('/dashboard/estimates')
  await page.getByRole('button', { name: 'Create estimate' }).click()
  await page.getByLabel('Customer name').fill(`E2E customer ${suffix}`)
  await page.getByLabel('Work description').fill('Service order lifecycle E2E')
  const orderResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/ordens-servico' && response.request().method() === 'POST')
  await page.getByRole('button', { name: 'Create estimate' }).click()
  const created = await orderResponse
  expect(created.status()).toBe(201)
  await expect(page).toHaveURL(/\/dashboard\/estimates\/[^/]+$/)

  await page.getByRole('button', { name: 'Add service', exact: true }).click()
  await page.getByRole('dialog').getByLabel('Search catalog services').fill(serviceName)
  await page.getByRole('dialog').getByRole('button', { name: `Add service ${serviceName}`, exact: true }).click()
  const quoteResponse = page.waitForResponse(response => new URL(response.url()).pathname.endsWith('/orcamento') && response.request().method() === 'PUT')
  await page.getByRole('button', { name: 'Save estimate' }).click()
  expect((await quoteResponse).status()).toBe(200)
  const approveResponse = page.waitForResponse(response => new URL(response.url()).pathname.endsWith('/aprovar') && response.request().method() === 'POST')
  await page.getByRole('button', { name: 'Approve estimate' }).click()
  expect((await approveResponse).status()).toBe(200)
  const startResponse = page.waitForResponse(response => new URL(response.url()).pathname.endsWith('/iniciar') && response.request().method() === 'POST')
  await page.getByRole('button', { name: 'Start work' }).click()
  expect((await startResponse).status()).toBe(200)

  await page.getByRole('button', { name: 'Close order and record sale' }).click()
  const confirmation = page.getByRole('dialog').last()
  const closeResponse = page.waitForResponse(response => new URL(response.url()).pathname.endsWith('/fechar') && response.request().method() === 'POST')
  await confirmation.getByRole('button', { name: 'Close order and record sale' }).click()
  const closed = await closeResponse
  expect(closed.status()).toBe(200)
  const closeBody = await closed.json()
  const saleId = String(closeBody.sale.id)
  await expect(page.getByText(new RegExp(`Linked sale: #${saleId}`))).toBeVisible()
  await page.reload()
  await expect(page.getByText(new RegExp(`Linked sale: #${saleId}`))).toBeVisible()
  await expect(page.getByRole('button', { name: 'Close order and record sale' })).toHaveCount(0)
})
