import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@/components/theme-provider'
import SettingsPage from './SettingsPage'

function renderWithTheme() {
  return render(
    <ThemeProvider>
      <SettingsPage />
    </ThemeProvider>
  )
}

describe('SettingsPage', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('light', 'dark')
  })

  it('renders the page heading and appearance section', () => {
    renderWithTheme()
    expect(screen.getByText('Configurações')).toBeInTheDocument()
    expect(screen.getByText('Tema do sistema')).toBeInTheDocument()
  })

  it('toggles the theme when the mode button is clicked', async () => {
    const user = userEvent.setup()
    renderWithTheme()

    // system theme resolves to "light" (matchMedia mocked to matches: false)
    expect(document.documentElement.classList.contains('light')).toBe(true)

    await user.click(screen.getByRole('button', { name: /toggle theme/i }))

    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(localStorage.getItem('vite-ui-theme')).toBe('dark')
  })
})
