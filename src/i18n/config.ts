import i18next, { type BackendModule, type ResourceKey } from 'i18next'
import {
  DEFAULT_LOCALE,
  getInitialLocale,
  persistLocale,
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from './locale'
import { NAMESPACES } from './namespaces'

// Each locale is its own chunk, loaded when it becomes active (the six of them
// are ~85 KB gzip). The keys and texts are the React app's, unchanged.
const bundles = import.meta.glob<{ default: Record<string, ResourceKey> }>('./locales/*.json')

export function loadLocaleBundle(locale: SupportedLocale) {
  const load = bundles[`./locales/${locale}.json`]
  if (!load) return Promise.reject(new Error(`Unknown locale: ${locale}`))
  return load().then((module) => module.default)
}

const lazyLocales: BackendModule = {
  type: 'backend',
  init() {},
  read(language, namespace, callback) {
    loadLocaleBundle(language as SupportedLocale)
      .then((bundle) => callback(null, bundle[namespace]))
      .catch((error: Error) => callback(error, null))
  },
}

const initialLocale = getInitialLocale()
persistLocale(initialLocale)

/** Resolves once the active locale is loaded; the app renders after it. */
export const i18nReady = i18next.use(lazyLocales).init({
  lng: initialLocale,
  fallbackLng: DEFAULT_LOCALE,
  supportedLngs: [...SUPPORTED_LOCALES],
  ns: [...NAMESPACES],
  defaultNS: 'common',
  nsSeparator: '.',
  interpolation: {
    escapeValue: false,
  },
  returnNull: false,
})

i18next.on('languageChanged', (locale) => {
  persistLocale(locale)
})

export const i18n = i18next
export default i18n
