import { describe, it, expect, beforeEach } from 'bun:test'
import { render, screen, act } from '@testing-library/react'
import { I18nProvider } from '@/i18n/provider'
import { i18n } from '@/i18n/config'
import { MemoryRouter } from 'react-router-dom'
import PrivacyPolicyPage from './PrivacyPolicyPage'

describe('PrivacyPolicyPage', () => {
  beforeEach(async () => {
    await act(async () => {
      await i18n.changeLanguage('en')
    })
  })

  it('renders the privacy policy heading and draft notice', () => {
    render(
      <MemoryRouter>
        <I18nProvider>
          <PrivacyPolicyPage />
        </I18nProvider>
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'Privacy Policy' })).toBeInTheDocument()
    expect(screen.getByText(/has not yet been reviewed by a lawyer/i)).toBeInTheDocument()
  })
})
