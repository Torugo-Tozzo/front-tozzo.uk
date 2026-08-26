export const PAPER_WIDTH_PRESETS = ['44mm', '58mm', '76mm', '80mm', '110mm', 'a4'] as const

export type PaperWidthPreset = (typeof PAPER_WIDTH_PRESETS)[number]

export const DEFAULT_PAPER_WIDTH: PaperWidthPreset = '80mm'
export const PAPER_WIDTH_STORAGE_KEY = 'tozzo.printerWidth'

export type PrintPreferenceStorage = Pick<Storage, 'getItem' | 'setItem'>

function isValidPreset(value: unknown): value is PaperWidthPreset {
  return typeof value === 'string' && (PAPER_WIDTH_PRESETS as readonly string[]).includes(value)
}

function defaultStorage(): PrintPreferenceStorage | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    return window.localStorage
  } catch {
    return undefined
  }
}

export function getStoredPaperWidth(
  storage: PrintPreferenceStorage | undefined = defaultStorage(),
): PaperWidthPreset {
  try {
    const stored = storage?.getItem(PAPER_WIDTH_STORAGE_KEY)
    return isValidPreset(stored) ? stored : DEFAULT_PAPER_WIDTH
  } catch {
    return DEFAULT_PAPER_WIDTH
  }
}

export function persistPaperWidth(
  value: unknown,
  storage: PrintPreferenceStorage | undefined = defaultStorage(),
): PaperWidthPreset {
  const preset = isValidPreset(value) ? value : DEFAULT_PAPER_WIDTH
  try {
    storage?.setItem(PAPER_WIDTH_STORAGE_KEY, preset)
  } catch {
    // Preference is best-effort; an unavailable storage must not break the UI.
  }
  return preset
}
