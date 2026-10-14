import { expect, test } from '@playwright/test'
import { scenarios, type Size } from '../../../e2e/visual/scenarios'
import { prepare, settle, themeOf } from '../../../e2e/visual/support/stabilize'
import { mockV1Api } from './support/mock-v1'
import { SOLID_SCENARIOS } from './ported'

// The React scenarios (plan S0) that the Solid app already renders, compared
// with the React baseline under the plan's tolerance.
const ported = scenarios.filter((scenario) => SOLID_SCENARIOS.includes(scenario.name))

test.use({ trace: 'off' })

for (const scenario of ported) {
  test(scenario.name, async ({ page }, testInfo) => {
    const size = testInfo.project.name.split('-')[0] as Size
    test.skip(!!scenario.sizes && !scenario.sizes.includes(size), `only on ${scenario.sizes?.join(', ')}`)

    if (process.env.VISUAL_DEBUG) {
      page.on('console', (message) => console.log(`[${scenario.name}] ${message.type()}: ${message.text()}`))
      page.on('request', (request) => console.log(`[${scenario.name}] -> ${request.method()} ${request.url()}`))
    }
    await prepare(page, themeOf(testInfo), { pauseTimers: scenario.pauseTimers })
    const mock = await mockV1Api(page, { role: scenario.role, dataset: scenario.mock?.dataset })
    await page.goto(scenario.path)
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
