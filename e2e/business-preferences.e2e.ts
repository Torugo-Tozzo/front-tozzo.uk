import { expect, test } from '@playwright/test'

test('owner sees business modules grouped beneath profiles without saving changes', async ({ page }) => {
  const email = process.env.E2E_EMAIL
  const password = process.env.E2E_PASSWORD
  test.skip(!email && !password, 'Set E2E_EMAIL and E2E_PASSWORD for the authenticated business preferences test')
  if (!email || !password) throw new Error('Set E2E_EMAIL and E2E_PASSWORD together')

  await page.goto('/login')
  await page.locator('#email').fill(email)
  await page.locator('#password').fill(password)
  await page.locator('form:has(#password) button[type="submit"]').click()
  await expect(page).toHaveURL(/\/dashboard(?:\/[^/?#]+)?$/)

  await page.goto('/dashboard/settings')
  const profiles = page.getByRole('group', { name: /Business profiles|Perfis do negócio/i })
  const food = profiles.getByRole('checkbox', { name: /Food service|Alimentação/i })
  const services = profiles.getByRole('checkbox', { name: /Service provider|Prestador de serviços/i })
  await expect(food).toBeVisible()
  await expect(services).toBeVisible()
  await expect(profiles.getByRole('group', { name: /Food service|Alimentação/i }).getByRole('checkbox', { name: /Ingredient inventory|Estoque de ingredientes/i })).toBeVisible()
  await expect(profiles.getByRole('group', { name: /Store|Loja/i }).getByRole('checkbox', { name: /Store inventory|Estoque da loja/i })).toBeVisible()

  if (!(await services.isChecked())) await services.check()
  const serviceGroup = profiles.getByRole('group', { name: /Service provider|Prestador de serviços/i })
  await expect(serviceGroup.getByRole('checkbox', { name: /Estimates|Orçamentos/i })).toBeChecked()
  const general = page.getByRole('group', { name: /Modules in the menu|Módulos no menu/i })
  await expect(general.getByRole('checkbox', { name: /Schedule|Horários/i })).toBeVisible()
  await expect(page.getByRole('list', { name: /Menu preview|Prévia do menu/i })).toHaveCount(0)
})
