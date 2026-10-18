import { Route } from '@solidjs/router'
import { screen, waitFor, within } from '@solidjs/testing-library'
import userEvent from '@testing-library/user-event'
import { toast } from 'solid-sonner'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n/config'
import { json, mockApi, problem } from '@/test/api'
import { authMocks, resetAuthMocks, setMockUser } from '@/test/auth-mock'
import { renderDashboard } from '@/test/dashboard'
import { BusinessPreferencesPanel } from './BusinessPreferencesPanel'

vi.mock('@/contexts/AuthContext', () => import('@/test/auth-mock'))

const FOOD_MODULES = ['ORDERS', 'KITCHEN', 'DELIVERIES', 'SALES', 'PRODUCTS', 'EMPLOYEES', 'SCHEDULE', 'DEVICES', 'REPORTS', 'SETTINGS']
const SAVED = { profiles: ['FOOD', 'SERVICES'], visibleModules: ['ORDERS', 'KITCHEN', 'DELIVERIES', 'SALES', 'PRODUCTS', 'SERVICES', 'ESTIMATES', 'SERVICE_ORDERS', 'EMPLOYEES', 'SCHEDULE', 'DEVICES', 'REPORTS', 'SETTINGS'], revision: 3 }

function preferencesApi(patch: () => Response = () => json(200, SAVED)) {
  return mockApi(({ method, path }) => {
    if (path !== '/v1/establishment/preferences') return undefined
    return method === 'PATCH' ? patch() : json(200, { profiles: ['FOOD'], visibleModules: FOOD_MODULES, revision: 2 })
  })
}
const patches = (api: ReturnType<typeof mockApi>) => api.calls.filter((call) => call.method === 'PATCH')
const renderPanel = () => renderDashboard('/', () => <Route path="/" component={BusinessPreferencesPanel} />)

describe('BusinessPreferencesPanel', () => {
  beforeEach(async () => {
    resetAuthMocks()
    setMockUser({ role: 'OWNER' })
    await i18n.changeLanguage('pt-BR')
  })
  afterEach(() => { vi.unstubAllGlobals() })

  it('groups the service modules beneath their profile before saving', async () => {
    const api = preferencesApi()
    const user = userEvent.setup()
    renderPanel()
    const profiles = await screen.findByRole('group', { name: 'Perfis do negócio' })
    await user.click(within(profiles).getByRole('checkbox', { name: 'Prestador de serviços' }))

    const services = within(profiles).getByRole('group', { name: 'Prestador de serviços' })
    expect(within(services).getByRole('checkbox', { name: /Orçamentos/ })).toBeChecked()
    expect(within(services).queryByText('Este módulo estará disponível em uma atualização futura.')).not.toBeInTheDocument()
    expect(screen.queryByText('Prévia do menu')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Salvar perfis' }))

    await waitFor(() => expect(patches(api)[0]?.body).toEqual({
      profiles: ['FOOD', 'SERVICES'],
      visibleModules: SAVED.visibleModules,
      expectedRevision: 2,
    }))
    await waitFor(() => expect(authMocks.refreshUserProfile).toHaveBeenCalledTimes(1))
  })

  it('lets the owner hide orders without offering standard modules as options', async () => {
    const api = preferencesApi()
    const user = userEvent.setup()
    renderPanel()
    const profiles = await screen.findByRole('group', { name: 'Perfis do negócio' })
    const food = within(profiles).getByRole('group', { name: 'Alimentação' })
    await user.click(within(food).getByRole('checkbox', { name: 'Pedidos' }))
    const general = screen.getByRole('group', { name: 'Módulos no menu' })
    expect(within(general).queryByRole('checkbox', { name: /Vendas/ })).not.toBeInTheDocument()
    expect(within(general).queryByRole('checkbox', { name: /Produtos/ })).not.toBeInTheDocument()
    expect(within(general).queryByRole('checkbox', { name: /Relatórios/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Salvar perfis' }))
    await waitFor(() => expect(patches(api)[0]?.body).toMatchObject({
      visibleModules: ['KITCHEN', 'DELIVERIES', 'SALES', 'PRODUCTS', 'EMPLOYEES', 'SCHEDULE', 'DEVICES', 'REPORTS', 'SETTINGS'],
      expectedRevision: 2,
    }))
  })

  it('removes food modules when food is disabled and retains the general schedule', async () => {
    const api = preferencesApi()
    const user = userEvent.setup()
    renderPanel()
    const profiles = await screen.findByRole('group', { name: 'Perfis do negócio' })
    await user.click(within(profiles).getByRole('checkbox', { name: 'Loja' }))
    await user.click(within(profiles).getByRole('checkbox', { name: 'Alimentação' }))
    expect(within(profiles).getByRole('checkbox', { name: 'Pedidos' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Salvar perfis' }))
    await waitFor(() => expect(patches(api)[0]?.body).toMatchObject({
      profiles: ['STORE'],
      visibleModules: ['SALES', 'PRODUCTS', 'EMPLOYEES', 'SCHEDULE', 'DEVICES', 'REPORTS', 'SETTINGS'],
    }))
  })

  it('shows optional future stock controls in their matching profile', async () => {
    preferencesApi()
    const user = userEvent.setup()
    renderPanel()
    const profiles = await screen.findByRole('group', { name: 'Perfis do negócio' })
    const food = within(profiles).getByRole('group', { name: 'Alimentação' })
    const ingredients = within(food).getByRole('checkbox', { name: /Estoque de ingredientes/ })
    expect(ingredients).not.toBeChecked()
    expect(within(food).getByText('Este módulo estará disponível em uma atualização futura.')).toBeInTheDocument()
    await user.click(within(profiles).getByRole('checkbox', { name: 'Loja' }))
    const store = within(profiles).getByRole('group', { name: 'Loja' })
    const inventory = within(store).getByRole('checkbox', { name: /Estoque da loja/ })
    expect(inventory).not.toBeChecked()
    await user.click(ingredients)
    await user.click(inventory)
    expect(ingredients).toBeChecked()
    expect(inventory).toBeChecked()
  })

  it('shows a reload action after a concurrent update (409 PREFERENCES_CONFLICT)', async () => {
    const api = preferencesApi(() => problem(409, 'PREFERENCES_CONFLICT'))
    const user = userEvent.setup()
    renderPanel()
    await screen.findByRole('group', { name: 'Perfis do negócio' })
    await user.click(screen.getByRole('button', { name: 'Salvar perfis' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Outra sessão alterou essas preferências')
    expect(screen.getByRole('button', { name: 'Salvar perfis' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Recarregar preferências' }))
    await waitFor(() => expect(api.calls.filter((call) => call.method === 'GET')).toHaveLength(2))
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
    expect(screen.getByRole('button', { name: 'Salvar perfis' })).toBeEnabled()
  })

  it('shows a reload action when loading fails', async () => {
    let fail = true
    mockApi(({ path }) => {
      if (path !== '/v1/establishment/preferences') return undefined
      return fail ? problem(500, 'INTERNAL_ERROR') : json(200, { profiles: ['FOOD'], visibleModules: FOOD_MODULES, revision: 2 })
    })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const user = userEvent.setup()
    renderPanel()
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar as preferências do negócio.')
    fail = false
    await user.click(screen.getByRole('button', { name: 'Recarregar preferências' }))
    expect(await screen.findByRole('group', { name: 'Perfis do negócio' })).toBeInTheDocument()
  })

  it('shows a read-only selection to a manager', async () => {
    setMockUser({ role: 'MANAGER' })
    preferencesApi()
    renderPanel()
    const profiles = await screen.findByRole('group', { name: 'Perfis do negócio' })
    expect(within(profiles).getByRole('checkbox', { name: 'Alimentação' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Salvar perfis' })).not.toBeInTheDocument()
  })

  it('does not report a saved change as failed if the profile refresh fails', async () => {
    preferencesApi()
    const toastError = vi.spyOn(toast, 'error').mockImplementation(() => '')
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    authMocks.refreshUserProfile.mockRejectedValueOnce(new Error('Profile refresh failed'))
    const user = userEvent.setup()
    renderPanel()
    await screen.findByRole('group', { name: 'Perfis do negócio' })
    await user.click(screen.getByRole('button', { name: 'Salvar perfis' }))
    await waitFor(() => expect(authMocks.refreshUserProfile).toHaveBeenCalledTimes(1))
    expect(toastError).not.toHaveBeenCalled()
  })
})
