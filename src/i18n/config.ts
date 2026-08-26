import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import {
  DEFAULT_LOCALE,
  getInitialLocale,
  persistLocale,
  SUPPORTED_LOCALES,
} from './locale'
import { NAMESPACES, resources } from './resources'

const initialLocale = getInitialLocale()
persistLocale(initialLocale)

i18next.use(initReactI18next).init({
  resources,
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
