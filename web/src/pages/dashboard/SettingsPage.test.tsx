import { Route } from '@solidjs/router'
import { screen, waitFor } from '@solidjs/testing-library'
import userEvent from '@testing-library/user-event'
import { toast } from 'solid-sonner'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { EstablishmentView } from '@/api/establishment'
import type { Role } from '@/domain/user'
import { i18n } from '@/i18n/config'
import { json, mockApi, noContent, problem } from '@/test/api'
import { authMocks, resetAuthMocks, setMockUser } from '@/test/auth-mock'
import { renderDashboard } from '@/test/dashboard'
import SettingsPage from './SettingsPage'

vi.mock('@/contexts/AuthContext', () => import('@/test/auth-mock'))
// The panel has its own tests; here it only must not call the API.
vi.mock('@/components/dashboard/BusinessPreferencesPanel', () => ({ BusinessPreferencesPanel: () => null }))

function view(patch: Partial<EstablishmentView> = {}): EstablishmentView {
  return {
    id: 'est-42', tradeName: 'Burger', phone: '11999999999', cnpj: '123', status: 'ACTIVE', plan: 'PAID', category: 'BURGER_SHOP',
    isLifetime: false, subscriptionExpiresAt: null, extraDevices: 0, logoUrl: null, createdAt: '2026-01-01T00:00:00Z',
    address: { zipCode: '01001000', street: 'Rua A', number: '10', complement: 'Sala 1', neighborhood: 'Centro', city: 'São Paulo', state: 'SP' },
    limits: { devices: 8, products: null, reportsPerMonth: null, printsPerDay: null },
    usage: { devices: 3, activeProducts: 10, reportsThisMonth: 0, printsToday: 5 },
    ...patch,
  }
}
const FREE = { plan: 'FREE', limits: { devices: 3, products: 60, reportsPerMonth: 5, printsPerDay: 30 }, usage: { devices: 2, activeProducts: 4, reportsThisMonth: 2, printsToday: 12 } } as const

function signIn(role: Role) {
  setMockUser({ role, id: 'usr-7', name: 'Ana', establishment: { id: 'est-42', tradeName: 'Hamburgueria da Ana', status: 'ACTIVE', plan: 'PAID', category: null, preferencesRevision: 0 } })
}

const renderSettings = () => renderDashboard('/dashboard/settings', () => <>
  <Route path="/dashboard/settings" component={SettingsPage} />
  <Route path="/login" component={() => <p>Login page</p>} />
  <Route path="/plan" component={() => <p>Plan page</p>} />
</>)

describe('SettingsPage', () => {
  beforeEach(async () => {
    resetAuthMocks()
    localStorage.clear()
    document.documentElement.classList.remove('light', 'dark')
    await i18n.changeLanguage('pt-BR')
  })
  afterEach(() => { vi.unstubAllGlobals() })

  it('renders the page heading, locale picker, and printing section', () => {
    mockApi(() => json(200, view()))
    renderSettings()
    expect(screen.getByRole('heading', { name: 'Configurações' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Idioma atual/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Largura do papel/ })).toBeInTheDocument()
  })

  it('toggles the theme when the mode button is clicked', async () => {
    mockApi(() => json(200, view()))
    const user = userEvent.setup()
    renderSettings()
    expect(document.documentElement.classList.contains('light')).toBe(true)
    await user.click(screen.getByRole('button', { name: i18n.t('accessibility.toggleTheme', { ns: 'common' }) }))
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(localStorage.getItem('vite-ui-theme')).toBe('dark')
  })

  it('changes the active locale immediately and persists the selected value', async () => {
    mockApi(() => json(200, view()))
    const user = userEvent.setup()
    renderSettings()
    await user.click(screen.getByRole('button', { name: /^Idioma atual/ }))
    await user.click(await screen.findByRole('option', { name: 'Español' }))

    expect(await screen.findByRole('heading', { name: 'Configuración' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Idioma: Español')
    expect(localStorage.getItem('tozzo.locale')).toBe('es')
  })

  it('shows and persists the selected paper width', async () => {
    localStorage.setItem('tozzo.printerWidth', '58mm')
    mockApi(() => json(200, view()))
    const user = userEvent.setup()
    renderSettings()
    expect(screen.getByRole('button', { name: /^Largura do papel/ })).toHaveTextContent('58mm')
    await user.click(screen.getByRole('button', { name: /^Largura do papel/ }))
    await user.click(await screen.findByRole('option', { name: '110mm' }))
    expect(localStorage.getItem('tozzo.printerWidth')).toBe('110mm')
  })

  it('shows free plan usage counters and the upgrade button to the owner', async () => {
    signIn('OWNER')
    mockApi(({ path }) => (path === '/v1/establishment' ? json(200, view(FREE)) : undefined))
    const user = userEvent.setup()
    renderSettings()
    expect(await screen.findByText('Plano e uso')).toBeInTheDocument()
    expect(screen.getByText('12/30')).toBeInTheDocument()
    expect(screen.getByText('2/5')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Fazer upgrade' }))
    expect(await screen.findByText('Plan page')).toBeInTheDocument()
  })

  it('shows unlimited usage for paid plans', async () => {
    signIn('OWNER')
    mockApi(({ path }) => (path === '/v1/establishment' ? json(200, view()) : undefined))
    renderSettings()
    await waitFor(() => expect(screen.getAllByText('Ilimitado').length).toBe(2))
    expect(screen.getByText('Pago')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Fazer upgrade' })).toBeNull()
  })

  it('shows data/privacy only for owners', async () => {
    mockApi(() => json(200, view()))
    signIn('MANAGER')
    const { unmount } = renderSettings()
    expect(screen.queryByRole('heading', { name: 'Dados e privacidade' })).not.toBeInTheDocument()
    unmount()
    signIn('OWNER')
    renderSettings()
    expect(screen.getByRole('heading', { name: 'Dados e privacidade' })).toBeInTheDocument()
  })

  it('has no two-factor setup (removed from the new app)', async () => {
    signIn('OWNER')
    mockApi(() => json(200, view()))
    renderSettings()
    await screen.findByText('Plano e uso')
    expect(screen.queryByRole('heading', { name: 'Segurança' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Ativar 2FA' })).toBeNull()
  })

  it('exports data by downloading a JSON blob', async () => {
    signIn('OWNER')
    const api = mockApi(({ path }) => (path === '/v1/account/export' ? json(200, { establishment: { id: 'est-42' } }) : json(200, view())))
    const createObjectURL = vi.fn(() => 'blob:export')
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }))
    const toastSuccess = vi.spyOn(toast, 'success').mockImplementation(() => '')
    const user = userEvent.setup()
    renderSettings()
    await user.click(screen.getByRole('button', { name: 'Exportar meus dados' }))
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Dados exportados.'))
    expect(api.to('/v1/account/export')).toHaveLength(1)
    expect(createObjectURL).toHaveBeenCalledTimes(1)
  })

  it('requires a password, deletes the account and ends the session', async () => {
    signIn('OWNER')
    const api = mockApi(({ method, path }) => (method === 'POST' && path === '/v1/account/delete' ? noContent() : json(200, view())))
    const user = userEvent.setup()
    renderSettings()
    await user.click(screen.getByRole('button', { name: 'Excluir minha conta' }))
    const confirmButton = await screen.findByRole('button', { name: 'Excluir permanentemente' })
    expect(confirmButton).toBeDisabled()
    await user.type(screen.getByLabelText('Senha atual'), 'senha123')
    await user.click(confirmButton)
    await waitFor(() => expect(api.to('/v1/account/delete')[0]?.body).toEqual({ password: 'senha123' }))
    expect(await screen.findByText('Login page')).toBeInTheDocument()
    expect(authMocks.clearSession).toHaveBeenCalledTimes(1)
  })

  it('keeps the session when the password is wrong', async () => {
    signIn('OWNER')
    mockApi(({ method, path }) => (method === 'POST' && path === '/v1/account/delete' ? problem(401, 'INVALID_PASSWORD') : json(200, view())))
    const toastError = vi.spyOn(toast, 'error').mockImplementation(() => '')
    const user = userEvent.setup()
    renderSettings()
    await user.click(screen.getByRole('button', { name: 'Excluir minha conta' }))
    await user.type(await screen.findByLabelText('Senha atual'), 'errada')
    await user.click(screen.getByRole('button', { name: 'Excluir permanentemente' }))
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Senha incorreta.'))
    expect(authMocks.clearSession).not.toHaveBeenCalled()
  })

  it('shows establishment information only to owners and removes the fixed category card', async () => {
    mockApi(() => json(200, view()))
    signIn('MANAGER')
    const { unmount } = renderSettings()
    await screen.findByText('Plano e uso')
    expect(screen.queryByRole('heading', { name: 'Editar Informações do Estabelecimento' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Categoria do estabelecimento' })).not.toBeInTheDocument()
    unmount()
    signIn('OWNER')
    renderSettings()
    expect(await screen.findByRole('heading', { name: 'Editar Informações do Estabelecimento' })).toBeInTheDocument()
  })

  it('saves establishment information through PATCH and refreshes the navbar name', async () => {
    signIn('OWNER')
    const api = mockApi(({ method, path, body }) => {
      if (path !== '/v1/establishment') return undefined
      return method === 'PATCH' ? json(200, view({ tradeName: (body as { tradeName: string }).tradeName })) : json(200, view())
    })
    const user = userEvent.setup()
    renderSettings()
    const tradeName = await screen.findByRole('textbox', { name: 'Nome do estabelecimento' })
    await user.clear(tradeName)
    await user.type(tradeName, 'Novo Burger')
    await user.click(screen.getByRole('button', { name: 'Salvar informações' }))
    await waitFor(() => expect(api.calls.find((call) => call.method === 'PATCH')?.body).toEqual({
      tradeName: 'Novo Burger', phone: '11999999999', zipCode: '01001000', addressStreet: 'Rua A', addressNumber: '10', addressComplement: 'Sala 1', addressNeighborhood: 'Centro', addressCity: 'São Paulo', addressState: 'SP', cnpj: '123',
    }))
    // The name is in the navbar too, which reads the session user.
    await waitFor(() => expect(authMocks.refreshUserProfile).toHaveBeenCalled())
  })

  it('keeps the typed values when saving fails', async () => {
    signIn('OWNER')
    mockApi(({ method, path }) => (path === '/v1/establishment' ? (method === 'PATCH' ? problem(422, 'TRADE_NAME_REQUIRED') : json(200, view())) : undefined))
    const toastError = vi.spyOn(toast, 'error').mockImplementation(() => '')
    const user = userEvent.setup()
    renderSettings()
    const tradeName = await screen.findByRole('textbox', { name: 'Nome do estabelecimento' })
    await user.clear(tradeName)
    await user.click(screen.getByRole('button', { name: 'Salvar informações' }))
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Não foi possível salvar as informações. Tente novamente.'))
    expect(tradeName).toHaveValue('')
  })

  it('renders before the establishment loads (no suspense fallback)', async () => {
    signIn('OWNER')
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
    renderSettings()
    expect(await screen.findByRole('heading', { name: 'Configurações' })).toBeInTheDocument()
    expect(screen.queryByText('Plano e uso')).toBeNull()
    expect(screen.queryByText('Suspended')).toBeNull()
  })
})
