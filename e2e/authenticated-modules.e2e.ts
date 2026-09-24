import { expect, test } from '@playwright/test'

test.use({ trace: 'off' })

const modules = [
  { path: 'orders', endpoint: '/pedidos', table: true },
  { path: 'kitchen', endpoint: '/cozinha/pedidos', table: false },
  { path: 'deliveries', endpoint: '/entregas/pedidos', table: false },
  { path: 'sales', endpoint: '/vendas', table: true },
  { path: 'products', endpoint: '/produtos', table: true },
  { path: 'employees', endpoint: '/usuarios', table: true },
  { path: 'schedule', endpoint: '/calendar', table: false },
  { path: 'devices', endpoint: '/dispositivos', table: true },
  { path: 'charts', endpoint: '/graficos/lista', table: true },
  { path: 'settings', endpoint: null, table: false },
] as const

test('login carrega os módulos do painel e suas listagens', async ({ page }) => {
  const email = process.env.E2E_EMAIL
  const password = process.env.E2E_PASSWORD
  test.skip(!email && !password, 'Defina E2E_EMAIL e E2E_PASSWORD para o teste autenticado')
  if (!email || !password) throw new Error('Defina E2E_EMAIL e E2E_PASSWORD juntos')
  test.setTimeout(90_000)

  await page.goto('/login')
  await page.locator('#email').fill(email)
  await page.locator('#password').fill(password)
  await page.locator('form:has(#password) button[type="submit"]').click()
  await expect(page).toHaveURL(/\/dashboard(?:\/orders)?$/)

  const sidebar = page.locator('aside nav')
  await expect(sidebar).toBeVisible()
  const visiblePaths = await sidebar.locator('a[href^="/dashboard/"]').evaluateAll((links) =>
    links.map((link) => new URL((link as HTMLAnchorElement).href).pathname),
  )
  expect(visiblePaths).toEqual(modules.map(({ path }) => `/dashboard/${path}`))

  for (const module of modules) {
    const route = `/dashboard/${module.path}`
    const responsePromise = module.endpoint
      ? page.waitForResponse((response) =>
          new URL(response.url()).pathname === module.endpoint &&
          response.request().method() === 'GET',
        )
      : null

    await sidebar.locator(`a[href="${route}"]`).click()
    await expect(page).toHaveURL(new RegExp(`${route}$`))
    const main = page.locator('main')
    await expect(main.getByRole('heading', { level: 1 })).toBeVisible()

    const response = await responsePromise
    if (response?.status() === 402 && module.path === 'charts') {
      await expect(main.getByRole('alert')).toBeVisible()
      continue
    }
    if (response) expect(response.status(), `${route}: ${response.url()}`).toBe(200)

    if (module.path === 'schedule') {
      await expect(main.locator('.fc-timegrid')).toBeVisible()
      await main.getByRole('button', { name: /Edit opening hours|Editar funcionamento/i }).click()
      await expect(page.getByRole('dialog').getByLabel(/Default opening|Abertura padrão/i)).toBeVisible()
      await page.getByRole('dialog').getByRole('button', { name: /Cancel|Cancelar/i }).click()
      const filterButton = main.getByRole('button', { name: /Filter by Employee|Filtrar por Funcionário/i })
      await expect(filterButton).toBeVisible()
      await filterButton.click()
      await expect(page.getByRole('dialog').getByPlaceholder(/Search employee|Buscar funcionário/i)).toBeVisible()
      await page.getByRole('dialog').getByRole('button', { name: /Cancel|Cancelar/i }).click()
      const calendar = main.locator('.schedule-calendar')
      const themeButton = page.getByRole('button', { name: /Alternar tema|Toggle theme/i })
      for (const theme of ['light', 'dark'] as const) {
        const isDark = await page.locator('html').evaluate((element) => element.classList.contains('dark'))
        if ((theme === 'dark') !== isDark) await themeButton.click()
        const headerColor = await calendar.locator('.fc-col-header-cell').first().evaluate((element) => getComputedStyle(element).backgroundColor)
        expect(headerColor).toBe(theme === 'dark' ? 'rgb(22, 22, 22)' : 'rgb(255, 255, 255)')
        const inactiveButtonColor = await calendar.locator('.fc-dayGridMonth-button').evaluate((element) => getComputedStyle(element).backgroundColor)
        expect(inactiveButtonColor).toBe(theme === 'dark' ? 'rgb(45, 45, 45)' : 'rgb(245, 245, 245)')
      }
      await main.locator('.fc-dayGridMonth-button').click()
      await expect(main.locator('.fc-daygrid')).toBeVisible()
      await main.locator('.fc-listWeek-button').click()
      await expect(main.locator('.fc-list')).toBeVisible()
      await main.locator('.fc-timeGridDay-button').click()
      await expect(main.locator('.fc-timegrid')).toBeVisible()
    }

    if (module.table) {
      const table = main.getByRole('table').first()
      await expect(table).toBeVisible()
      expect(await table.getByRole('columnheader').count()).toBeGreaterThan(0)
      await expect(table.locator('tbody .animate-pulse')).toHaveCount(0)
      await expect(table.locator('tbody tr').first()).toBeVisible()
    }
  }
})
