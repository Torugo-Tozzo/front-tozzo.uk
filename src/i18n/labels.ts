import i18n from './config'
import { normalizeLocale, SUPPORTED_LOCALES, type SupportedLocale } from './locale'
import { NAMESPACES } from './resources'

export type LabelLocale = SupportedLocale | string | undefined

const STATUS_LABEL_KEYS: Record<string, string> = {
  REQUESTED: 'status.requested',
  IN_PREPARATION: 'status.inPreparation',
  DELIVERED: 'status.delivered',
}

const CATALOG_LABEL_KEYS: Record<string, string> = {
  BURGER: 'catalog.burger',
  ARTISANAL_BURGER: 'catalog.artisanalBurger',
  ARTISANALBURGER: 'catalog.artisanalBurger',
  CHICKEN: 'catalog.chicken',
  HOTDOG: 'catalog.hotDog',
  HOT_DOG: 'catalog.hotDog',
  FOOD: 'catalog.food',
  DRINK: 'catalog.drink',
  DRINKS: 'catalog.drink',
  FRIES: 'catalog.fries',
  EXTRA: 'catalog.extra',
  PIZZA: 'catalog.pizza',
  SUSHI: 'catalog.sushi',
  DESSERT: 'catalog.dessert',
  DESSERTS: 'catalog.dessert',
  SIDE: 'catalog.side',
  SIDES: 'catalog.side',
  OTHER: 'catalog.other',
  DEFAULT: 'catalog.defaultType',
  DEFAULT_TYPE: 'catalog.defaultType',
  DEFAULT_CATALOG_TYPE: 'catalog.defaultType',
}

const NUMERIC_CATALOG_LABEL_KEYS: Record<string, string> = {
  '1': 'catalog.burger',
  '2': 'catalog.artisanalBurger',
  '3': 'catalog.chicken',
  '4': 'catalog.hotDog',
  '5': 'catalog.drink',
  '6': 'catalog.fries',
  '7': 'catalog.extra',
  '8': 'catalog.other',
  '9': 'catalog.pizza',
  '10': 'catalog.sushi',
}

function translate(key: string, locale?: LabelLocale): string {
  const [namespaceName, ...keySegments] = key.split('.')
  const namespace = namespaceName as (typeof NAMESPACES)[number]
  return i18n.getFixedT(normalizeLocale(locale ?? i18n.language), namespace)(keySegments.join('.') as never)
}

function normalizeCode(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/[\s-]+/g, '_')
    .toUpperCase()
}

export function getStatusLabel(value: unknown, locale?: LabelLocale): string {
  const key = STATUS_LABEL_KEYS[normalizeCode(value)]
  return key ? translate(key, locale) : String(value ?? '')
}

function isLocaleTag(value: string): value is SupportedLocale {
  return SUPPORTED_LOCALES.includes(value as SupportedLocale)
}

function resolveCatalogKey(id: unknown): string | undefined {
  const normalizedId = normalizeCode(id)
  return CATALOG_LABEL_KEYS[normalizedId]
    ?? NUMERIC_CATALOG_LABEL_KEYS[String(id ?? '').trim()]
}

export function getCatalogLabel(
  id: unknown,
  fallbackOrLocale?: string,
  locale?: LabelLocale,
): string {
  const useSecondArgumentAsLocale = locale === undefined && isLocaleTag(fallbackOrLocale ?? '')
  const fallback = useSecondArgumentAsLocale ? undefined : fallbackOrLocale
  const requestedLocale = useSecondArgumentAsLocale ? fallbackOrLocale : locale
  const key = resolveCatalogKey(id)

  if (key) return translate(key, requestedLocale)
  return fallback ?? String(id ?? '')
}
