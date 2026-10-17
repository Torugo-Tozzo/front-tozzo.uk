import { formatCurrencyBRL, type LocaleInput } from '@/i18n/format'

// The /v1 sends and takes money as integer cents (…Cents). These helpers are
// the only place that turns cents into reais, for display and for the price
// inputs, so a component never divides by 100.

/** Numeric display units for renderers that plot money and counts on one scale. */
export function amountFromCents(cents: number): number {
  return cents / 100
}

/** Formats integer cents as BRL in the given locale. */
export function formatCents(cents: number, locale?: LocaleInput): string {
  return formatCurrencyBRL(amountFromCents(cents), locale)
}

/**
 * The price inputs of the React app: every keystroke keeps only the digits and
 * reads them as cents ("1250" → "12.50"). Returns the integer cents.
 */
export function centsFromInput(value: string): number {
  const digits = value.replace(/\D/g, '')
  return digits ? Number.parseInt(digits, 10) : 0
}

/** The text a price input shows for `cents` (two decimals, dot separator, like the React app). */
export function inputFromCents(cents: number): string {
  return (cents / 100).toFixed(2)
}
