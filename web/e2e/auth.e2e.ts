import { expect, test, type Page, type Request } from '@playwright/test'
import { problem } from '../../e2e/visual/data/v1'
import { mockV1Api } from './visual/support/mock-v1'

// The auth pages of the Solid app (plan S2) against the /v1 mock: the user
// starts signed out (refresh cookie refused) and the auth calls answer as the
// Go API does. Google is not exercised here: the GSI script is a third-party
// host, which the mock blocks.

const authCall = (page: Page, path: string) =>
  page.waitForRequest((request) => request.method() === 'POST' && new URL(request.url()).pathname === path)
const body = (request: Request) => request.postDataJSON() as Record<string, unknown>

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('tozzo.locale', 'pt-BR'))
})

test('login with email and password opens the session and lands on the dashboard', async ({ page }) => {
  const mock = await mockV1Api(page, { role: null, signInAs: 'OWNER' })
  await page.goto('/login')

  await page.getByLabel('Email').fill(' Victor@Example.com ')
  await page.getByLabel('Senha').fill('senha1234')
  const login = authCall(page, '/v1/auth/login')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()

  expect(body(await login)).toEqual({ email: 'victor@example.com', password: 'senha1234', client: 'web' })
  await expect(page).toHaveURL(/\/dashboard\/orders$/)
  await expect(page.getByText('Victor Tozzo')).toBeVisible()
  expect(mock.unknown).toEqual([])
})

test('wrong credentials keep the user on the form with the message', async ({ page }) => {
  await mockV1Api(page, { role: null, overrides: { '/v1/auth/login': problem(401, 'INVALID_CREDENTIALS') } })
  await page.goto('/login')

  await page.getByLabel('Email').fill('victor@example.com')
  await page.getByLabel('Senha').fill('errada123')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()

  await expect(page.getByText(/^Email ou senha incorretos\./)).toBeVisible()
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByLabel('Senha')).toHaveValue('errada123')
})

test('sign-up sends the account to the API and asks to confirm the email', async ({ page }) => {
  await mockV1Api(page, { role: null })
  await page.goto('/register')

  await expect(page.getByRole('tab', { name: 'Cadastro' })).toHaveAttribute('aria-selected', 'true')
  await page.getByLabel('Nome do responsável').fill('Ana')
  await page.getByLabel('Nome do estabelecimento').fill('Bar da Ana')
  await page.getByLabel('Email').fill('ana@example.com')
  await page.getByLabel('Senha').fill('senha1234')
  await page.getByRole('checkbox', { name: /Li e aceito/ }).check()
  const register = authCall(page, '/v1/auth/register')
  await page.getByRole('button', { name: 'Criar e assinar' }).click()

  expect(body(await register)).toEqual({
    email: 'ana@example.com',
    password: 'senha1234',
    name: 'Ana',
    tradeName: 'Bar da Ana',
    termsAccepted: true,
    locale: 'pt-BR',
    client: 'web',
  })
  await expect(page.getByText('Confirme seu email', { exact: true })).toBeVisible()
  await expect(page.getByText('Conta criada! Enviamos um link de confirmação para ana@example.com.')).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Login' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByLabel('Email')).toHaveValue('ana@example.com')
  await expect(page.getByRole('button', { name: /Reenviar em \d+s/ })).toBeDisabled()
})

test('forgot password sends the link without saying whether the account exists', async ({ page }) => {
  await mockV1Api(page, { role: null })
  await page.goto('/login')
  await page.getByRole('link', { name: 'Esqueci minha senha' }).click()
  await expect(page).toHaveURL(/\/forgot-password$/)

  await page.getByLabel('Email').fill('ana@example.com')
  const forgot = authCall(page, '/v1/auth/password/forgot')
  await page.getByRole('button', { name: 'Enviar link' }).click()

  expect(body(await forgot)).toEqual({ email: 'ana@example.com' })
  await expect(page.getByText(/^Se existir uma conta com ana@example\.com/)).toBeVisible()
})

test('reset password with the link token sets the new password and goes to the login', async ({ page }) => {
  await mockV1Api(page, { role: null })
  await page.goto('/reset-password?token=reset-token')

  await page.getByLabel('Nova senha', { exact: true }).fill('novaSenha123')
  await page.getByLabel('Confirmar nova senha').fill('novaSenha123')
  const reset = authCall(page, '/v1/auth/password/reset')
  await page.getByRole('button', { name: 'Redefinir senha' }).click()

  expect(body(await reset)).toEqual({ token: 'reset-token', newPassword: 'novaSenha123' })
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByText('Senha redefinida com sucesso.')).toBeVisible()
})

test('an expired reset link offers a new one', async ({ page }) => {
  await mockV1Api(page, { role: null, overrides: { '/v1/auth/password/reset': problem(400, 'TOKEN_INVALID') } })
  await page.goto('/reset-password?token=used-token')

  await page.getByLabel('Nova senha', { exact: true }).fill('novaSenha123')
  await page.getByLabel('Confirmar nova senha').fill('novaSenha123')
  await page.getByRole('button', { name: 'Redefinir senha' }).click()

  await expect(page.getByText('Este link de redefinição expirou ou já foi usado.')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Pedir um novo link' })).toHaveAttribute('href', '/forgot-password')
})

test('the sign-up confirmation link signs the user in', async ({ page }) => {
  await mockV1Api(page, { role: null, signInAs: 'OWNER' })
  const verify = authCall(page, '/v1/auth/verify-email')
  await page.goto('/verify-email?token=verify-token')

  expect(body(await verify)).toEqual({ token: 'verify-token', client: 'web' })
  await expect(page).toHaveURL(/\/dashboard\/orders$/)
})

test('a signed-in user who opens /login goes to the dashboard', async ({ page }) => {
  await mockV1Api(page, { role: 'OWNER' })
  await page.goto('/login')
  await expect(page).toHaveURL(/\/dashboard\/orders$/)
})
