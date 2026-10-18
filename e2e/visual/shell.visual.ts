import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { scenarios, type Size } from './scenarios'
import { prepare, settle, themeOf } from './support/stabilize'
import { compareRegions, type Region, type RegionPair } from './support/compare-regions'
import { mockV1Api } from './support/mock-v1'
import { SOLID_SCENARIOS } from './ported'

// The dashboard shell (navbar, sidebar, mobile drawer, footer) against the
// React baseline while the pages are not ported (plan S1): everything outside
// <main> is compared; <main> itself is still empty in the Solid app.
// A scenario leaves this list when its page joins SOLID_SCENARIOS.
const SHELL_SCENARIOS: Record<string, { act?: (page: Page) => Promise<void> }> = {
  orders: {},
  'cook-shell': {},
  'driver-shell': {},
  'employee-shell': {},
  'mobile-menu': {
    act: async (page) => {
      await page.getByRole('button', { name: 'Abrir menu', exact: true }).click()
      await expect(page.getByRole('button', { name: 'Fechar menu', exact: true })).toBeVisible()
    },
  },
}

const MAX_DIFF_RATIO = 0.002

const rectOf = async (page: Page, selector: string): Promise<Region | null> => {
  const box = await page.locator(selector).first().boundingBox()
  return box && box.width > 0 && box.height > 0
    ? { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height: Math.round(box.height) }
    : null
}

test.use({ trace: 'off' })

for (const [name, shell] of Object.entries(SHELL_SCENARIOS)) {
  const scenario = scenarios.find((item) => item.name === name)
  if (!scenario || SOLID_SCENARIOS.includes(name)) continue

  test(`shell: ${name}`, async ({ page }, testInfo) => {
    const size = testInfo.project.name.split('-')[0] as Size
    test.skip(!!scenario.sizes && !scenario.sizes.includes(size), `only on ${scenario.sizes?.join(', ')}`)

    await prepare(page, themeOf(testInfo), { pauseTimers: scenario.pauseTimers })
    const mock = await mockV1Api(page, { role: scenario.role, dataset: scenario.mock?.dataset })
    await page.goto(scenario.path)
    await expect(page.locator('header')).toBeVisible()
    await settle(page)
    await shell.act?.(page)
    await settle(page)
    expect(mock.unknown, 'API calls the mock does not answer').toEqual([])

    const viewport = page.viewportSize()!
    const actual = await page.screenshot({ animations: 'disabled', caret: 'hide', scale: 'css' })
    const expectedFile = path.join(testInfo.config.rootDir, '__screenshots__/react', process.platform, `${name}--${testInfo.project.name}.png`)
    const header = (await rectOf(page, 'header'))!
    const aside = await rectOf(page, 'aside')
    const footer = (await rectOf(page, 'footer'))!
    const drawer = name === 'mobile-menu' ? await rectOf(page, '.fixed.inset-y-0') : null
    const expectedHeight = (await import('node:fs/promises')).readFile(expectedFile).then((png) => png.readUInt32BE(20))

    const same = (region: Region): RegionPair['actual'] => region
    const pairs: RegionPair[] = drawer
      // The drawer covers the page; the blurred backdrop shows <main> through it.
      ? [{ name: 'drawer', actual: same(drawer), expected: same(drawer) }]
      : [
          { name: 'header', actual: same(header), expected: same(header) },
          ...(aside ? [{ name: 'sidebar', actual: same({ ...aside, height: viewport.height - aside.y }), expected: same({ ...aside, height: viewport.height - aside.y }) }] : []),
          // The footer closes the page: in the baseline it sits at the bottom of the full-page capture.
          { name: 'footer', actual: same(footer), expected: { ...footer, y: (await expectedHeight) - footer.height } },
        ]

    const results = await compareRegions(page, actual, expectedFile, pairs, testInfo)
    for (const result of results) {
      expect.soft(result.ratio, `${result.name}: ${result.different} of ${result.pixels} pixels differ`).toBeLessThanOrEqual(MAX_DIFF_RATIO)
    }
  })
}
