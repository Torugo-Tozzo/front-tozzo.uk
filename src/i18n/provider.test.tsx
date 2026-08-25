import { act, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test } from 'bun:test'
import { useTranslation } from 'react-i18next'

import { i18n } from './config'
import { I18nProvider } from './provider'

function LocaleProbe() {
  const { i18n: activeI18n, t } = useTranslation('settings')

  return (
    <>
      <output data-testid="active-locale">{activeI18n.language}</output>
      <p>{t('title')}</p>
    </>
  )
}

describe('I18nProvider', () => {
  beforeEach(async () => {
    localStorage.clear()
    await act(async () => {
      await i18n.changeLanguage('en')
    })
  })

  test('updates rendered translations, document language, and storage immediately', async () => {
    render(
      <I18nProvider>
        <LocaleProbe />
      </I18nProvider>,
    )

    expect(screen.getByTestId('active-locale')).toHaveTextContent('en')
    expect(screen.getByText('Settings')).toBeInTheDocument()

    await act(async () => {
      await i18n.changeLanguage('pt-BR')
    })

    expect(screen.getByTestId('active-locale')).toHaveTextContent('pt-BR')
    expect(screen.getByText('Configurações')).toBeInTheDocument()
    expect(localStorage.getItem('tozzo.locale')).toBe('pt-BR')
    await waitFor(() => expect(document.documentElement.lang).toBe('pt-BR'))
  })
})
