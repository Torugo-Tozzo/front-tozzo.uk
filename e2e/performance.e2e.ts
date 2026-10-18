import { expect, test } from '@playwright/test'
import { mockV1Api } from './visual/support/mock-v1'

test('landing keeps query infrastructure out until a data route is visited', async ({ page }) => {
  await mockV1Api(page, { role: null })
  const requested: string[] = []
  page.on('request', request => requested.push(request.url()))
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Gestão inteligente para')
  expect(requested.filter(url => /QueryLayout|@tanstack_solid-query/.test(url))).toEqual([])
  await page.getByRole('link', { name: 'Comece a usar' }).click()
  await expect(page.getByLabel('Email')).toBeVisible()
})

test('orders load their editor on demand while keeping the list visible', async ({ page }) => {
  await mockV1Api(page)
  const requested: string[] = []
  page.on('request', request => requested.push(request.url()))
  await page.goto('/dashboard/orders')
  await expect(page.locator('main tbody tr').first()).toBeVisible()
  expect(requested.filter(url => url.includes('ProductSelectionModal'))).toEqual([])
  await page.getByRole('button', { name: 'Novo pedido', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  expect(requested.some(url => url.includes('ProductSelectionModal'))).toBe(true)
  await expect(page.locator('main tbody tr').first()).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar', exact: true }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await page.getByRole('button', { name: 'Novo pedido', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
})

test('orders defer the page-size select and preserve keyboard selection and focus', async ({ page }) => {
  await mockV1Api(page)
  await page.setViewportSize({ width: 1440, height: 1400 })
  const requested: string[] = []
  page.on('request', request => requested.push(request.url()))
  await page.goto('/dashboard/orders')
  await expect(page.locator('main tbody tr').first()).toBeVisible()
  expect(requested.filter(url => /\/ui\/select\.tsx|\/PageSizeSelect\.tsx|@kobalte_core_select/.test(url))).toEqual([])
  const trigger = page.getByRole('button', { name: /^Linhas por página/ })
  await expect(trigger).toHaveAccessibleName('Linhas por página 10')
  await trigger.focus()
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('listbox')).toBeVisible()
  await expect.poll(async () => {
    const menu = await page.getByRole('listbox').boundingBox()
    const button = await trigger.boundingBox()
    return !!menu && !!button && menu.y + menu.height <= button.y + 1
  }).toBe(true)
  const reloaded = page.waitForRequest(request => {
    const url = new URL(request.url())
    return url.pathname === '/v1/orders' && url.searchParams.get('limit') === '35'
  })
  await page.getByRole('option', { name: '35', exact: true }).click()
  await reloaded
  await expect(trigger).toHaveText('35')
  await expect(trigger).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('listbox')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('listbox')).not.toBeVisible()
  await expect(trigger).toBeFocused()
})

test('Escape cancels a page-size menu while its chunk is still loading', async ({ page }) => {
  await mockV1Api(page)
  let release!: () => void
  let requested!: () => void
  const blocked = new Promise<void>(resolve => { release = resolve })
  const started = new Promise<void>(resolve => { requested = resolve })
  await page.route('**/src/components/PageSizeSelect.tsx*', async route => { requested(); await blocked; await route.continue() })
  await page.goto('/dashboard/orders')
  await expect(page.locator('main tbody tr').first()).toBeVisible()
  const trigger = page.getByRole('button', { name: /^Linhas por página/ })
  await trigger.focus()
  await page.keyboard.press('Space')
  await started
  try {
    await expect(trigger).toHaveAttribute('aria-busy', 'true')
    await page.keyboard.press('Escape')
    await expect(trigger).toBeFocused()
  } finally { release() }
  await expect(page.locator('main').getByRole('group')).toBeAttached()
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByRole('listbox')).not.toBeVisible()
  await expect(trigger).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('listbox')).toBeVisible()
})

for (const action of ['tab', 'click', 'escape-tab'] as const) {
  test(`pending page-size menu respects focus moved by ${action}`, async ({ page }) => {
    await mockV1Api(page)
    let release!: () => void
    let requested!: () => void
    const blocked = new Promise<void>(resolve => { release = resolve })
    const started = new Promise<void>(resolve => { requested = resolve })
    await page.route('**/src/components/PageSizeSelect.tsx*', async route => { requested(); await blocked; await route.continue() })
    await page.goto('/dashboard/orders')
    await expect(page.locator('main tbody tr').first()).toBeVisible()
    const trigger = page.getByRole('button', { name: /^Linhas por página/ })
    await trigger.focus()
    await page.keyboard.press('ArrowDown')
    await started
    if (action === 'escape-tab') await page.keyboard.press('Escape')
    if (action === 'click') await page.locator('#filter-customerName').click()
    else await page.keyboard.press('Tab')
    const destination = await page.evaluateHandle(() => document.activeElement)
    release()
    await expect(page.locator('main').getByRole('group')).toBeAttached()
    await expect(page.getByRole('listbox')).not.toBeVisible()
    await expect.poll(() => destination.evaluate(element => element === document.activeElement)).toBe(true)
  })
}

test('landing starts only the visible hero photo before scrolling', async ({ page }) => {
  await mockV1Api(page, { role: null })
  await page.setViewportSize({ width: 390, height: 844 })
  const requested = new Set<string>()
  page.on('request', request => { if (request.url().includes('/images/landing/')) requested.add(new URL(request.url()).pathname) })
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Gestão inteligente para')
  await expect.poll(() => page.locator('img[src="/images/landing/01.jpg"]').evaluate(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0)).toBe(true)
  expect([...requested]).toEqual(['/images/landing/01-960.webp'])
  await page.getByRole('img', { name: 'Gestão de cozinha', exact: true }).scrollIntoViewIfNeeded()
  await expect.poll(() => requested.has('/images/landing/02.jpg')).toBe(true)
})

test('landing serves a responsive WebP hero with the original JPEG fallback', async ({ page }) => {
  await mockV1Api(page, { role: null })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  const hero = page.locator('img[src="/images/landing/01.jpg"]')
  await expect(hero).toBeVisible()
  await hero.evaluate(image => (image as HTMLImageElement).decode())
  await expect.poll(() => hero.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
  await expect.poll(() => hero.evaluate(image => (image as HTMLImageElement).currentSrc)).toMatch(/\/01-(960|1440)\.webp$/)
})

test('dashboard does not paint the footer before its lazy page is ready', async ({ page }) => {
  await mockV1Api(page)
  let release!: () => void
  let requested!: () => void
  const blocked = new Promise<void>(resolve => { release = resolve })
  const started = new Promise<void>(resolve => { requested = resolve })
  await page.route('**/src/pages/dashboard/OrdersPage.tsx*', async route => { requested(); await blocked; await route.continue() })
  await page.goto('/dashboard/orders')
  await started
  try { await expect(page.getByRole('contentinfo')).toHaveCount(0) }
  finally { release() }
  await expect(page.locator('main tbody tr').first()).toBeVisible()
  await expect(page.getByRole('contentinfo')).toBeAttached()
})

test('public layout does not paint the footer before its lazy page is ready', async ({ page }) => {
  await mockV1Api(page, { role: null })
  let release!: () => void
  let requested!: () => void
  const blocked = new Promise<void>(resolve => { release = resolve })
  const started = new Promise<void>(resolve => { requested = resolve })
  await page.route('**/src/pages/LandingPage.tsx*', async route => { requested(); await blocked; await route.continue() })
  await page.goto('/')
  await started
  try { await expect(page.getByRole('contentinfo')).toHaveCount(0) }
  finally { release() }
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Gestão inteligente para')
  await expect(page.getByRole('contentinfo')).toBeAttached()
})
