import { Route } from '@solidjs/router'
import { screen, waitFor } from '@solidjs/testing-library'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n/config'
import { json, mockApi, type RecordedCall } from '@/test/api'
import { renderDashboard } from '@/test/dashboard'
import { EstablishmentOnboardingModal } from './EstablishmentOnboardingModal'

const PREFERENCES = '/v1/establishment/preferences'
const TYPES = '/v1/product-types'

function renderModal(onSaved: () => Promise<void> | void = vi.fn()) {
  renderDashboard('/', () => <Route path="/" component={() => <EstablishmentOnboardingModal open onSaved={onSaved} />} />)
  return { onSaved }
}

async function chooseBurgerShop(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('checkbox', { name: 'Alimentação' }))
  await user.click(screen.getByRole('button', { name: /^Categoria do estabelecimento/ }))
  await user.click(await screen.findByRole('option', { name: 'Hamburgueria' }))
}

const okApi = (handler: (call: RecordedCall) => Response | undefined = () => undefined) => mockApi((call) => {
  const answer = handler(call)
  if (answer) return answer
  if (call.path === PREFERENCES) return json(200, { profiles: [], visibleModules: [], revision: 1 })
  if (call.path === '/v1/establishment/category') return json(200, {})
  if (call.path === TYPES) return json(201, {})
  return undefined
})

describe('EstablishmentOnboardingModal', () => {
  beforeEach(async () => { await i18n.changeLanguage('pt-BR') })
  afterEach(() => { vi.unstubAllGlobals() })

  it('saves food as a business profile while keeping the optional food category', async () => {
    const api = okApi()
    const user = userEvent.setup()
    const { onSaved } = renderModal()

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Fechar' })).not.toBeInTheDocument()

    await chooseBurgerShop(user)
    expect(screen.getByDisplayValue('Lanches')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Bebidas')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Salvar perfis' }))

    await waitFor(() => expect(api.to(PREFERENCES)[0]?.body).toEqual({
      profiles: ['FOOD'],
      visibleModules: ['ORDERS', 'KITCHEN', 'DELIVERIES', 'SALES', 'PRODUCTS', 'EMPLOYEES', 'SCHEDULE', 'DEVICES', 'REPORTS', 'SETTINGS'],
      expectedRevision: 0,
    }))
    expect(api.to('/v1/establishment/category')[0]).toMatchObject({ method: 'PUT', body: { category: 'BURGER_SHOP' } })
    expect(onSaved).toHaveBeenCalledTimes(1)
  })

  it('combines store and services without asking for a food category', async () => {
    const api = okApi()
    const user = userEvent.setup()
    renderModal()
    await user.click(await screen.findByRole('checkbox', { name: 'Loja' }))
    await user.click(screen.getByRole('checkbox', { name: 'Prestador de serviços' }))
    expect(screen.queryByRole('button', { name: /^Categoria do estabelecimento/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Salvar perfis' }))
    await waitFor(() => expect(api.to(PREFERENCES)[0]?.body).toEqual({
      profiles: ['STORE', 'SERVICES'],
      visibleModules: ['SALES', 'PRODUCTS', 'SERVICES', 'ESTIMATES', 'SERVICE_ORDERS', 'EMPLOYEES', 'DEVICES', 'REPORTS', 'SETTINGS'],
      expectedRevision: 0,
    }))
    expect(api.calls).toHaveLength(1)
  })

  it('does not add suggestions again after success', async () => {
    const api = okApi()
    const user = userEvent.setup()
    renderModal()
    await chooseBurgerShop(user)
    const button = screen.getByRole('button', { name: 'Adicionar tipos sugeridos' })
    await user.dblClick(button)
    await waitFor(() => expect(api.to(TYPES)).toHaveLength(4))
    await waitFor(() => expect(button).toBeDisabled())
    await user.click(button)
    expect(api.to(TYPES)).toHaveLength(4)
    expect(api.to(TYPES)[0]?.body).toEqual({ description: 'Lanches', color: '#9E9E9E' })
  })

  it('retries only unfinished suggestions after a partial failure', async () => {
    let attempt = 0
    const api = okApi(({ path }) => {
      if (path !== TYPES) return undefined
      attempt += 1
      return attempt === 2 ? json(500, { title: 'x', status: 500, code: 'INTERNAL_ERROR' }) : json(201, {})
    })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const user = userEvent.setup()
    renderModal()
    await chooseBurgerShop(user)
    const button = screen.getByRole('button', { name: 'Adicionar tipos sugeridos' })
    await user.click(button)
    await waitFor(() => expect(button).toBeEnabled())
    await user.click(button)
    await waitFor(() => expect(button).toBeDisabled())
    expect(api.to(TYPES).filter((call) => (call.body as { description: string }).description === 'Lanches')).toHaveLength(1)
    expect(api.to(TYPES)).toHaveLength(5)
  })

  it('stays saved, with the button off, until the profile arrives; then only retries the refresh', async () => {
    const api = okApi()
    let finishRefresh: () => void = () => {}
    const onSaved = vi.fn(() => new Promise<void>((resolve) => { finishRefresh = resolve }))
    const user = userEvent.setup()
    renderModal(onSaved)
    await user.click(await screen.findByRole('checkbox', { name: 'Loja' }))
    await user.click(screen.getByRole('button', { name: 'Salvar perfis' }))

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
    const saving = screen.getByRole('button', { name: 'Salvando...' })
    expect(saving).toBeDisabled()
    await user.click(saving)
    expect(api.to(PREFERENCES)).toHaveLength(1)

    // The refresh ends but the session user still has no profile (a failed
    // /v1/me): the modal stays, and saving again only refreshes.
    finishRefresh()
    const save = await screen.findByRole('button', { name: 'Salvar perfis' })
    await waitFor(() => expect(save).toBeEnabled())
    expect(screen.getByRole('checkbox', { name: 'Loja' })).toBeDisabled()
    await user.click(save)
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(2))
    expect(api.to(PREFERENCES)).toHaveLength(1)
  })

  it('takes a revision conflict as already saved and refreshes the profile', async () => {
    const api = okApi(({ path }) => (path === PREFERENCES ? json(409, { title: 'x', status: 409, code: 'PREFERENCES_CONFLICT' }) : undefined))
    const onSaved = vi.fn(async () => {})
    const user = userEvent.setup()
    renderModal(onSaved)
    await user.click(await screen.findByRole('checkbox', { name: 'Loja' }))
    await user.click(screen.getByRole('button', { name: 'Salvar perfis' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
    expect(api.to(PREFERENCES)).toHaveLength(1)
  })
})
