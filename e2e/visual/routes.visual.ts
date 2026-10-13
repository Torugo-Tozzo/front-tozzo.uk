import { expect, test } from '@playwright/test'
import { scenarios, type Size } from './scenarios'
import { mockLegacyApi } from './support/mock-api'
import { prepare, settle, themeOf } from './support/stabilize'

test.use({ trace: 'off' })

for (const scenario of scenarios) {
  test(scenario.name, async ({ page }, testInfo) => {
    const size = testInfo.project.name.split('-')[0] as Size
    test.skip(!!scenario.sizes && !scenario.sizes.includes(size), `only on ${scenario.sizes?.join(', ')}`)

    if (process.env.VISUAL_DEBUG) {
      page.on('console', (message) => console.log(`[${scenario.name}] ${message.type()}: ${message.text()}`))
      page.on('request', (request) => console.log(`[${scenario.name}] -> ${request.method()} ${request.url()}`))
    }
    await prepare(page, themeOf(testInfo), { pauseTimers: scenario.pauseTimers })
    const mock = await mockLegacyApi(page, { role: scenario.role, ...scenario.mock })
    await page.goto(scenario.path)
    // Paused timers: run the boot timers (auth, lazy routes) but not a redirect a few seconds later.
    if (scenario.pauseTimers) await page.clock.runFor(1_000)
    if (!scenario.pending) await settle(page)
    await scenario.act?.(page, size)
    if (!scenario.pending) await settle(page)

    expect(mock.unknown, 'API calls the mock does not answer').toEqual([])
    await expect(page).toHaveScreenshot(`${scenario.name}.png`, {
      fullPage: !scenario.viewportOnly,
      mask: scenario.mask?.(page),
    })
  })
}
