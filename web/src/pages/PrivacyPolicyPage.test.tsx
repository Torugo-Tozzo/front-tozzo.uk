import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@solidjs/testing-library'
import { I18nProvider } from '@/i18n/solid'
import { i18n } from '@/i18n/config'
import { MemoryRouter, Route } from '@solidjs/router'
import PrivacyPolicyPage from './PrivacyPolicyPage'

describe('PrivacyPolicyPage', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
  })

  it('renders the privacy policy heading and draft notice', () => {
    render(() => (
      <MemoryRouter>
        <I18nProvider>
          <Route path="/" component={PrivacyPolicyPage} />
        </I18nProvider>
      </MemoryRouter>
    ))

    expect(screen.getByRole('heading', { name: 'Privacy Policy' })).toBeInTheDocument()
    expect(screen.getByText(/has not yet been reviewed by a lawyer/i)).toBeInTheDocument()
  })
})
