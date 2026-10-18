import { expect, type Page } from '@playwright/test'
import { canonical, FIXED_NOW } from '../data/canonical'
import { toV1 } from '../data/v1'
import type { Size } from '../scenarios'
import type { V1MockOptions } from './mock-v1'

// Where a React scenario cannot drive the Solid screen as written, for a
// reason that is not a visual difference. Each entry says why.
export interface SolidAdjustment {
  /** Prepares lazy content before settle() waits for every image. */
  beforeSettle?: (page: Page) => Promise<void>
  /** Replaces the scenario's act. */
  act?: (page: Page, size: Size) => Promise<void>
  /** More /v1 answers on top of the scenario's. */
  overrides?: V1MockOptions['overrides']
}

// Same steps as openSelect() in ../scenarios.ts.
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

// React's pending profile came from a 402 fallback: it had neither tradeName
// nor plan (src/contexts/AuthContext.tsx). Go returns both. Compare the same
// incomplete profile here; functional E2E separately exercises Go's full data.
const pendingFixture = toV1({ ...canonical, establishment: { ...canonical.establishment, status: 'PENDING_PAYMENT', plan: 'FREE' } })
const pendingMe = pendingFixture({ method: 'GET', path: '/v1/me', query: new URLSearchParams() })!.body as { establishment: Record<string, unknown> }
const { plan: _plan, ...pendingEstablishment } = pendingMe.establishment
const legacyPendingMe = { ...pendingMe, establishment: { ...pendingEstablishment, tradeName: '' } }
const pendingProfile: SolidAdjustment = { overrides: {
  '/v1/me': { status: 200, body: legacyPendingMe },
  '/v1/auth/refresh': { status: 200, body: {
    accessToken: 'visual-pending-profile',
    accessTokenExpiresAt: new Date(new Date(FIXED_NOW).getTime() + 15 * 60_000).toISOString(),
    user: legacyPendingMe,
  } },
} }

export const SOLID_ADJUSTMENTS: Record<string, SolidAdjustment> = {
  // S7 keeps the original photos and layout, but loads offscreen images lazily.
  // Visit them before the full-page capture, then restore the initial viewport.
  'landing': { beforeSettle: async (page) => {
    const photos = page.locator('img[src^="/images/landing/"], img[data-landing-src]')
    await expect(photos).toHaveCount(9)
    for (const photo of await photos.all()) {
      await photo.scrollIntoViewIfNeeded()
      await expect.poll(() => photo.evaluate(image => (!image.hasAttribute("data-landing-src") || image.getAttribute("src") === image.getAttribute("data-landing-src")) && (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0)).toBe(true)
    }
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
  } },
  'plan': pendingProfile,
  'plan-annual': pendingProfile,
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
  // The React scenario opens the first combobox (food type); Kobalte exposes a button.
  'charts-type-menu': {
    // As in products-types: API order is alphabetical, legacy was id order.
    overrides: { '/v1/product-types': { status: 200, body: [...canonical.productTypes]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map(type => ({ ...type, updatedAt: canonical.establishment.createdAt })) } },
    act: async (page) => {
    await expect(page.locator('main tbody tr').first()).toBeVisible()
    await expect(page.locator('.animate-pulse')).toHaveCount(0)
    await openSelect(page, /^Tipo de alimento/)
  } },
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
