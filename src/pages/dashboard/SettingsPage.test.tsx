import { describe, it, expect, beforeEach, afterEach, vi } from 'bun:test'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@/components/theme-provider'
import { I18nProvider } from '@/i18n/provider'
import { i18n } from '@/i18n/config'
import api from '@/services/api'
import { replaceProperty } from '@/test/replace-property'
import type { UserRole } from '@/domain/models'
import SettingsPage from './SettingsPage'

const mockUseAuth = vi.fn()

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

function authValue(role: UserRole) {
  return {
    user: {
      id: 7,
      name: 'Ana',
      email: 'ana@example.com',
      role,
      establishmentId: 42,
      establishment: {
        id: 42,
        tradeName: 'Hamburgueria da Ana',
        status: 'ACTIVE',
      },
    },
    logout: vi.fn(),
  }
}

function mockCategoryApi(category: string | null = null) {
  const getMock = vi.fn().mockResolvedValue({
    data: { id: 42, category },
  })
  const patchMock = vi.fn().mockResolvedValue({
    data: { id: 42, category },
  })
  const postMock = vi.fn().mockResolvedValue({
    data: { id: 100, description: 'created', color: '#9E9E9E' },
  })

  const restoreGet = replaceProperty(api, 'get', getMock as typeof api.get)
  const restorePatch = replaceProperty(api, 'patch', patchMock as typeof api.patch)
  const restorePost = replaceProperty(api, 'post', postMock as typeof api.post)

  return {
    getMock,
    patchMock,
    postMock,
    restore: () => {
      restoreGet()
      restorePatch()
      restorePost()
    },
  }
}

function renderWithProviders() {
  return render(
    <I18nProvider>
      <ThemeProvider>
        <SettingsPage />
      </ThemeProvider>
    </I18nProvider>,
  )
}

describe('SettingsPage', () => {
  beforeEach(async () => {
    localStorage.clear()
    document.documentElement.classList.remove('light', 'dark')
    mockUseAuth.mockReset()
    mockUseAuth.mockReturnValue({ user: null })
    await act(async () => {
      await i18n.changeLanguage('pt-BR')
    })
  })

  afterEach(() => {
    mockUseAuth.mockReset()
  })

  it('renders the page heading and appearance section', () => {
    renderWithProviders()
    expect(screen.getByText('Configurações')).toBeInTheDocument()
    expect(screen.getByText('Sistema')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Idioma atual' })).toHaveTextContent('Português (Brasil)')
    expect(screen.getByRole('status', { name: 'Idioma: Português (Brasil)' })).toHaveTextContent('Idioma: Português (Brasil)')
  })

  it('toggles the theme when the mode button is clicked', async () => {
    const user = userEvent.setup()
    renderWithProviders()

    // system theme resolves to "light" (matchMedia mocked to matches: false)
    expect(document.documentElement.classList.contains('light')).toBe(true)

    const toggleThemeLabel = i18n.t('accessibility.toggleTheme', { ns: 'common' })
    await user.click(screen.getByRole('button', { name: toggleThemeLabel }))

    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(localStorage.getItem('vite-ui-theme')).toBe('dark')
  })

  it('changes the active locale immediately and persists the selected value', async () => {
    const user = userEvent.setup()
    renderWithProviders()

    await user.click(screen.getByRole('combobox', { name: 'Idioma atual' }))
    await user.click(await screen.findByRole('option', { name: 'Español' }))

    expect(screen.getByRole('heading', { name: 'Configuración' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Idioma: Español')
    expect(localStorage.getItem('tozzo.locale')).toBe('es')
  })

  it('shows the printing section with the persisted paper width', () => {
    localStorage.setItem('tozzo.printerWidth', '58mm')
    renderWithProviders()
    expect(screen.getByRole('combobox', { name: 'Largura do papel' })).toHaveTextContent('58mm')
  })

  it('changes and persists the selected paper width', async () => {
    const user = userEvent.setup()
    renderWithProviders()

    await user.click(screen.getByRole('combobox', { name: 'Largura do papel' }))
    await user.click(await screen.findByRole('option', { name: '110mm' }))

    expect(localStorage.getItem('tozzo.printerWidth')).toBe('110mm')
  })

  it('lets an owner choose, save, edit, and create the suggested product types', async () => {
    const user = userEvent.setup()
    mockUseAuth.mockReturnValue(authValue('OWNER'))
    const apiMocks = mockCategoryApi()

    try {
      renderWithProviders()

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Categoria do estabelecimento' })).toBeInTheDocument()
      })
      expect(apiMocks.getMock).toHaveBeenCalledWith('/estabelecimentos')

      await user.click(screen.getByRole('combobox', { name: 'Categoria do estabelecimento' }))
      await user.click(await screen.findByRole('option', { name: 'Hamburgueria' }))

      expect(screen.getByDisplayValue('Lanches')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Bebidas')).toBeInTheDocument()
      expect(apiMocks.postMock).not.toHaveBeenCalled()

      await user.click(screen.getByRole('button', { name: 'Salvar categoria' }))
      await waitFor(() => {
        expect(apiMocks.patchMock).toHaveBeenCalledWith('/establishments/42', {
          category: 'HAMBURGUERIA',
        })
      })
      expect(apiMocks.postMock).not.toHaveBeenCalled()

      const firstType = screen.getByRole('textbox', { name: 'Tipo sugerido 1' })
      await user.clear(firstType)
      await user.type(firstType, 'Sanduíches')
      await user.click(screen.getByRole('button', { name: 'Adicionar tipos sugeridos' }))

      await waitFor(() => expect(apiMocks.postMock).toHaveBeenCalledTimes(4))
      expect(apiMocks.postMock.mock.calls.map(([path, payload]) => [path, payload])).toEqual([
        ['/tipos', { description: 'Sanduíches', color: '#9E9E9E' }],
        ['/tipos', { description: 'Bebidas', color: '#9E9E9E' }],
        ['/tipos', { description: 'Porções', color: '#9E9E9E' }],
        ['/tipos', { description: 'Sobremesas', color: '#9E9E9E' }],
      ])
    } finally {
      apiMocks.restore()
    }
  })

  it('shows every category with its exact ordered suggestions', async () => {
    const user = userEvent.setup()
    mockUseAuth.mockReturnValue(authValue('OWNER'))
    const apiMocks = mockCategoryApi()
    const categories = [
      ['Hamburgueria', ['Lanches', 'Bebidas', 'Porções', 'Sobremesas']],
      ['Pizzaria', ['Pizzas', 'Bebidas', 'Entradas', 'Sobremesas']],
      ['Sorveteria', ['Sorvetes', 'Açaí', 'Coberturas', 'Bebidas']],
      ['Cafeteria', ['Cafés', 'Bebidas', 'Salgados', 'Doces']],
      ['Lanchonete', ['Lanches', 'Bebidas', 'Porções', 'Doces']],
      ['Outro', ['Produtos', 'Bebidas', 'Serviços', 'Outros']],
    ] as const

    try {
      renderWithProviders()
      await waitFor(() => expect(screen.getByRole('heading', { name: 'Categoria do estabelecimento' })).toBeInTheDocument())

      for (const [label, suggestions] of categories) {
        await user.click(screen.getByRole('combobox', { name: 'Categoria do estabelecimento' }))
        await user.click(await screen.findByRole('option', { name: label }))

        expect(screen.getAllByRole('textbox', { name: /Tipo sugerido/ }).map((input) => input.getAttribute('value'))).toEqual([...suggestions])
      }
    } finally {
      apiMocks.restore()
    }
  })

  it('allows a manager to save the category without exposing owner-only type creation', async () => {
    const user = userEvent.setup()
    mockUseAuth.mockReturnValue(authValue('MANAGER'))
    const apiMocks = mockCategoryApi('HAMBURGUERIA')

    try {
      renderWithProviders()

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Categoria do estabelecimento' })).toBeInTheDocument()
      })
      const categorySelect = screen.getByRole('combobox', { name: 'Categoria do estabelecimento' })
      await waitFor(() => expect(categorySelect).toHaveTextContent('Hamburgueria'))
      expect(screen.getByRole('button', { name: 'Salvar categoria' })).toBeInTheDocument()
      expect(screen.queryByDisplayValue('Lanches')).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Adicionar tipos sugeridos' })).not.toBeInTheDocument()

      await user.click(categorySelect)
      await user.click(await screen.findByRole('option', { name: 'Pizzaria' }))
      await user.click(screen.getByRole('button', { name: 'Salvar categoria' }))

      await waitFor(() => {
        expect(apiMocks.patchMock).toHaveBeenCalledWith('/establishments/42', {
          category: 'PIZZARIA',
        })
      })
      expect(apiMocks.postMock).not.toHaveBeenCalled()
    } finally {
      apiMocks.restore()
    }
  })

  it('shows the data/privacy section only for OWNER', () => {
    mockUseAuth.mockReturnValue(authValue('MANAGER'))
    const apiMocks = mockCategoryApi()

    try {
      renderWithProviders()
      expect(screen.queryByRole('heading', { name: 'Dados e privacidade' })).not.toBeInTheDocument()

      mockUseAuth.mockReturnValue(authValue('OWNER'))
      renderWithProviders()
      expect(screen.getByRole('heading', { name: 'Dados e privacidade' })).toBeInTheDocument()
    } finally {
      apiMocks.restore()
    }
  })

  it('exports data by downloading a JSON blob', async () => {
    const user = userEvent.setup()
    mockUseAuth.mockReturnValue(authValue('OWNER'))
    const getMock = vi.fn().mockResolvedValue({ data: { establishment: { id: 42 }, users: [], products: [], orders: [], sales: [] } })
    const restoreGet = replaceProperty(api, 'get', getMock as typeof api.get)

    try {
      renderWithProviders()
      await user.click(screen.getByRole('button', { name: 'Exportar meus dados' }))
      await waitFor(() => expect(getMock).toHaveBeenCalledWith('/auth/export-data'))
    } finally {
      restoreGet()
    }
  })

  it('requires the password and calls delete-account on confirm', async () => {
    const user = userEvent.setup()
    mockUseAuth.mockReturnValue(authValue('OWNER'))
    const postMock = vi.fn().mockResolvedValue({ data: { message: 'ok' } })
    const getMock = vi.fn().mockResolvedValue({ data: { id: 42, category: null } })
    const restoreGet = replaceProperty(api, 'get', getMock as typeof api.get)
    const restorePost = replaceProperty(api, 'post', postMock as typeof api.post)

    try {
      renderWithProviders()
      await user.click(screen.getByRole('button', { name: 'Excluir minha conta' }))

      const confirmButton = screen.getByRole('button', { name: 'Excluir permanentemente' })
      expect(confirmButton).toBeDisabled()

      await user.type(screen.getByLabelText('Senha atual'), 'senha123')
      expect(confirmButton).not.toBeDisabled()

      await user.click(confirmButton)
      await waitFor(() => expect(postMock).toHaveBeenCalledWith('/auth/delete-account', { password: 'senha123' }))
    } finally {
      restoreGet()
      restorePost()
    }
  })
})
