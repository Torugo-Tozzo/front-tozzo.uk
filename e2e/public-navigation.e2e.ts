import { expect, test } from '@playwright/test'

test('a pessoa consegue ir do login à recuperação de senha e voltar', async ({ page }) => {
  await page.goto('/login')
  await expect(page.locator('#email')).toBeVisible()
  await expect(page.locator('#password')).toBeVisible()

  await page.locator('a[href="/forgot-password"]').click()
  await expect(page).toHaveURL(/\/forgot-password$/)
  await expect(page.locator('#forgot-email')).toBeVisible()

  await page.locator('a[href="/login"]').click()
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.locator('#email')).toBeVisible()
})
