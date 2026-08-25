export const SUPPORTED_LOCALES = ['en', 'pt-BR', 'es', 'fr', 'zh', 'hi'] as const

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]

export const DEFAULT_LOCALE: SupportedLocale = 'en'
export const LOCALE_STORAGE_KEY = 'tozzo.locale'

export type LocaleStorage = Pick<Storage, 'getItem' | 'setItem'>
export type BrowserLocaleInput = string | readonly string[] | undefined

const localeByTag = new Map<string, SupportedLocale>([
  ['en', 'en'],
  ['pt', 'pt-BR'],
  ['pt-br', 'pt-BR'],
  ['es', 'es'],
  ['fr', 'fr'],
  ['zh', 'zh'],
  ['hi', 'hi'],
])

function defaultStorage(): LocaleStorage | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    return window.localStorage
  } catch {
    return undefined
  }
}

function defaultBrowserLocale(): readonly string[] {
  if (typeof navigator === 'undefined') return []
  if (Array.isArray(navigator.languages) && navigator.languages.length > 0) {
    return navigator.languages
  }
  return navigator.language ? [navigator.language] : []
}

function matchSupportedLocale(value: unknown): SupportedLocale | undefined {
  const raw = String(value ?? '').trim().replace(/_/g, '-').toLowerCase()
  if (!raw) return undefined

  return localeByTag.get(raw) ?? localeByTag.get(raw.split('-')[0])
}

export function normalizeLocale(value: unknown): SupportedLocale {
  return matchSupportedLocale(value) ?? DEFAULT_LOCALE
}

export function getStoredLocale(storage: LocaleStorage | undefined = defaultStorage()): SupportedLocale {
  try {
    return normalizeLocale(storage?.getItem(LOCALE_STORAGE_KEY))
  } catch {
    return DEFAULT_LOCALE
  }
}

export function getInitialLocale(
  storage: LocaleStorage | undefined = defaultStorage(),
  browserLocale: BrowserLocaleInput = defaultBrowserLocale(),
): SupportedLocale {
  let stored: string | null = null
  try {
    stored = storage?.getItem(LOCALE_STORAGE_KEY) ?? null
  } catch {
    stored = null
  }

  const storedLocale = matchSupportedLocale(stored)
  if (storedLocale) return storedLocale

  const browserLocales = Array.isArray(browserLocale) ? browserLocale : [browserLocale]
  for (const candidate of browserLocales) {
    const locale = matchSupportedLocale(candidate)
    if (locale) return locale
  }

  return DEFAULT_LOCALE
}

export function persistLocale(
  value: unknown,
  storage: LocaleStorage | undefined = defaultStorage(),
): SupportedLocale {
  const locale = normalizeLocale(value)
  try {
    storage?.setItem(LOCALE_STORAGE_KEY, locale)
  } catch {
    // Locale preference is best-effort; an unavailable storage must not break the UI.
  }
  return locale
}
