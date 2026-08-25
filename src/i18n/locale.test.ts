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
})
