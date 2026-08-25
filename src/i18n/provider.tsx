import type { PropsWithChildren } from 'react'
import { useEffect } from 'react'
import { I18nextProvider, useTranslation } from 'react-i18next'

import i18n from './config'
import { getLocaleDirection, normalizeLocale } from './locale'

function DocumentLocaleMetadata({ children }: PropsWithChildren) {
  const { i18n: activeI18n } = useTranslation()
  const locale = normalizeLocale(activeI18n.language)

  useEffect(() => {
    if (typeof document === 'undefined') return

    document.documentElement.lang = locale
    document.documentElement.dataset.locale = locale
    document.documentElement.dataset.localeDirection = getLocaleDirection(locale)
    // T8 owns the actual RTL layout switch; this metadata keeps the provider
    // direction-ready without changing the current layout.
  }, [locale])

  return <>{children}</>
}

export function I18nProvider({ children }: PropsWithChildren) {
  return (
    <I18nextProvider i18n={i18n}>
      <DocumentLocaleMetadata>{children}</DocumentLocaleMetadata>
    </I18nextProvider>
  )
}
