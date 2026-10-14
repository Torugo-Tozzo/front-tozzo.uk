import path from 'node:path'
import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'
import { scenarios, type Size } from '../../../e2e/visual/scenarios'
import { prepare, settle, themeOf } from '../../../e2e/visual/support/stabilize'
import { compareRegions, type Region, type RegionPair } from './support/compare-regions'
import { mockV1Api, v1Overrides } from './support/mock-v1'
import { SOLID_SCENARIOS } from './ported'

// React scenarios whose Solid screen differs from the baseline on purpose, in
// one known part. Everything else is compared region by region with the React
// PNG, by the same pixelmatch distance and the 0.002 limit (as shell.visual.ts).
// Each entry says what is left out and why.

const MAX_DIFF_RATIO = 0.002

interface Adjusted {
  /** Waits for the screen (instead of the scenario's act). */
  ready?: (page: Page, size: Size) => Promise<void>
  /** The pairs of regions to compare, from the Solid page and the React PNG height. */
  regions: (page: Page, actualHeight: number, expectedHeight: number) => Promise<RegionPair[]>
  /** A viewport capture instead of the full page. */
  viewportOnly?: boolean
}

const box = async (page: Page, selector: string): Promise<Region> => {
  const rect = (await page.locator(selector).first().boundingBox())!
  return { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) }
}
const same = (region: Region): RegionPair['actual'] => region

/**
 * Settings without the Security (2FA) card, which the new app does not have
 * (user's decision, 2026-10-14). Above the data/privacy section the page is
 * the same; from there on it is the React page moved up by the card's height.
 */
const withoutSecurityCard = async (page: Page, actualHeight: number, expectedHeight: number): Promise<RegionPair[]> => {
  const width = page.viewportSize()!.width
  const privacy = await box(page, 'main div.border-t.pt-4')
  // The card took its height plus the 24 px gap (space-y-6) above the section.
  const cut = privacy.y - 24
  const removed = expectedHeight - actualHeight
  expect(removed, 'the React page is taller by the Security card').toBeGreaterThan(100)
  return [
    { name: 'above-security', actual: same({ x: 0, y: 0, width, height: cut }), expected: same({ x: 0, y: 0, width, height: cut }) },
    { name: 'below-security', actual: { x: 0, y: cut, width, height: actualHeight - cut }, expected: { x: 0, y: cut + removed, width, height: actualHeight - cut } },
  ]
}

const ADJUSTED: Record<string, Adjusted> = {
  settings: { regions: withoutSecurityCard },
  'settings-free-plan': { regions: withoutSecurityCard },
  'settings-delete-account': { regions: withoutSecurityCard },
  // Only the dialog: the orders page behind it is ported in S4.
  onboarding: {
    viewportOnly: true,
    regions: async (page) => {
      const dialog = await box(page, '[role="dialog"]')
      return [{ name: 'dialog', actual: same(dialog), expected: same(dialog) }]
    },
  },
  // The React baseline was recorded on the dev server, where StrictMode runs
  // the devices effect twice: two identical error toasts, stacked. The Solid
  // page shows one. The rest of the screen is compared; the toast area is not.
  'devices-error': {
    ready: async (page) => {
      await expect(page.locator('main').getByText('Nenhum dispositivo registrado ainda.')).toBeVisible({ timeout: 20_000 })
      await expect(page.locator('[data-sonner-toast]')).toHaveCount(1)
    },
    regions: async (page, actualHeight) => {
      const width = page.viewportSize()!.width
      const toast = await box(page, '[data-sonner-toast]')
      // The second React toast peeks out under the first one.
      const bottom = toast.y + toast.height + 24
      // On a phone the toast spans the width: only what is below it counts.
      return [
        { name: 'left-of-toast', actual: same({ x: 0, y: 0, width: toast.x - 16, height: actualHeight }), expected: same({ x: 0, y: 0, width: toast.x - 16, height: actualHeight }) },
        { name: 'below-toast', actual: same({ x: 0, y: bottom, width, height: actualHeight - bottom }), expected: same({ x: 0, y: bottom, width, height: actualHeight - bottom }) },
      ].filter((pair) => pair.actual.width > 0)
    },
  },
}

test.use({ trace: 'off' })

for (const [name, adjusted] of Object.entries(ADJUSTED)) {
  const scenario = scenarios.find((item) => item.name === name)
  if (!scenario || SOLID_SCENARIOS.includes(name)) throw new Error(`${name}: not a React scenario, or compared whole in routes.visual.ts`)

  test(`adjusted: ${name}`, async ({ page }, testInfo) => {
    test.setTimeout(60_000)
    const size = testInfo.project.name.split('-')[0] as Size
    await prepare(page, themeOf(testInfo), { pauseTimers: scenario.pauseTimers })
    const mock = await mockV1Api(page, { role: scenario.role, dataset: scenario.mock?.dataset, overrides: v1Overrides(scenario.mock?.overrides) })
    await page.goto(scenario.path)
    await settle(page)
    await (adjusted.ready ?? scenario.act)?.(page, size)
    await settle(page)
    expect(mock.unknown, 'API calls the mock does not answer').toEqual([])

    const actual = await page.screenshot({ fullPage: !adjusted.viewportOnly, animations: 'disabled', caret: 'hide', scale: 'css' })
    const expectedFile = path.join(testInfo.config.rootDir, '../../../e2e/visual/__screenshots__/react', process.platform, `${name}--${testInfo.project.name}.png`)
    const expectedHeight = (await readFile(expectedFile)).readUInt32BE(20)
    const actualHeight = actual.readUInt32BE(20)
    const pairs = await adjusted.regions(page, actualHeight, expectedHeight)
    const results = await compareRegions(page, actual, expectedFile, pairs, testInfo)
    for (const result of results) {
      expect.soft(result.pixels, `${result.name}: compared nothing`).toBeGreaterThan(0)
      expect.soft(result.ratio, `${result.name}: ${result.different} of ${result.pixels} pixels differ`).toBeLessThanOrEqual(MAX_DIFF_RATIO)
    }
  })
}
