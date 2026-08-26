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

describe('print preferences', () => {
  test('falls back to 80mm when nothing is stored', async () => {
    const prefs = await import('./printPreferences')
    expect(prefs.getStoredPaperWidth(makeStorage())).toBe('80mm')
  })

  test('reads a valid stored preset', async () => {
    const prefs = await import('./printPreferences')
    const storage = makeStorage({ 'tozzo.printerWidth': '58mm' })
    expect(prefs.getStoredPaperWidth(storage)).toBe('58mm')
  })

  test('falls back to 80mm for a corrupted/unknown value', async () => {
    const prefs = await import('./printPreferences')
    const storage = makeStorage({ 'tozzo.printerWidth': 'not-a-preset' })
    expect(prefs.getStoredPaperWidth(storage)).toBe('80mm')
  })

  test('persists a valid preset and returns it', async () => {
    const prefs = await import('./printPreferences')
    const storage = makeStorage()
    expect(prefs.persistPaperWidth('110mm', storage)).toBe('110mm')
    expect(storage.getItem('tozzo.printerWidth')).toBe('110mm')
  })

  test('persisting an invalid value falls back to 80mm', async () => {
    const prefs = await import('./printPreferences')
    const storage = makeStorage()
    expect(prefs.persistPaperWidth('bogus', storage)).toBe('80mm')
    expect(storage.getItem('tozzo.printerWidth')).toBe('80mm')
  })

  test('PAPER_WIDTH_PRESETS has exactly the six supported presets', async () => {
    const prefs = await import('./printPreferences')
    expect(prefs.PAPER_WIDTH_PRESETS).toEqual(['44mm', '58mm', '76mm', '80mm', '110mm', 'a4'])
  })
})
