import { expect, type Locator, type Page } from '@playwright/test'
import { canonical, type CanonicalDataset, type CanonicalEstablishment, type Role } from './data/canonical'
import { emptyDataset, type MockOptions } from './support/mock-api'

// Every screen and state of the visual baseline (plan S0). The Solid app is
// checked against the same list, so names are stable identifiers: renaming one
// means re-recording its baseline.
export type Size = 'desktop' | 'tablet' | 'mobile'

export interface Scenario {
  name: string
  path: string
  role?: Role | null
  mock?: Omit<MockOptions, 'role'>
  /** Waits for content and opens dialogs/menus/tabs before the screenshot. */
  act?: (page: Page, size: Size) => Promise<void>
  /** Loading states never reach network idle. */
  pending?: boolean
  /** Timers stay paused after boot (pages that redirect on a timeout). */
  pauseTimers?: boolean
  /** Areas drawn by a chart library (allowed to differ slightly, plan S6). */
  mask?: (page: Page) => Locator[]
  /** Screenshot only the viewport: open selects shift by a pixel when a full-page capture resizes the window. */
  viewportOnly?: boolean
  /** Only on these viewport sizes (default: all). */
  sizes?: Size[]
}

const main = (page: Page) => page.locator('main')
const dialog = (page: Page) => page.getByRole('dialog')
const firstRow = (page: Page) => main(page).locator('tbody tr').first()
const visible = async (locator: Locator) => { await expect(locator).toBeVisible() }
const noSkeleton = async (page: Page) => { await expect(page.locator('.animate-pulse')).toHaveCount(0) }
const tableLoaded = async (page: Page) => { await visible(firstRow(page)); await noSkeleton(page) }
const button = (page: Page, name: string | RegExp) => page.getByRole('button', { name, exact: typeof name === 'string' })
const click = async (page: Page, name: string | RegExp) => { await button(page, name).first().click() }
// Dialog triggers react to click; a DOM click also works where the mobile
// layout overlaps the trigger (e.g. the products tabs over "Novo tipo").
const press = async (locator: Locator) => { await visible(locator); await locator.evaluate((element: HTMLElement) => element.click()) }
// Opening a select locks the scroll wherever it is; center the trigger first so
// the sticky header and the popover land on the same pixels every run.
const openSelect = async (trigger: Locator) => {
  await trigger.evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await trigger.click()
  await visible(trigger.page().getByRole('listbox'))
}
const openDialog = async (page: Page, name: string | RegExp, ready: (page: Page) => Promise<void> = tableLoaded) => {
  await ready(page)
  const expand = button(page, 'Expandir filtros')
  if (await expand.isVisible()) await expand.click()
  await press(button(page, name).first())
  await visible(dialog(page))
  await noSkeleton(page)
}
const rowAction = async (page: Page, name: RegExp) => {
  await tableLoaded(page)
  await press(firstRow(page).getByRole('button', { name }).first())
  await visible(dialog(page))
  await noSkeleton(page)
}

const withEstablishment = (patch: Partial<CanonicalEstablishment>): CanonicalDataset =>
  ({ ...canonical, establishment: { ...canonical.establishment, ...patch } })
const empty = { dataset: emptyDataset() }
const error = (...paths: string[]) => ({ overrides: Object.fromEntries(paths.map((path) => [path, 'error' as const])) })
const loading = (path: string) => ({ overrides: { [path]: 'loading' as const } })
const emptyArray = (path: string) => ({ overrides: { [path]: { status: 200, body: [], headers: { 'X-Total-Count': '0' } } } })
// No paywall scenario: in the React app getErrorCode() returns Axios' own
// `error.code` (ERR_BAD_REQUEST) before the body's PLAN_UPGRADE_REQUIRED, so the
// PaywallBanner never renders and a 403 looks like any load error.
const listStates = (name: string, path: string, endpoint: string, ready: (page: Page) => Promise<void> = tableLoaded): Scenario[] => [
  { name, path, act: ready },
  { name: `${name}-empty`, path, mock: empty, act: noSkeleton },
  { name: `${name}-loading`, path, mock: loading(endpoint), pending: true, act: async (page) => visible(page.locator('.animate-pulse').first()) },
  { name: `${name}-error`, path, mock: error(endpoint), act: noSkeleton },
]

export const scenarios: Scenario[] = [
  // ui/ primitives catalogue (dev only); the Solid /__ui (plan S1) is checked against it
  { name: 'ui', path: '/__ui', role: null },
  { name: 'ui-select-open', viewportOnly: true, path: '/__ui', role: null, act: async (page) => openSelect(page.getByTestId('ui-select-trigger')) },
  { name: 'ui-dialog', path: '/__ui', role: null, act: async (page) => {
    await press(page.getByTestId('ui-dialog-trigger'))
    await visible(dialog(page))
  } },
  { name: 'ui-dropdown-open', viewportOnly: true, path: '/__ui', role: null, act: async (page) => {
    const trigger = page.getByTestId('ui-dropdown-trigger')
    await trigger.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    await trigger.click()
    await visible(page.getByRole('menu'))
  } },
  // Public
  { name: 'landing', path: '/', role: null },
  { name: 'login', path: '/login', role: null },
  { name: 'login-register', path: '/login', role: null, act: async (page) => { await page.getByRole('tab', { name: 'Cadastro' }).click() } },
  { name: 'forgot-password', path: '/forgot-password', role: null },
  { name: 'reset-password', path: '/reset-password', role: null },
  { name: 'privacy', path: '/privacidade', role: null },
  { name: 'terms', path: '/termos', role: null },
  { name: 'not-found', path: '/rota-que-nao-existe', role: null },

  // Plan and payment
  { name: 'plan', path: '/plan', mock: { dataset: withEstablishment({ status: 'PENDING_PAYMENT', plan: 'FREE' }) } },
  { name: 'plan-annual', path: '/plan', mock: { dataset: withEstablishment({ status: 'PENDING_PAYMENT', plan: 'FREE' }) }, act: async (page) => click(page, 'Anual') },
  { name: 'payment-success', path: '/payment/success', pauseTimers: true },

  // Shell
  { name: 'onboarding', path: '/dashboard/orders', mock: { dataset: withEstablishment({ category: null, businessProfiles: [] }) }, act: async (page) => visible(dialog(page)) },
  { name: 'mobile-menu', path: '/dashboard/orders', sizes: ['mobile'], act: async (page) => {
    await tableLoaded(page)
    await click(page, 'Abrir menu')
    await visible(button(page, 'Fechar menu'))
  } },
  { name: 'cook-shell', path: '/dashboard/kitchen', role: 'COOK' },
  { name: 'driver-shell', path: '/dashboard/deliveries', role: 'DRIVER' },
  { name: 'employee-shell', path: '/dashboard/orders', role: 'EMPLOYEE', act: tableLoaded },

  // Orders
  ...listStates('orders', '/dashboard/orders', '/pedidos'),
  { name: 'orders-new', path: '/dashboard/orders', act: async (page) => openDialog(page, 'Novo pedido') },
  { name: 'orders-edit', path: '/dashboard/orders', act: async (page) => rowAction(page, /editar/i) },
  { name: 'orders-delete-confirm', path: '/dashboard/orders', act: async (page) => rowAction(page, /excluir|remover|apagar/i) },
  { name: 'orders-page-size-menu', viewportOnly: true, path: '/dashboard/orders', act: async (page) => {
    await tableLoaded(page)
    await openSelect(main(page).getByRole('combobox').last())
  } },

  // Sales
  ...listStates('sales', '/dashboard/sales', '/vendas'),
  { name: 'sales-new', path: '/dashboard/sales', act: async (page) => openDialog(page, 'Nova venda') },
  { name: 'sales-details', path: '/dashboard/sales', act: async (page) => rowAction(page, /detalhes|ver/i) },

  // Products
  ...listStates('products', '/dashboard/products', '/produtos'),
  { name: 'products-new', path: '/dashboard/products', act: async (page) => openDialog(page, 'Novo produto') },
  { name: 'products-edit', path: '/dashboard/products', act: async (page) => rowAction(page, /editar/i) },
  { name: 'products-types', path: '/dashboard/products', act: async (page) => {
    await tableLoaded(page)
    await page.getByRole('tab', { name: 'Tipos' }).click()
    await tableLoaded(page)
  } },
  { name: 'products-types-new', path: '/dashboard/products', act: async (page) => {
    await tableLoaded(page)
    await page.getByRole('tab', { name: 'Tipos' }).click()
    await openDialog(page, 'Novo tipo')
  } },

  // Services
  ...listStates('services', '/dashboard/services', '/servicos'),
  { name: 'services-new', path: '/dashboard/services', act: async (page) => openDialog(page, 'Novo serviço') },
  ...listStates('estimates', '/dashboard/estimates', '/ordens-servico'),
  { name: 'estimate-detail', path: '/dashboard/estimates/so-002', act: async (page) => visible(main(page).getByRole('heading', { level: 1 })) },
  { name: 'estimate-detail-open', path: '/dashboard/estimates/so-001', act: async (page) => visible(main(page).getByRole('heading', { level: 1 })) },
  { name: 'estimate-add-product', path: '/dashboard/estimates/so-002', act: async (page) => openDialog(page, 'Adicionar produto', async (p) => visible(main(p).getByRole('heading', { level: 1 }))) },
  ...listStates('service-orders', '/dashboard/service-orders', '/ordens-servico'),
  { name: 'service-order-detail', path: '/dashboard/service-orders/so-004', act: async (page) => visible(main(page).getByRole('heading', { level: 1 })) },
  { name: 'service-order-detail-completed', path: '/dashboard/service-orders/so-005', act: async (page) => visible(main(page).getByRole('heading', { level: 1 })) },

  // Kitchen and deliveries
  { name: 'kitchen', path: '/dashboard/kitchen' },
  { name: 'kitchen-empty', path: '/dashboard/kitchen', mock: empty },
  { name: 'kitchen-info', path: '/dashboard/kitchen', act: async (page) => {
    await press(main(page).getByRole('button', { name: 'Ver informações do item', exact: true }).first())
    await visible(dialog(page))
  } },
  { name: 'deliveries', path: '/dashboard/deliveries' },
  { name: 'deliveries-empty', path: '/dashboard/deliveries', mock: empty },
  { name: 'deliveries-assign', path: '/dashboard/deliveries', act: async (page) => openDialog(page, 'Atribuir entregador', async () => {}) },

  // Team
  { name: 'employees', path: '/dashboard/employees', act: tableLoaded },
  { name: 'employees-empty', path: '/dashboard/employees', mock: emptyArray('/usuarios'), act: noSkeleton },
  { name: 'employees-loading', path: '/dashboard/employees', mock: loading('/usuarios'), pending: true, act: async (page) => visible(page.locator('.animate-pulse').first()) },
  { name: 'employees-error', path: '/dashboard/employees', mock: error('/usuarios'), act: noSkeleton },
  { name: 'employees-new', path: '/dashboard/employees', act: async (page) => openDialog(page, 'Novo funcionário') },
  { name: 'employees-edit', path: '/dashboard/employees', act: async (page) => {
    await tableLoaded(page)
    await main(page).locator('tbody tr').nth(1).getByRole('button', { name: /editar/i }).click()
    await visible(dialog(page))
  } },
  ...listStates('devices', '/dashboard/devices', '/dispositivos'),
  { name: 'devices-delete-confirm', path: '/dashboard/devices', act: async (page) => rowAction(page, /excluir|remover|desvincular/i) },

  // Schedule
  { name: 'schedule', path: '/dashboard/schedule', act: async (page) => visible(main(page).locator('.fc-timegrid')) },
  { name: 'schedule-month', path: '/dashboard/schedule', act: async (page) => { await main(page).locator('.fc-dayGridMonth-button').click(); await visible(main(page).locator('.fc-daygrid')) } },
  { name: 'schedule-list', path: '/dashboard/schedule', act: async (page) => { await main(page).locator('.fc-listWeek-button').click(); await visible(main(page).locator('.fc-list')) } },
  { name: 'schedule-hours', path: '/dashboard/schedule', act: async (page) => openDialog(page, 'Editar funcionamento', async () => {}) },
  { name: 'schedule-filter', path: '/dashboard/schedule', act: async (page) => openDialog(page, 'Filtrar por Funcionário', async () => {}) },
  { name: 'schedule-new-shift', path: '/dashboard/schedule', act: async (page) => openDialog(page, 'Novo turno', async () => {}) },
  { name: 'schedule-new-special', path: '/dashboard/schedule', act: async (page) => openDialog(page, 'Novo horário especial', async () => {}) },

  // Reports
  { name: 'charts', path: '/dashboard/charts', act: tableLoaded, mask: (page) => [main(page).locator('.recharts-wrapper')] },
  { name: 'charts-hours', path: '/dashboard/charts', act: async (page) => {
    await page.getByRole('tab', { name: 'Vendas por horário' }).click()
    await noSkeleton(page)
  }, mask: (page) => [main(page).locator('.recharts-wrapper')] },
  { name: 'charts-type-menu', viewportOnly: true, path: '/dashboard/charts', act: async (page) => {
    await tableLoaded(page)
    await openSelect(main(page).getByRole('combobox').first())
  }, mask: (page) => [main(page).locator('.recharts-wrapper')] },
  { name: 'charts-error', path: '/dashboard/charts', mock: error('/graficos', '/graficos/lista'), act: noSkeleton },

  // Settings
  { name: 'settings', path: '/dashboard/settings' },
  { name: 'settings-free-plan', path: '/dashboard/settings', mock: { dataset: withEstablishment({ plan: 'FREE' }) } },
  { name: 'settings-language-menu', viewportOnly: true, path: '/dashboard/settings', act: async (page) => {
    await openSelect(main(page).getByRole('combobox').first())
  } },
  { name: 'settings-delete-account', path: '/dashboard/settings', act: async (page) => openDialog(page, /excluir (minha )?conta/i, async () => {}) },
]
