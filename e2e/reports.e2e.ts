import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { mockV1Api } from './visual/support/mock-v1'
import { prepare } from './visual/support/stabilize'

test.beforeEach(async ({ page }) => { await prepare(page, 'light', { locale: 'en' }) })
async function open(page: Page) {
  const mock = await mockV1Api(page)
  await page.goto('/dashboard/charts')
  await expect(page.getByRole('table').getByRole('cell', { name: 'Batata com Cheddar e Bacon', exact: true })).toBeVisible({ timeout: 20_000 })
  await expect(page.locator('[data-report-chart] svg').first()).toBeVisible()
  return mock
}
async function exports(page: Page, state: 'done' | 'failed' | 'pending' | 'NOT_READY' | 'REPORT_QUOTA_EXCEEDED' = 'done') {
  const calls: { method: string; body: unknown }[] = []
  await page.route(url => url.hostname === 'api.visual.test' && url.pathname.startsWith('/v1/reports/exports'), async route => {
    const request = route.request()
    if (request.method() === 'OPTIONS') return route.fallback()
    calls.push({ method: request.method(), body: request.postDataJSON() })
    const status = state === 'NOT_READY' ? 503 : state === 'REPORT_QUOTA_EXCEEDED' ? 403 : request.method() === 'POST' ? 202 : 200
    const body = status >= 400 ? { status, title: state, code: state } : request.method() === 'POST' ? { id: 'job', status: 'pending' } : { id: 'job', status: state, ...(state === 'done' ? { downloadUrl: 'http://files.visual.test/report.xlsx' } : {}) }
    await route.fulfill({ status, contentType: status >= 400 ? 'application/problem+json' : 'application/json', headers: { 'Access-Control-Allow-Origin': request.headers().origin ?? '*', 'Access-Control-Allow-Credentials': 'true' }, body: JSON.stringify(body) })
  })
  await page.route('http://files.visual.test/report.xlsx', route => {
    const headers = route.request().headers()
    calls.push({ method: 'DOWNLOAD', body: { authorization: headers.authorization, cookie: headers.cookie } })
    return route.fulfill({ status: 200, contentType: 'application/octet-stream', headers: { 'Content-Disposition': 'attachment; filename="report.xlsx"' }, body: 'fake report' }) })
  return calls
}
test('reports: filters, all chart types, tooltip, theme and hourly navigation', async ({ page }) => {
  const mock = await open(page)
  const chart = page.locator('[data-report-chart]')
  await expect(chart).toContainText('Revenue')
  const textColor = () => chart.locator('svg text').first().getAttribute('fill')
  const lightColor = await textColor()
  await page.getByRole('button', { name: 'Toggle theme' }).click()
  await expect.poll(textColor).not.toBe(lightColor)
  await chart.locator('path[fill="#8884d8"]').first().hover()
  await expect(chart).toContainText('R$398.40')
  for (const name of ['Number of sales', 'Revenue and sales', 'Number of sales (pie)', 'Revenue']) {
    await page.getByRole('button', { name: 'Sales visualization' }).click()
    await page.getByRole('option', { name, exact: true }).click()
    await expect(chart.locator('svg')).toBeVisible()
    if (name === 'Number of sales (pie)') {
      const label = chart.locator('svg text').filter({ hasText: /^X-Egg \d+%$/ })
      await expect(label).toBeVisible()
      const labelBox = (await label.boundingBox())!
      const legendBox = (await chart.locator('svg text').filter({ hasText: /^Batata com Cheddar e Bacon$/ }).boundingBox())!
      expect(labelBox.y + labelBox.height).toBeLessThan(legendBox.y)
    }
  }
  await page.getByLabel('Start date', { exact: true }).fill('2026-09-01')
  const result = page.waitForResponse(response => response.url().includes('/v1/reports/top-products') && new URL(response.url()).searchParams.get('from') === '2026-09-01T03:00:00.000Z')
  await page.getByRole('button', { name: 'Search', exact: true }).click(); await result
  await page.getByRole('tab', { name: 'Sales by hour' }).click()
  await expect(page.locator('[data-report-chart] svg')).toBeVisible()
  await page.getByLabel('End date', { exact: true }).fill('2026-10-02')
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByText('Day 2 of 2')).toBeVisible()
  expect(mock.unknown).toEqual([])
})
for (const format of ['Excel', 'PDF']) test(`reports: export ${format} polls then downloads without API credentials`, async ({ page }) => {
  await open(page)
  const calls = await exports(page)
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: `Generate ${format}` }).dblclick()
  await expect(page.getByRole('button', { name: 'Generate Excel' })).toBeDisabled()
  const file = await download
  expect(file.suggestedFilename()).toBe('report.xlsx')
  expect(calls.find(call => call.method === 'DOWNLOAD')?.body).toEqual({ authorization: undefined, cookie: undefined })
  expect(calls.filter(call => call.method === 'POST')).toHaveLength(1)
  expect(calls[0].body).toMatchObject({ format: format === 'Excel' ? 'xlsx' : 'pdf', locale: 'en', tzOffsetMinutes: -180 })
  await expect(page.getByRole('button', { name: 'Generate PDF' })).toBeEnabled()
})
for (const [state, message] of [['failed', 'Error generating the report'], ['NOT_READY', 'Report exports are not available yet.'], ['REPORT_QUOTA_EXCEEDED', 'You have reached your monthly report limit.']] as const) test(`reports: export ${state} releases the controls and shows a translated error`, async ({ page }) => {
  await open(page); await exports(page, state)
  await page.getByRole('button', { name: 'Generate PDF' }).click()
  await expect(page.locator('main').getByText(message, { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Generate PDF' })).toBeEnabled()
})
test('reports: pending export expires at two minutes and navigation cancels polling', async ({ page }) => {
  await open(page); const calls = await exports(page, 'pending')
  await page.clock.install()
  await page.getByRole('button', { name: 'Generate PDF' }).click()
  await expect.poll(() => calls.length).toBe(1)
  await page.clock.runFor(120_000)
  await expect(page.getByText('Timed out while checking report status')).toBeVisible()
  await page.getByRole('button', { name: 'Generate PDF' }).click()
  await expect.poll(() => calls.filter(c => c.method === 'POST').length).toBe(2)
  await page.getByRole('link', { name: 'Products', exact: true }).click()
  await expect(page).toHaveURL(/dashboard\/products/)
  const before = calls.length
  await page.clock.runFor(10_000)
  expect(calls).toHaveLength(before)
})
test('reports: both tabs have no serious or critical accessibility violations', async ({ page }) => {
  await open(page)
  for (const tab of ['Products sold', 'Sales by hour']) {
    await page.getByRole('tab', { name: tab }).click()
    await expect(page.locator('[data-report-chart] svg')).toBeVisible()
    const results = await new AxeBuilder({ page }).include('main').analyze()
    expect(results.violations.filter(v => ['serious', 'critical'].includes(v.impact ?? ''))).toEqual([])
  }
})

test('reports: employee guard redirects without loading reports; manager sees the plan banner', async ({ page }) => {
  await mockV1Api(page, { role: 'EMPLOYEE' })
  const reports: string[] = []
  page.on('request', request => { if (request.url().includes('/v1/reports/')) reports.push(request.url()) })
  await page.goto('/dashboard/charts')
  await expect(page).toHaveURL(/dashboard\/sales/)
  await expect(page.getByRole('heading', { name: /Sales/ }).first()).toBeVisible()
  expect(reports).toEqual([])
  await page.unrouteAll({ behavior: 'wait' })
  await mockV1Api(page, { role: 'MANAGER', overrides: {
    '/v1/reports/top-products': { status: 403, body: { status: 403, code: 'PLAN_UPGRADE_REQUIRED', title: 'Upgrade' } },
  } })
  await page.goto('/dashboard/charts')
  await expect(page.getByRole('alert')).toContainText('This feature is only available on paid plans.')
})
