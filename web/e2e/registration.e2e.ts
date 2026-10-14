import { expect, test, type Page, type Route } from '@playwright/test'
import { canonical } from '../../e2e/visual/data/canonical'
import { problem, toV1 } from '../../e2e/visual/data/v1'
import { mockV1Api } from './visual/support/mock-v1'

// Registration screens of the Solid app (plan S3) against the toV1() dataset:
// what each write sends to the /v1 and what the screen does with the answer.

const API = 'api.visual.test'
const R2 = 'bucket.account.r2.cloudflarestorage.com'

interface Call { method: string; path: string; body: unknown }
type Reply = { status: number; body?: unknown } | undefined

/**
 * Answers the writes (and any GET it wants) before the toV1() mock, which only
 * reads; `reply` returning undefined hands the request back to it.
 */
async function writes(page: Page, reply: (call: Call) => Reply) {
  const calls: Call[] = []
  await page.route((url) => url.hostname === API, async (route: Route) => {
    const request = route.request()
    if (request.method() === 'OPTIONS') return route.fallback()
    const call = { method: request.method(), path: new URL(request.url()).pathname, body: request.postDataJSON?.() ?? null }
    const answer = reply(call)
    if (!answer) return route.fallback()
    if (call.method !== 'GET') calls.push(call)
    const origin = request.headers().origin ?? '*'
    const isProblem = answer.status >= 400
    return route.fulfill({
      status: answer.status,
      contentType: isProblem ? 'application/problem+json' : 'application/json',
      headers: { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Credentials': 'true' },
      body: answer.body === undefined ? '' : JSON.stringify(answer.body),
    })
  })
  return calls
}

const product = (id: string, name: string, priceCents: number, typeId: string | null, imageUrl: string | null = null) => {
  const type = canonical.productTypes.find((item) => item.id === typeId)
  return {
    id, name, priceCents, ingredients: null, imageUrl, updatedAt: canonical.establishment.createdAt,
    productType: type ? { id: type.id, description: type.description, color: type.color } : null,
  }
}
// GET /v1/establishment of the dataset: what a PATCH or PUT of it answers.
const establishmentView = (dataset = canonical) => toV1(dataset)({ method: 'GET', path: '/v1/establishment', query: new URLSearchParams() })!.body
const productPage = (items: unknown[]) => ({ status: 200, body: { items, nextCursor: null, total: items.length } })
const dialog = (page: Page) => page.getByRole('dialog')
const main = (page: Page) => page.locator('main')

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('tozzo.locale', 'pt-BR'))
})

test('products: create, edit and delete send cents and refresh the list', async ({ page }) => {
  let items = [product('prd-1', 'X-Burger', 2490, 'type-burgers')]
  await mockV1Api(page, { role: 'OWNER' })
  const calls = await writes(page, ({ method, path, body }) => {
    if (method === 'GET' && path === '/v1/products') return productPage(items)
    if (method === 'POST' && path === '/v1/products') {
      const input = body as { name: string; priceCents: number; productTypeId?: string }
      items = [...items, product('prd-new', input.name, input.priceCents, input.productTypeId ?? null)]
      return { status: 201, body: items.at(-1) }
    }
    if (method === 'PATCH' && path === '/v1/products/prd-1') {
      const input = body as { name: string; priceCents: number; productTypeId: string | null }
      items = items.map((item) => (item.id === 'prd-1' ? product('prd-1', input.name, input.priceCents, input.productTypeId) : item))
      return { status: 200, body: items[0] }
    }
    if (method === 'DELETE' && path === '/v1/products/prd-new') {
      items = items.filter((item) => item.id !== 'prd-new')
      return { status: 204 }
    }
    return undefined
  })
  await page.goto('/dashboard/products')
  await expect(main(page).getByText('X-Burger')).toBeVisible()

  // Create
  await page.getByRole('button', { name: 'Novo produto' }).click()
  await dialog(page).getByLabel('Nome').fill('Suco de Uva')
  await dialog(page).getByLabel('Preço').pressSequentially('1290')
  await expect(dialog(page).getByLabel('Preço')).toHaveValue('12.90')
  await dialog(page).getByRole('button', { name: /^Tipo/ }).click()
  await page.getByRole('option', { name: 'Bebidas' }).click()
  await dialog(page).getByRole('button', { name: 'Salvar' }).click()
  await expect(dialog(page)).toBeHidden()
  await expect(main(page).getByText('Suco de Uva')).toBeVisible()
  await expect(main(page).getByText('R$ 12,90')).toBeVisible()
  expect(calls.find((call) => call.method === 'POST')?.body).toEqual({ name: 'Suco de Uva', priceCents: 1290, ingredients: '', productTypeId: 'type-drinks' })

  // Edit: rename and take the type out
  await main(page).getByRole('row', { name: /X-Burger/ }).getByRole('button', { name: 'Editar' }).click()
  await expect(dialog(page).getByLabel('Nome')).toHaveValue('X-Burger')
  await dialog(page).getByLabel('Nome').fill('X-Burger Duplo')
  await dialog(page).getByRole('button', { name: /^Tipo/ }).click()
  await page.getByRole('option', { name: 'Sem tipo' }).click()
  await dialog(page).getByRole('button', { name: 'Salvar alterações' }).click()
  await expect(dialog(page)).toBeHidden()
  await expect(main(page).getByText('X-Burger Duplo')).toBeVisible()
  expect(calls.find((call) => call.method === 'PATCH')?.body).toEqual({ name: 'X-Burger Duplo', priceCents: 2490, ingredients: '', productTypeId: null })

  // Delete (after confirming)
  await main(page).getByRole('row', { name: /Suco de Uva/ }).getByRole('button', { name: 'Excluir' }).click()
  await dialog(page).getByRole('button', { name: 'Excluir' }).click()
  await expect(main(page).getByText('Suco de Uva')).toBeHidden()
  expect(calls.filter((call) => call.method === 'DELETE').map((call) => call.path)).toEqual(['/v1/products/prd-new'])
})

test('products: the image goes to the bucket with the pre-signed URL, then to the product', async ({ page }) => {
  const objectKey = 'establishments/est-001/products/prd-001/9f1c.png'
  const puts: { contentType: string | undefined; size: number }[] = []
  await mockV1Api(page, { role: 'OWNER' })
  // The PUT goes straight to the R2 host, mocked here. The CSP of web/public/_headers
  // is not exercised: this runs on the Vite dev server, which does not serve it.
  await page.route((url) => url.hostname === R2, async (route) => {
    const request = route.request()
    const cors = { 'Access-Control-Allow-Origin': request.headers().origin ?? '*', 'Access-Control-Allow-Methods': 'PUT', 'Access-Control-Allow-Headers': 'content-type' }
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    puts.push({ contentType: request.headers()['content-type'], size: request.postDataBuffer()?.length ?? 0 })
    return route.fulfill({ status: 200, headers: cors })
  })
  const calls = await writes(page, ({ method, path }) => {
    if (method === 'GET' && path === '/v1/products') return productPage([product('prd-001', 'X-Burger', 2490, 'type-burgers')])
    if (method === 'POST' && path === '/v1/uploads') {
      return { status: 200, body: { uploadUrl: `https://${R2}/${objectKey}?X-Amz-Signature=e2e`, objectKey, expiresAt: '2026-10-01T18:05:00Z', headers: { 'Content-Type': 'image/png' } } }
    }
    if (method === 'PATCH' && path === '/v1/products/prd-001') {
      return { status: 200, body: product('prd-001', 'X-Burger', 2490, 'type-burgers', `https://media-dev.tozzo.uk/${objectKey}`) }
    }
    return undefined
  })
  await page.goto('/dashboard/products')
  await main(page).getByRole('row', { name: /X-Burger/ }).getByRole('button', { name: 'Editar' }).click()
  await dialog(page).getByLabel('Imagem').setInputFiles({ name: 'burger.png', mimeType: 'image/png', buffer: Buffer.alloc(64, 1) })

  await expect(page.getByText('Imagem atualizada.')).toBeVisible()
  await expect(dialog(page).getByRole('img', { name: 'Imagem atual do produto' })).toHaveAttribute('src', `https://media-dev.tozzo.uk/${objectKey}`)
  expect(calls.map((call) => `${call.method} ${call.path}`)).toEqual(['POST /v1/uploads', 'PATCH /v1/products/prd-001'])
  expect(calls[0].body).toEqual({ kind: 'product', targetId: 'prd-001', contentType: 'image/png', sizeBytes: 64 })
  expect(calls[1].body).toEqual({ imageKey: objectKey })
  expect(puts).toEqual([{ contentType: 'image/png', size: 64 }])
})

test('products: without a bucket (503 NOT_READY) the upload explains itself and the dialog keeps working', async ({ page }) => {
  await mockV1Api(page, { role: 'OWNER' })
  const calls = await writes(page, ({ method, path }) => {
    if (method === 'GET' && path === '/v1/products') return productPage([product('prd-001', 'X-Burger', 2490, 'type-burgers')])
    if (method === 'POST' && path === '/v1/uploads') return problem(503, 'NOT_READY') as Reply
    if (method === 'PATCH' && path === '/v1/products/prd-001') return { status: 200, body: product('prd-001', 'X-Burger', 2590, 'type-burgers') }
    return undefined
  })
  await page.goto('/dashboard/products')
  await main(page).getByRole('row', { name: /X-Burger/ }).getByRole('button', { name: 'Editar' }).click()
  await dialog(page).getByLabel('Imagem').setInputFiles({ name: 'burger.png', mimeType: 'image/png', buffer: Buffer.alloc(64, 1) })
  await expect(page.getByText('O envio de imagens ainda não está disponível.')).toBeVisible()

  await dialog(page).getByLabel('Preço').fill('')
  await dialog(page).getByLabel('Preço').pressSequentially('2590')
  await dialog(page).getByRole('button', { name: 'Salvar alterações' }).click()
  await expect(dialog(page)).toBeHidden()
  expect(calls.map((call) => `${call.method} ${call.path}`)).toEqual(['POST /v1/uploads', 'PATCH /v1/products/prd-001'])
})

test('product types: create a type from the Types tab', async ({ page }) => {
  await mockV1Api(page, { role: 'OWNER' })
  const calls = await writes(page, ({ method, path, body }) => (method === 'POST' && path === '/v1/product-types'
    ? { status: 201, body: { id: 'type-new', isActive: true, updatedAt: canonical.establishment.createdAt, ...(body as object) } }
    : undefined))
  await page.goto('/dashboard/products')
  await page.getByRole('tab', { name: 'Tipos' }).click()
  await expect(main(page).getByText('Acompanhamentos')).toBeVisible()
  await page.getByRole('button', { name: 'Novo tipo' }).click()
  await dialog(page).getByLabel('Descrição').fill('Combos')
  await dialog(page).getByRole('button', { name: 'Salvar' }).click()
  await expect(dialog(page)).toBeHidden()
  expect(calls[0].body).toEqual({ description: 'Combos', color: '#000000' })
})

test('employees: create, edit and delete', async ({ page }) => {
  await mockV1Api(page, { role: 'OWNER' })
  const calls = await writes(page, ({ method, path, body }) => {
    if (method === 'POST' && path === '/v1/users') return { status: 201, body: { id: 'usr-new', phone: null, photoUrl: null, createdAt: canonical.establishment.createdAt, ...(body as object) } }
    if (method === 'PATCH' && path.startsWith('/v1/users/')) return { status: 200, body: { id: path.split('/').at(-1), phone: null, photoUrl: null, createdAt: canonical.establishment.createdAt, ...(body as object) } }
    if (method === 'DELETE' && path.startsWith('/v1/users/')) return { status: 204 }
    return undefined
  })
  await page.goto('/dashboard/employees')
  await expect(main(page).getByText('Carlos Souza')).toBeVisible()
  // Nobody edits the owner here.
  await expect(main(page).getByRole('row', { name: /Victor Tozzo/ }).getByRole('button')).toHaveCount(0)

  await page.getByRole('button', { name: 'Novo funcionário' }).click()
  await dialog(page).getByLabel('Nome').fill('Bruna Dias')
  await dialog(page).getByLabel('Email').fill('bruna@example.invalid')
  await dialog(page).getByLabel('Senha').fill('segredo123')
  await dialog(page).getByRole('button', { name: /^Cargo/ }).click()
  await page.getByRole('option', { name: 'Cozinheiro' }).click()
  await dialog(page).getByRole('button', { name: 'Salvar' }).click()
  await expect(dialog(page)).toBeHidden()
  expect(calls[0]).toEqual({ method: 'POST', path: '/v1/users', body: { name: 'Bruna Dias', email: 'bruna@example.invalid', password: 'segredo123', role: 'COOK' } })

  await main(page).getByRole('row', { name: /Carlos Souza/ }).getByRole('button', { name: 'Editar' }).click()
  await expect(dialog(page).getByLabel('Nome')).toHaveValue('Carlos Souza')
  await dialog(page).getByLabel('Nova senha (opcional)').fill('nova-senha-1')
  await dialog(page).getByRole('button', { name: 'Salvar alterações' }).click()
  await expect(dialog(page)).toBeHidden()
  expect(calls[1]).toEqual({ method: 'PATCH', path: '/v1/users/usr-employee', body: { name: 'Carlos Souza', email: 'employee@example.invalid', role: 'EMPLOYEE', password: 'nova-senha-1' } })

  await main(page).getByRole('row', { name: /Juliana Rocha/ }).getByRole('button', { name: 'Excluir' }).click()
  await dialog(page).getByRole('button', { name: 'Excluir' }).click()
  await expect.poll(() => calls.length).toBe(3)
  expect(calls[2]).toMatchObject({ method: 'DELETE', path: '/v1/users/usr-employee-2' })
})

test('employees: a manager on the free plan gets the PaywallBanner', async ({ page }) => {
  await mockV1Api(page, { role: 'MANAGER', overrides: { '/v1/users': problem(403, 'PLAN_UPGRADE_REQUIRED') } })
  await page.goto('/dashboard/employees')
  await expect(page.getByRole('alert')).toContainText('Este recurso está disponível apenas em planos pagos.')
  await expect(page.getByRole('alert')).toContainText('Peça pro dono fazer upgrade do plano pra liberar isso.')
  await expect(main(page).getByText('Equipe')).toBeHidden()
})

test('devices: the owner removes a device after confirming', async ({ page }) => {
  await mockV1Api(page, { role: 'OWNER' })
  const calls = await writes(page, ({ method, path }) => (method === 'DELETE' && path === '/v1/devices/dev-003' ? { status: 204 } : undefined))
  await page.goto('/dashboard/devices')
  const rows = main(page).locator('tbody tr')
  await expect(rows).toHaveCount(3)
  // Newest first: dev-003 (no last user).
  await rows.first().getByRole('button', { name: 'Remover' }).click()
  await dialog(page).getByRole('button', { name: 'Remover' }).click()
  await expect(rows).toHaveCount(2)
  expect(calls).toEqual([{ method: 'DELETE', path: '/v1/devices/dev-003', body: null }])
})

test('settings: the owner saves the business profiles and the establishment information', async ({ page }) => {
  await mockV1Api(page, { role: 'OWNER' })
  const calls = await writes(page, ({ method, path, body }) => {
    if (method === 'PATCH' && path === '/v1/establishment/preferences') return { status: 200, body: { ...(body as object), revision: 4 } }
    if (method === 'PATCH' && path === '/v1/establishment') return { status: 200, body: establishmentView() }
    return undefined
  })
  await page.goto('/dashboard/settings')
  // The fieldset (legend) holds the three profile groups.
  const profiles = page.locator('fieldset').filter({ has: page.getByText('Alimentação') }).first()
  await profiles.getByRole('checkbox', { name: 'Loja', exact: true }).check()
  await page.getByRole('button', { name: 'Salvar perfis' }).click()
  await expect(page.getByText('Preferências do negócio salvas.')).toBeVisible()
  expect(calls[0].body).toEqual({
    profiles: ['FOOD', 'STORE', 'SERVICES'],
    visibleModules: ['ORDERS', 'KITCHEN', 'DELIVERIES', 'SALES', 'PRODUCTS', 'SERVICES', 'ESTIMATES', 'SERVICE_ORDERS', 'EMPLOYEES', 'SCHEDULE', 'DEVICES', 'REPORTS', 'SETTINGS'],
    expectedRevision: 3,
  })

  await page.getByLabel('Telefone').fill('+55 11 91234-5678')
  await page.getByRole('button', { name: 'Salvar informações' }).click()
  await expect.poll(() => calls.length).toBe(2)
  expect(calls[1].body).toMatchObject({ tradeName: 'Tozzo Burger & Oficina', phone: '+55 11 91234-5678', zipCode: '01310-100', addressState: 'SP' })
})

test('onboarding: a new owner picks the profiles, the category and the suggested types', async ({ page }) => {
  const dataset = { ...canonical, establishment: { ...canonical.establishment, category: null, businessProfiles: [], visibleModules: [], preferencesRevision: 0 } }
  await mockV1Api(page, { role: 'OWNER', dataset })
  const calls = await writes(page, ({ method, path, body }) => {
    if (method === 'PUT' && path === '/v1/establishment/category') return { status: 200, body: establishmentView(dataset) }
    if (method === 'POST' && path === '/v1/product-types') return { status: 201, body: { id: 'type-x', color: '#9E9E9E', isActive: true, updatedAt: canonical.establishment.createdAt, ...(body as object) } }
    if (method === 'PATCH' && path === '/v1/establishment/preferences') return { status: 200, body: { ...(body as object), revision: 1 } }
    return undefined
  })
  await page.goto('/dashboard/orders')
  await expect(dialog(page)).toContainText('Qual é o tipo do seu negócio?')
  // It cannot be dismissed.
  await page.keyboard.press('Escape')
  await expect(dialog(page)).toBeVisible()

  await dialog(page).getByRole('checkbox', { name: 'Alimentação' }).check()
  await dialog(page).getByRole('button', { name: /^Categoria do estabelecimento/ }).click()
  await page.getByRole('option', { name: 'Pizzaria' }).click()
  await expect(dialog(page).getByLabel('Tipo sugerido 1')).toHaveValue('Pizzas')
  await dialog(page).getByLabel('Tipo sugerido 3').fill('Calzones')
  await dialog(page).getByRole('button', { name: 'Adicionar tipos sugeridos' }).click()
  await expect(dialog(page).getByRole('button', { name: 'Adicionar tipos sugeridos' })).toBeDisabled()
  await dialog(page).getByRole('button', { name: 'Salvar perfis' }).click()
  await expect(page.getByText('Preferências do negócio salvas.')).toBeVisible()

  expect(calls.filter((call) => call.path === '/v1/product-types').map((call) => (call.body as { description: string }).description))
    .toEqual(['Pizzas', 'Bebidas', 'Calzones', 'Sobremesas'])
  expect(calls.find((call) => call.path === '/v1/establishment/category')?.body).toEqual({ category: 'PIZZERIA' })
  expect(calls.find((call) => call.path === '/v1/establishment/preferences')?.body).toEqual({
    profiles: ['FOOD'],
    visibleModules: ['ORDERS', 'KITCHEN', 'DELIVERIES', 'SALES', 'PRODUCTS', 'EMPLOYEES', 'SCHEDULE', 'DEVICES', 'REPORTS', 'SETTINGS'],
    expectedRevision: 0,
  })
})
