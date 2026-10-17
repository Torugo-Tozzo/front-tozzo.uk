import { expect, test } from '@playwright/test'
import { mockV1Api } from './visual/support/mock-v1'

test('schedule navigation keeps decorative icons out of the accessibility tree', async ({ page }) => {
  await mockV1Api(page)
  await page.goto('/dashboard/schedule')
  const navigation = page.locator('.fc-prev-button, .fc-next-button')
  await expect(navigation).toHaveCount(2)
  const verify = async () => {
    for (const button of await navigation.all()) {
      await expect(button).toHaveAttribute('title', /.+/)
      await expect(button.locator('.fc-icon')).toHaveAttribute('aria-hidden', 'true')
    }
  }
  await verify()
  await page.locator('.fc-next-button').click()
  await verify()
  await page.locator('.fc-dayGridMonth-button').click()
  await expect(page.locator('.fc-daygrid')).toBeVisible()
  await verify()
})
