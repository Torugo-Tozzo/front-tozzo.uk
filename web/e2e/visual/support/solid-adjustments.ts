import { expect, type Page } from '@playwright/test'
import { canonical } from '../../../../e2e/visual/data/canonical'
import type { Size } from '../../../../e2e/visual/scenarios'
import type { V1MockOptions } from './mock-v1'

// Where a React scenario cannot drive the Solid screen as written, for a
// reason that is not a visual difference. Each entry says why.
export interface SolidAdjustment {
  /** Replaces the scenario's act. */
  act?: (page: Page, size: Size) => Promise<void>
  /** More /v1 answers on top of the scenario's. */
  overrides?: V1MockOptions['overrides']
}

// Same steps as openSelect() in ../../../../e2e/visual/scenarios.ts.
const openSelect = async (page: Page, name: RegExp) => {
  const trigger = page.locator('main').getByRole('button', { name })
  await trigger.evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await trigger.click()
  await expect(page.getByRole('listbox')).toBeVisible()
}

// The React act waits for any .animate-pulse, which the route's loading
// overlay also has ("Carregando..."): wait for the page's own skeleton, with
// the overlay gone, which is the state the React screenshot shows.
const pageSkeleton = async (page: Page) => {
  await expect(page.locator('main .animate-pulse').first()).toBeVisible()
  await expect(page.locator('.fixed.inset-0.backdrop-blur-sm')).toHaveCount(0)
  await page.evaluate(() => document.fonts.ready)
}

export const SOLID_ADJUSTMENTS: Record<string, SolidAdjustment> = {
  // The /v1 client retries 5xx. Wait for the final error rather than taking
  // the screenshot during the quiet interval between attempts.
  ...Object.fromEntries(['services-error', 'estimates-error', 'service-orders-error'].map((name) => [name, {
    act: async (page: Page) => { await expect(page.locator('main').getByRole('alert')).toBeVisible() },
  }])),
  // S5 lists use their inline loading text; the React scenario's generic
  // pulse could catch the route overlay before the list itself was mounted.
  ...Object.fromEntries(['services-loading', 'estimates-loading', 'service-orders-loading'].map((name) => [name, {
    act: async (page: Page) => {
      await expect(page.locator('main').getByRole('status')).toBeVisible()
      await expect(page.locator('.fixed.inset-0.backdrop-blur-sm')).toHaveCount(0)
    },
  }])),
  'products-loading': { act: pageSkeleton },
  'employees-loading': { act: pageSkeleton },
  'devices-loading': { act: pageSkeleton },
  'orders-loading': { act: pageSkeleton },
  'sales-loading': { act: pageSkeleton },
  // The Kobalte Select trigger has the role `button` (Radix: `combobox`), plan S1.
  'settings-language-menu': { act: async (page) => openSelect(page, /^Idioma atual/) },
  'orders-page-size-menu': {
    act: async (page) => {
      await expect(page.locator('main tbody tr').first()).toBeVisible()
      await expect(page.locator('.animate-pulse')).toHaveCount(0)
      await openSelect(page, /^Linhas por página/)
    },
  },
  // Same list, in the order the Bun sent it (by id). The /v1 sorts types by
  // description; the plan allows ordering differences in tables, and the app
  // shows the order the API sends.
  'products-types': {
    overrides: {
      '/v1/product-types': {
        status: 200,
        body: [...canonical.productTypes]
          .sort((left, right) => left.id.localeCompare(right.id))
          .map((type) => ({ ...type, updatedAt: canonical.establishment.createdAt })),
      },
    },
  },
}
