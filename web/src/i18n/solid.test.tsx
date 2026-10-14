import { render, screen, waitFor } from '@solidjs/testing-library'
import { beforeEach, describe, expect, test } from 'vitest'

import { i18n } from './config'
import { I18nProvider, useTranslation } from './solid'

function LocaleProbe() {
  const { t, language } = useTranslation('settings')

  return (
    <>
      <output data-testid="active-locale">{language()}</output>
      <p>{t('title')}</p>
    </>
  )
}

describe('I18nProvider', () => {
  beforeEach(async () => {
    localStorage.clear()
    await i18n.changeLanguage('en')
  })

  test('updates rendered translations, document language, and storage immediately', async () => {
    render(() => (
      <I18nProvider>
        <LocaleProbe />
      </I18nProvider>
    ))

    expect(screen.getByTestId('active-locale')).toHaveTextContent('en')
    expect(screen.getByText('Settings')).toBeInTheDocument()

    await i18n.changeLanguage('pt-BR')

    expect(screen.getByTestId('active-locale')).toHaveTextContent('pt-BR')
    expect(screen.getByText('Configurações')).toBeInTheDocument()
    expect(localStorage.getItem('tozzo.locale')).toBe('pt-BR')
    await waitFor(() => expect(document.documentElement.lang).toBe('pt-BR'))
  })
})
