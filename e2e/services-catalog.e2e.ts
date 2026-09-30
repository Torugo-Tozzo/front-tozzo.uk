import { expect, test } from '@playwright/test'

test('service catalog can create, search, edit, and deactivate an offering', async ({ page }) => {
  const email = process.env.E2E_SERVICE_EMAIL
  const password = process.env.E2E_SERVICE_PASSWORD
  test.skip(!email || !password, 'Configure um login exclusivo E2E_SERVICE_EMAIL/E2E_SERVICE_PASSWORD para este tenant de teste.')
  if (!email || !password) throw new Error('Configure E2E_SERVICE_EMAIL e E2E_SERVICE_PASSWORD juntos.')
  test.setTimeout(90_000)

  await page.goto('/login')
  await page.locator('#email').fill(email)
  await page.locator('#password').fill(password)
  await page.locator('form:has(#password) button[type="submit"]').click()
  await expect(page).toHaveURL(/\/dashboard(?:\/sales)?$/)
  await page.goto('/dashboard/services')
  await expect(page.getByRole('heading', { level: 1, name: 'Services' })).toBeVisible()

  const serviceName = `E2E service ${Date.now()}`
  await page.getByRole('button', { name: 'New service' }).click()
  let dialog = page.getByRole('dialog')
  await dialog.getByRole('textbox', { name: 'Service name' }).fill(serviceName)
  await dialog.getByRole('textbox', { name: 'Description' }).fill('Created by isolated catalog E2E')
  await dialog.getByRole('textbox', { name: 'Reference price' }).fill('35')
  const createResponse = page.waitForResponse((response) => new URL(response.url()).pathname === '/servicos' && response.request().method() === 'POST')
  await dialog.getByRole('button', { name: 'Create service' }).click()
  expect((await createResponse).status()).toBe(201)

  const search = page.getByRole('searchbox', { name: 'Search services' })
  await search.fill(serviceName)
  let row = page.getByRole('row').filter({ hasText: serviceName })
  await expect(row).toBeVisible()
  await row.getByRole('button', { name: `Edit service ${serviceName}` }).click()
  dialog = page.getByRole('dialog')
  await dialog.getByRole('textbox', { name: 'Service name' }).fill(`${serviceName} updated`)
  const updateResponse = page.waitForResponse((response) => response.url().includes('/servicos/') && response.request().method() === 'PATCH')
  await dialog.getByRole('button', { name: 'Update service' }).click()
  expect((await updateResponse).status()).toBe(200)

  row = page.getByRole('row').filter({ hasText: `${serviceName} updated` })
  await row.getByRole('button', { name: `Deactivate service ${serviceName} updated` }).click()
  dialog = page.getByRole('dialog').last()
  const deactivateResponse = page.waitForResponse((response) => response.url().includes('/servicos/') && response.request().method() === 'PATCH')
  await dialog.getByRole('button', { name: 'Deactivate service' }).click()
  expect((await deactivateResponse).status()).toBe(200)
  await page.getByRole('combobox', { name: 'Service status' }).selectOption('false')
  await expect(page.getByRole('row').filter({ hasText: `${serviceName} updated` })).toBeVisible()
})
