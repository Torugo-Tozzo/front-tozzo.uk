import { createEffect, createSignal, type JSX } from 'solid-js'
import type { Namespace, TFunction } from 'i18next'

import i18n from './config'
import { normalizeLocale } from './locale'

// The active language as a signal: every t() call reads it, so any JSX
// expression or memo that translates re-runs when the language changes.
const [language, setLanguage] = createSignal(i18n.language)
i18n.on('languageChanged', (locale) => setLanguage(locale))

export { language }

export function useTranslation<Ns extends Namespace = 'common'>(namespace?: Ns) {
  const fixed = () => i18n.getFixedT(language(), namespace ?? 'common')
  const t = ((...args: unknown[]) => (fixed() as unknown as (...inner: unknown[]) => string)(...args)) as unknown as TFunction<Ns>
  return { t, i18n, language }
}

export function I18nProvider(props: { children?: JSX.Element }) {
  createEffect(() => {
    const locale = normalizeLocale(language())
    document.documentElement.lang = locale
    document.documentElement.dataset.locale = locale
  })
  return props.children
}
