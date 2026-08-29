import { describe, it, expect, beforeEach } from 'bun:test'
import { render, screen, act } from '@testing-library/react'
import { I18nProvider } from '@/i18n/provider'
import { i18n } from '@/i18n/config'
import { MemoryRouter } from 'react-router-dom'
import TermsOfUsePage from './TermsOfUsePage'

describe('TermsOfUsePage', () => {
  beforeEach(async () => {
    await act(async () => {
      await i18n.changeLanguage('en')
    })
  })

  it('renders the terms heading and draft notice', () => {
    render(
      <MemoryRouter>
        <I18nProvider>
          <TermsOfUsePage />
        </I18nProvider>
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'Terms of Use' })).toBeInTheDocument()
    expect(screen.getByText(/has not yet been reviewed by a lawyer/i)).toBeInTheDocument()
  })
})
