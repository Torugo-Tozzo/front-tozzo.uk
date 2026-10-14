import { expect, test, type Page } from '@playwright/test'
import { prepare, settle, themeOf } from '../../../e2e/visual/support/stabilize'
import { problem } from '../../../e2e/visual/data/v1'
import type { Role } from '../../../e2e/visual/data/canonical'
import { mockV1Api, type V1MockOptions } from './support/mock-v1'

// Screens that exist only in the Solid app, so the React baseline has nothing
// to compare them with. Their reference was recorded from the Solid app with
// the user's "ok" (plan S2, 2026-10-14) in ../e2e/visual/__screenshots__/solid/
// <platform>/; only the `solid-*` projects of playwright.visual.config.ts run
// this file and read that folder.

interface SolidScenario {
  name: string
  path: string
  /** Signed-in role (default: signed out). */
  role?: Role
  overrides?: V1MockOptions['overrides']
  /** What must be on screen before the screenshot. */
  ready: (page: Page) => Promise<void>
  /** A request that never answers keeps the page from reaching network idle. */
  pending?: boolean
}

const text = (value: string | RegExp) => async (page: Page) => {
  await expect(page.getByText(value)).toBeVisible()
}

export const solidScenarios: SolidScenario[] = [
  // Sign-up confirmation link (S2).
  { name: 'verify-email-checking', path: '/verify-email?token=visual-token', overrides: { '/v1/auth/verify-email': 'loading' }, pending: true, ready: text('Confirmando seu email...') },
  { name: 'verify-email-invalid', path: '/verify-email', ready: text(/^O link de confirmação expirou/) },
  // Email change confirmation link (S2).
  { name: 'confirm-email', path: '/confirm-email?token=visual-token', ready: text(/^Seu email foi alterado/) },
  { name: 'confirm-email-invalid', path: '/confirm-email', ready: text(/^Este link de confirmação expirou/) },
  // PaywallBanner (S3): a manager on the FREE plan opens Employees and the /v1
  // answers 403 PLAN_UPGRADE_REQUIRED. The React app never showed the banner
  // (plan S0); reference recorded with the user's "ok" (2026-10-14).
  {
    name: 'employees-paywall',
    path: '/dashboard/employees',
    role: 'MANAGER',
    overrides: { '/v1/users': problem(403, 'PLAN_UPGRADE_REQUIRED') },
    ready: text('Peça pro dono fazer upgrade do plano pra liberar isso.'),
  },
]

test.use({ trace: 'off' })

for (const scenario of solidScenarios) {
  test(scenario.name, async ({ page }, testInfo) => {
    await prepare(page, themeOf(testInfo))
    const mock = await mockV1Api(page, { role: scenario.role ?? null, overrides: scenario.overrides })
    await page.goto(scenario.path)
    await scenario.ready(page)
    if (!scenario.pending) await settle(page)
    else await page.evaluate(() => document.fonts.ready)

    expect(mock.unknown, 'API calls the mock does not answer').toEqual([])
    await expect(page).toHaveScreenshot(`${scenario.name}.png`, { fullPage: true })
  })
}
