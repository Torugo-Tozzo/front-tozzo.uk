import { describe, expect, test } from 'bun:test'

type MemoryStorage = {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

function makeStorage(initial: Record<string, string> = {}): MemoryStorage {
  const values = new Map(Object.entries(initial))
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  }
}

describe('locale foundation', () => {
  test('normalizes supported exact and regional locale values to the closed set', async () => {
    const locale = await import('./locale').catch(() => null)

    expect(locale).not.toBeNull()
    if (!locale) return

    expect(locale.normalizeLocale('pt_BR')).toBe('pt-BR')
    expect(locale.normalizeLocale('PT-br')).toBe('pt-BR')
    expect(locale.normalizeLocale('fr-CA')).toBe('fr')
    expect(locale.normalizeLocale('zh-CN')).toBe('zh')
    expect(locale.normalizeLocale('ar-SA')).toBe('ar')
    expect(locale.normalizeLocale('xx')).toBe('en')
    expect(locale.normalizeLocale(undefined)).toBe('en')
  })

  test('reads and persists only normalized supported locales', async () => {
    const locale = await import('./locale').catch(() => null)
    const storage = makeStorage({ 'tozzo.locale': 'es-MX' })

    expect(locale).not.toBeNull()
    if (!locale) return

    expect(locale.getInitialLocale(storage)).toBe('es')
    expect(locale.persistLocale('AR-eg', storage)).toBe('ar')
    expect(storage.getItem('tozzo.locale')).toBe('ar')
  })

  test('checks browser language preferences in order before falling back to English', async () => {
    const locale = await import('./locale').catch(() => null)

    expect(locale).not.toBeNull()
    if (!locale) return

    expect(locale.getInitialLocale(makeStorage(), ['xx-YY', 'ar-SA'])).toBe('ar')
    expect(locale.getInitialLocale(makeStorage(), ['fr-CA', 'pt-BR'])).toBe('fr')
  })

  test('does not let storage read or write errors break locale selection', async () => {
    const locale = await import('./locale').catch(() => null)
    const throwingStorage = {
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
    }

    expect(locale).not.toBeNull()
    if (!locale) return

    expect(locale.getInitialLocale(throwingStorage, ['xx', 'hi-IN'])).toBe('hi')
    expect(locale.persistLocale('pt-BR', throwingStorage)).toBe('pt-BR')
  })

  test('uses navigator.languages before navigator.language when no preference is stored', async () => {
    const locale = await import('./locale').catch(() => null)
    const previousStored = localStorage.getItem('tozzo.locale')
    const previousLanguages = navigator.languages
    const previousLanguage = navigator.language

    expect(locale).not.toBeNull()
    if (!locale) return

    localStorage.removeItem('tozzo.locale')
    Object.defineProperty(navigator, 'languages', {
      configurable: true,
      value: ['xx-YY', 'ar-SA'],
    })
    Object.defineProperty(navigator, 'language', {
      configurable: true,
      value: 'en-US',
    })

    try {
      expect(locale.getInitialLocale()).toBe('ar')
    } finally {
      if (previousStored === null) localStorage.removeItem('tozzo.locale')
      else localStorage.setItem('tozzo.locale', previousStored)
      Object.defineProperty(navigator, 'languages', {
        configurable: true,
        value: previousLanguages,
      })
      Object.defineProperty(navigator, 'language', {
        configurable: true,
        value: previousLanguage,
      })
    }
  })

  test('exposes direction metadata without changing the supported locale set', async () => {
    const locale = await import('./locale').catch(() => null)

    expect(locale).not.toBeNull()
    if (!locale) return

    expect(locale.getLocaleDirection('ar')).toBe('rtl')
    expect(locale.getLocaleDirection('pt-BR')).toBe('ltr')
  })
})
