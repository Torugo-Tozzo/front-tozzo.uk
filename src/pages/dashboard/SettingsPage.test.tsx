import { describe, it, expect, beforeEach } from 'bun:test'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@/components/theme-provider'
import { I18nProvider } from '@/i18n/provider'
import { i18n } from '@/i18n/config'
import SettingsPage from './SettingsPage'

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
    await act(async () => {
      await i18n.changeLanguage('pt-BR')
    })
  })

  it('renders the page heading and appearance section', () => {
    renderWithProviders()
    expect(screen.getByText('Configurações')).toBeInTheDocument()
    expect(screen.getByText('Sistema')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Idioma atual' })).toHaveValue('pt-BR')
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

    await user.selectOptions(screen.getByRole('combobox', { name: 'Idioma atual' }), 'es')

    expect(screen.getByRole('heading', { name: 'Configuración' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Idioma: Español')
    expect(localStorage.getItem('tozzo.locale')).toBe('es')
  })
})
