import { afterEach, beforeEach, describe, expect, it, vi } from 'bun:test'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'

import { I18nProvider } from '@/i18n/provider'
import { i18n } from '@/i18n/config'
import api from '@/services/api'
import { replaceProperty } from '@/test/replace-property'
import { BusinessPreferencesPanel } from './BusinessPreferencesPanel'

let role = 'OWNER'
const refreshUserProfile = vi.fn().mockResolvedValue(undefined)
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { role }, refreshUserProfile }) }))

function renderPanel() {
  return render(<I18nProvider><BusinessPreferencesPanel /></I18nProvider>)
}

describe('BusinessPreferencesPanel', () => {
  let restoreGet: () => void
  let restorePatch: () => void
  let get: ReturnType<typeof vi.fn>
  let patch: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    role = 'OWNER'
    refreshUserProfile.mockClear()
    await i18n.changeLanguage('pt-BR')
    get = vi.fn().mockResolvedValue({ data: {
      profiles: ['FOOD'], visibleModules: ['ORDERS', 'KITCHEN', 'DELIVERIES', 'SALES', 'PRODUCTS', 'EMPLOYEES', 'SCHEDULE', 'DEVICES', 'REPORTS', 'SETTINGS'], revision: 2,
    } })
    patch = vi.fn().mockResolvedValue({ data: {
      profiles: ['FOOD', 'SERVICES'], visibleModules: ['ORDERS', 'KITCHEN', 'DELIVERIES', 'SALES', 'PRODUCTS', 'SERVICES', 'ESTIMATES', 'EMPLOYEES', 'SCHEDULE', 'DEVICES', 'REPORTS', 'SETTINGS'], revision: 3,
    } })
    restoreGet = replaceProperty(api, 'get', get as typeof api.get)
    restorePatch = replaceProperty(api, 'patch', patch as typeof api.patch)
  })

  afterEach(() => { restoreGet(); restorePatch() })

  it('groups the service modules beneath their profile before saving', async () => {
    const user = userEvent.setup()
    renderPanel()
    const profiles = await screen.findByRole('group', { name: 'Perfis do negócio' })
    await user.click(within(profiles).getByRole('checkbox', { name: 'Prestador de serviços' }))

    const services = within(profiles).getByRole('group', { name: 'Prestador de serviços' })
    expect(within(services).getByRole('checkbox', { name: /Orçamentos/ })).toBeChecked()
    expect(screen.queryByText('Prévia do menu')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Salvar perfis' }))

    await waitFor(() => expect(patch).toHaveBeenCalledWith('/establishments/preferences', {
      profiles: ['FOOD', 'SERVICES'],
      visibleModules: ['ORDERS', 'KITCHEN', 'DELIVERIES', 'SALES', 'PRODUCTS', 'SERVICES', 'ESTIMATES', 'EMPLOYEES', 'SCHEDULE', 'DEVICES', 'REPORTS', 'SETTINGS'],
      expectedRevision: 2,
    }))
    expect(refreshUserProfile).toHaveBeenCalledTimes(1)
  })

  it('lets the owner hide orders without offering standard modules as options', async () => {
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
    await waitFor(() => expect(patch).toHaveBeenCalledWith('/establishments/preferences', expect.objectContaining({
      visibleModules: ['KITCHEN', 'DELIVERIES', 'SALES', 'PRODUCTS', 'EMPLOYEES', 'SCHEDULE', 'DEVICES', 'REPORTS', 'SETTINGS'],
      expectedRevision: 2,
    })))
  })

  it('removes food modules when food is disabled and retains the general schedule', async () => {
    const user = userEvent.setup()
    renderPanel()
    const profiles = await screen.findByRole('group', { name: 'Perfis do negócio' })
    await user.click(within(profiles).getByRole('checkbox', { name: 'Loja' }))
    await user.click(within(profiles).getByRole('checkbox', { name: 'Alimentação' }))
    expect(within(profiles).getByRole('checkbox', { name: 'Pedidos' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Salvar perfis' }))
    await waitFor(() => expect(patch).toHaveBeenCalledWith('/establishments/preferences', expect.objectContaining({
      profiles: ['STORE'],
      visibleModules: ['SALES', 'PRODUCTS', 'EMPLOYEES', 'SCHEDULE', 'DEVICES', 'REPORTS', 'SETTINGS'],
    })))
  })

  it('shows optional future stock controls in their matching profile', async () => {
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

  it('shows a reload action after a concurrent update', async () => {
    const user = userEvent.setup()
    patch.mockRejectedValue({ response: { status: 409 } })
    renderPanel()
    await screen.findByRole('group', { name: 'Perfis do negócio' })
    await user.click(screen.getByRole('button', { name: 'Salvar perfis' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Outra sessão alterou essas preferências')
    expect(screen.getByRole('button', { name: 'Salvar perfis' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Recarregar preferências' }))
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2))
  })

  it('shows a read-only selection to a manager', async () => {
    role = 'MANAGER'
    renderPanel()
    const profiles = await screen.findByRole('group', { name: 'Perfis do negócio' })
    expect(within(profiles).getByRole('checkbox', { name: 'Alimentação' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Salvar perfis' })).not.toBeInTheDocument()
  })

  it('does not report a saved change as failed if the profile refresh fails', async () => {
    const user = userEvent.setup()
    const toastError = vi.spyOn(toast, 'error').mockImplementation(() => '')
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    refreshUserProfile.mockRejectedValueOnce(new Error('Profile refresh failed'))
    try {
      renderPanel()
      await screen.findByRole('group', { name: 'Perfis do negócio' })
      await user.click(screen.getByRole('button', { name: 'Salvar perfis' }))
      await waitFor(() => expect(refreshUserProfile).toHaveBeenCalledTimes(1))
      expect(toastError).not.toHaveBeenCalled()
    } finally {
      toastError.mockRestore()
      consoleError.mockRestore()
    }
  })
})
