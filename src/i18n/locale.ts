export const SUPPORTED_LOCALES = ['en', 'pt-BR', 'es', 'fr', 'zh', 'hi', 'ar'] as const

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]

export const DEFAULT_LOCALE: SupportedLocale = 'en'
export const LOCALE_STORAGE_KEY = 'tozzo.locale'

export type LocaleStorage = Pick<Storage, 'getItem' | 'setItem'>

const localeByTag = new Map<string, SupportedLocale>([
  ['en', 'en'],
  ['pt', 'pt-BR'],
  ['pt-br', 'pt-BR'],
  ['es', 'es'],
  ['fr', 'fr'],
  ['zh', 'zh'],
  ['hi', 'hi'],
  ['ar', 'ar'],
])

function defaultStorage(): LocaleStorage | undefined {
  return typeof window === 'undefined' ? undefined : window.localStorage
}

function defaultBrowserLocale(): string | undefined {
  return typeof navigator === 'undefined' ? undefined : navigator.language
}

export function normalizeLocale(value: unknown): SupportedLocale {
  const raw = String(value ?? '').trim().replace(/_/g, '-').toLowerCase()
  if (!raw) return DEFAULT_LOCALE

  const exact = localeByTag.get(raw)
  if (exact) return exact

  return localeByTag.get(raw.split('-')[0]) ?? DEFAULT_LOCALE
}

export function getStoredLocale(storage: LocaleStorage | undefined = defaultStorage()): SupportedLocale {
  return normalizeLocale(storage?.getItem(LOCALE_STORAGE_KEY))
}

export function getInitialLocale(
  storage: LocaleStorage | undefined = defaultStorage(),
  browserLocale: string | undefined = defaultBrowserLocale(),
): SupportedLocale {
  const stored = storage?.getItem(LOCALE_STORAGE_KEY)
  return normalizeLocale(stored || browserLocale)
}

export function persistLocale(
  value: unknown,
  storage: LocaleStorage | undefined = defaultStorage(),
): SupportedLocale {
  const locale = normalizeLocale(value)
  storage?.setItem(LOCALE_STORAGE_KEY, locale)
  return locale
}
