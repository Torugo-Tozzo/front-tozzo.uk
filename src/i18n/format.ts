import i18n from './config'
import { normalizeLocale, type SupportedLocale } from './locale'

export type LocaleInput = SupportedLocale | string | undefined

type NumberOptions = Intl.NumberFormatOptions
type DateOptions = Intl.DateTimeFormatOptions
type PluralCategory = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other'

export type PluralMessages = Partial<Record<PluralCategory, string>> & {
  other: string
}

function activeLocale(): SupportedLocale {
  return normalizeLocale(i18n.language)
}

function resolveLocale(value?: LocaleInput): SupportedLocale {
  return normalizeLocale(value ?? i18n.language)
}

export function getActiveLocale(): SupportedLocale {
  return activeLocale()
}

export function formatNumber(
  value: number,
  localeOrOptions?: LocaleInput | NumberOptions,
  options?: NumberOptions,
): string {
  const locale = typeof localeOrOptions === 'string'
    ? resolveLocale(localeOrOptions)
    : activeLocale()
  const numberOptions = typeof localeOrOptions === 'object'
    ? localeOrOptions
    : options

  return new Intl.NumberFormat(locale, numberOptions).format(value)
}

export function formatCurrencyBRL(
  value: number,
  localeOrOptions?: LocaleInput | NumberOptions,
  options?: NumberOptions,
): string {
  const locale = typeof localeOrOptions === 'string'
    ? resolveLocale(localeOrOptions)
    : activeLocale()
  const numberOptions = typeof localeOrOptions === 'object'
    ? localeOrOptions
    : options

  return new Intl.NumberFormat(locale, {
    ...numberOptions,
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export const formatCurrency = formatCurrencyBRL
export const formatBRL = formatCurrencyBRL

function resolveDateArguments(
  localeOrOptions?: LocaleInput | DateOptions,
  optionsOrLocale?: DateOptions | LocaleInput,
): { locale: SupportedLocale; options?: DateOptions } {
  if (typeof localeOrOptions === 'string') {
    return {
      locale: resolveLocale(localeOrOptions),
      options: typeof optionsOrLocale === 'object' ? optionsOrLocale : undefined,
    }
  }

  return {
    locale: typeof optionsOrLocale === 'string' ? resolveLocale(optionsOrLocale) : activeLocale(),
    options: localeOrOptions,
  }
}

function parseDate(value: Date | number | string): Date | null {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatDate(
  value: Date | number | string,
  localeOrOptions?: LocaleInput | DateOptions,
  optionsOrLocale?: DateOptions | LocaleInput,
): string {
  const { locale, options } = resolveDateArguments(localeOrOptions, optionsOrLocale)
  const date = parseDate(value)
  if (!date) return ''

  return new Intl.DateTimeFormat(locale, options ?? {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function formatDateTime(
  value: Date | number | string,
  localeOrOptions?: LocaleInput | DateOptions,
  optionsOrLocale?: DateOptions | LocaleInput,
): string {
  const { locale, options } = resolveDateArguments(localeOrOptions, optionsOrLocale)
  const date = parseDate(value)
  if (!date) return ''

  return new Intl.DateTimeFormat(locale, options ?? {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date)
}

export function formatTime(
  value: Date | number | string,
  localeOrOptions?: LocaleInput | DateOptions,
  optionsOrLocale?: DateOptions | LocaleInput,
): string {
  const { locale, options } = resolveDateArguments(localeOrOptions, optionsOrLocale)
  const date = parseDate(value)
  if (!date) return ''

  return new Intl.DateTimeFormat(locale, options ?? {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function getPluralCategory(count: number, locale?: LocaleInput): PluralCategory {
  return new Intl.PluralRules(resolveLocale(locale)).select(count) as PluralCategory
}

export function formatPlural(
  count: number,
  messages: PluralMessages,
  locale?: LocaleInput,
): string {
  return messages[getPluralCategory(count, locale)] ?? messages.other
}
