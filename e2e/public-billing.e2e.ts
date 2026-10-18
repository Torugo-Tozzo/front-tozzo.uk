import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { mockV1Api } from './visual/support/mock-v1'
import { canonical, type Role } from './visual/data/canonical'
import { prepare } from './visual/support/stabilize'
const pending = { ...canonical, establishment: { ...canonical.establishment, status: 'PENDING_PAYMENT' as const, plan: 'FREE' as const } }
test.beforeEach(async ({ page }) => { await prepare(page, 'light', { locale: 'en' }) })
async function checkoutBackend(page: Page, options: { role?: Role; failure?: boolean; url?: string; delayed?: boolean } = {}) {
  const mock = await mockV1Api(page, { role: options.role ?? 'OWNER', dataset: pending })
  const bodies: unknown[] = []
  let answer: () => void = () => {}
  await page.route('http://api.visual.test/v1/billing/checkout', async route => {
    if (route.request().method() === 'OPTIONS') return route.fallback()
    bodies.push(route.request().postDataJSON())
    if (options.delayed) await new Promise<void>(resolve => { answer = resolve })
    await route.fulfill({ status: options.failure ? 502 : 200, contentType: options.failure ? 'application/problem+json' : 'application/json', headers: { 'Access-Control-Allow-Origin': route.request().headers().origin ?? '*', 'Access-Control-Allow-Credentials': 'true' }, body: JSON.stringify(options.failure ? { status: 502, title: 'Internal detail must stay hidden', code: 'BILLING_CHECKOUT_FAILED', detail: 'Internal detail must stay hidden' } : { url: options.url ?? 'https://checkout.stripe.com/c/pay/cs_test_mock' }) })
  })
  return { mock, bodies, release: () => answer() }
}
test('public: landing pricing starts registration', async ({ page }) => {
  await mockV1Api(page, { role: null })
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Smart management for')
  await page.getByRole('button', { name: 'View plans' }).click()
  await expect(page.locator('#pricing')).toBeInViewport()
  await page.getByRole('button', { name: 'Annual', exact: true }).click()
  await page.getByRole('button', { name: 'Subscribe annually' }).click()
  await expect(page).toHaveURL(/login\?tab=register$/)
  await expect(page.getByRole('tab', { name: 'Register' })).toHaveAttribute('aria-selected', 'true')
})
for (const [path, heading] of [['/privacidade', 'Privacy Policy'], ['/termos', 'Terms of Use']]) test(`public: ${path} keeps the legal draft and registration link`, async ({ page }) => {
  await mockV1Api(page, { role: null })
  await page.goto(path)
  await expect(page.getByRole('heading', { name: heading })).toBeVisible()
  await expect(page.getByText(/has not yet been reviewed by a lawyer/)).toBeVisible()
  await expect(page.getByRole('link', { name: 'Back to registration' })).toHaveAttribute('href', '/login')
})
test('public: 404 returns to the landing', async ({ page }) => {
  await mockV1Api(page, { role: null })
  await page.goto('/does-not-exist')
  await expect(page.getByRole('heading', { name: '404' })).toBeVisible()
  await page.getByRole('button', { name: /home/i }).click()
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Smart management for')
})
for (const [plan, interval, label] of [['PAID', 'monthly', 'Subscribe monthly'], ['PAID', 'annual', 'Subscribe annually'], ['ENTERPRISE', 'monthly', 'Subscribe to Enterprise']] as const) test(`billing: ${plan}/${interval} posts once and redirects to a controlled Stripe page`, async ({ page }) => {
  const backend = await checkoutBackend(page, { delayed: true })
  const stripeRequests: { authorization?: string; cookie?: string }[] = []
  await page.route('https://checkout.stripe.com/**', route => { const headers = route.request().headers(); stripeRequests.push({ authorization: headers.authorization, cookie: headers.cookie }); return route.fulfill({ contentType: 'text/html', body: '<h1>Controlled checkout</h1>' }) })
  await page.goto('/plan')
  if (interval === 'annual') await page.getByRole('button', { name: 'Annual', exact: true }).click()
  await page.getByRole('button', { name: label }).dblclick()
  await expect(page.getByRole('button', { name: 'Continue on Free' })).toBeDisabled()
  expect(backend.bodies).toEqual([{ plan, interval }])
  backend.release()
  await expect(page).toHaveURL('https://checkout.stripe.com/c/pay/cs_test_mock')
  await expect(page.getByRole('heading', { name: 'Controlled checkout' })).toBeVisible()
  expect(stripeRequests).toEqual([{ authorization: undefined, cookie: undefined }])
  expect(backend.mock.unknown).toEqual([])
})
test('billing: checkout failure preserves the annual selection and permits retry without showing problem detail', async ({ page }) => {
  const backend = await checkoutBackend(page, { failure: true })
  await page.goto('/plan')
  await page.getByRole('button', { name: 'Annual', exact: true }).click()
  await page.getByRole('button', { name: 'Subscribe annually' }).click()
  await expect(page.getByText('Error processing payment. Check that your session is active.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Subscribe annually' })).toBeEnabled()
  await expect(page.getByText('Internal detail must stay hidden')).toHaveCount(0)
  await page.getByRole('button', { name: 'Subscribe annually' }).click()
  await expect.poll(() => backend.bodies.length).toBe(2)
})
test('billing: unsafe checkout URL stays on the plan page with a translated error', async ({ page }) => {
  await checkoutBackend(page, { url: 'javascript:alert(1)' })
  await page.goto('/plan')
  await page.getByRole('button', { name: 'Subscribe monthly' }).click()
  await expect(page.getByText('Unable to start payment: URL not found.')).toBeVisible()
  await expect(page).toHaveURL(/\/plan$/)
})
test('billing: manager cannot submit checkout; cancellation returns to the same plan page', async ({ page }) => {
  const backend = await checkoutBackend(page, { role: 'MANAGER' })
  await page.goto('/payment/cancel')
  await expect(page).toHaveURL(/\/plan$/)
  await expect(page.getByRole('button', { name: 'Subscribe monthly' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Subscribe to Enterprise' })).toBeDisabled()
  expect(backend.bodies).toEqual([])
})
test('billing: an active Free owner continues to the dashboard and an active paid owner bypasses plans', async ({ page }) => {
  await mockV1Api(page, { role: 'OWNER', dataset: { ...canonical, establishment: { ...canonical.establishment, status: 'ACTIVE', plan: 'FREE' } } })
  await page.goto('/plan')
  await page.getByRole('button', { name: 'Continue on Free' }).click()
  await expect(page).toHaveURL(/dashboard\/orders$/)
  await page.unrouteAll({ behavior: 'wait' })
  await mockV1Api(page, { role: 'OWNER' })
  await page.goto('/plan')
  await expect(page).toHaveURL(/dashboard\/orders$/)
})
test('billing: success signs out after three seconds without trusting session_id as proof', async ({ page }) => {
  const mock = await mockV1Api(page)
  await page.clock.install()
  await page.goto('/payment/success?session_id=untrusted_value')
  await expect(page.getByRole('heading', { name: 'Payment confirmed!' })).toBeVisible()
  const logout = page.waitForRequest(request => request.method() === 'POST' && request.url().includes('/v1/auth/logout'))
  await page.clock.runFor(2999)
  await expect(page).toHaveURL(/payment\/success/)
  await page.clock.runFor(1)
  await logout
  await expect(page).toHaveURL(/\/login$/)
  expect(mock.unknown).toEqual([])
})
for (const path of ['/', '/privacidade', '/termos', '/does-not-exist', '/plan', '/payment/success']) test(`accessibility: ${path} has no serious or critical violations`, async ({ page }) => {
  await mockV1Api(page, { role: path === '/plan' || path === '/payment/success' ? 'OWNER' : null, dataset: pending })
  // Keep the return page mounted while axe runs, even on a loaded CI worker.
  if (path === '/payment/success') await page.route('http://api.visual.test/v1/auth/logout', () => {})
  await page.goto(path)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations.filter(v => ['serious', 'critical'].includes(v.impact ?? ''))).toEqual([])
})

test('billing: a failed logout preserves the session and offers a successful retry', async ({ page }) => {
  await mockV1Api(page)
  let attempts = 0
  await page.route('http://api.visual.test/v1/auth/logout', async route => {
    if (route.request().method() === 'OPTIONS') return route.fallback()
    attempts++
    if (attempts > 1) return route.fallback()
    await route.fulfill({ status: 503, contentType: 'application/problem+json', headers: { 'Access-Control-Allow-Origin': route.request().headers().origin ?? '*', 'Access-Control-Allow-Credentials': 'true' }, body: JSON.stringify({ status: 503, code: 'UNAVAILABLE' }) })
  })
  await page.clock.install()
  await page.goto('/payment/success')
  await expect(page.getByRole('heading', { name: 'Payment confirmed!' })).toBeVisible()
  await page.clock.runFor(3000)
  await expect(page.getByRole('alert')).toContainText('Could not sign out')
  await expect(page).toHaveURL(/payment\/success$/)
  await page.getByRole('button', { name: 'Log out' }).click()
  await expect(page).toHaveURL(/\/login$/)
  expect(attempts).toBe(2)
})

test('public: landing loads its first photo immediately and the remaining photos as they enter view', async ({ page }) => {
  await mockV1Api(page, { role: null })
  await page.setViewportSize({ width: 390, height: 844 })
  const requested = new Set<string>()
  page.on('request', request => { if (request.url().includes('/images/landing/')) requested.add(request.url()) })
  await page.goto('/')
  const photos = page.locator('img[src^="/images/landing/"]')
  await expect(photos).toHaveCount(9)
  await expect.poll(() => photos.first().evaluate(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0)).toBe(true)
  expect(requested.size).toBeLessThan(9)
  for (const photo of await photos.all()) {
    await photo.scrollIntoViewIfNeeded()
    await expect.poll(() => photo.evaluate(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0)).toBe(true)
  }
  expect(requested.size).toBe(9)
})
