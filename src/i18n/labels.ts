import i18n from './config'
import { normalizeLocale, SUPPORTED_LOCALES, type SupportedLocale } from './locale'
import { NAMESPACES } from './resources'

export type LabelLocale = SupportedLocale | string | undefined

const STATUS_LABEL_KEYS: Record<string, string> = {
  OPEN: 'status.open',
  IN_PREPARATION: 'status.inPreparation',
  DELIVERING: 'status.delivering',
  CLOSED: 'status.closed',
  NOT_CLOSED: 'status.notClosed',
}

const CATALOG_LABEL_KEYS: Record<string, string> = {
  FOOD: 'catalog.food',
  DRINK: 'catalog.drink',
  DRINKS: 'catalog.drink',
  DESSERT: 'catalog.dessert',
  DESSERTS: 'catalog.dessert',
  SIDE: 'catalog.side',
  SIDES: 'catalog.side',
  OTHER: 'catalog.other',
  DEFAULT: 'catalog.defaultType',
  DEFAULT_TYPE: 'catalog.defaultType',
  DEFAULT_CATALOG_TYPE: 'catalog.defaultType',
}

function translate(key: string, locale?: LabelLocale): string {
  const [namespaceName, ...keySegments] = key.split('.')
  const namespace = namespaceName as (typeof NAMESPACES)[number]
  return i18n.getFixedT(normalizeLocale(locale ?? i18n.language), namespace)(keySegments.join('.') as never)
}

function normalizeCode(value: unknown): string {
  return String(value ?? '').trim().replace(/[\s-]+/g, '_').toUpperCase()
}

export function getStatusLabel(value: unknown, locale?: LabelLocale): string {
  const key = STATUS_LABEL_KEYS[normalizeCode(value)]
  return key ? translate(key, locale) : String(value ?? '')
}

function isLocaleTag(value: string): value is SupportedLocale {
  return SUPPORTED_LOCALES.includes(value as SupportedLocale)
}

export function getCatalogLabel(
  id: unknown,
  fallbackOrLocale?: string,
  locale?: LabelLocale,
): string {
  const useSecondArgumentAsLocale = locale === undefined && isLocaleTag(fallbackOrLocale ?? '')
  const fallback = useSecondArgumentAsLocale ? undefined : fallbackOrLocale
  const requestedLocale = useSecondArgumentAsLocale ? fallbackOrLocale : locale
  const key = CATALOG_LABEL_KEYS[normalizeCode(id)]

  if (key) return translate(key, requestedLocale)
  return fallback ?? String(id ?? '')
}
