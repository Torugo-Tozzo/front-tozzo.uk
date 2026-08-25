import type { SupportedLocale } from './locale'
import en from './locales/en.json'
import ptBR from './locales/pt-BR.json'
import es from './locales/es.json'
import fr from './locales/fr.json'
import zh from './locales/zh.json'
import hi from './locales/hi.json'
import ar from './locales/ar.json'

export const NAMESPACES = [
  'common',
  'auth',
  'navigation',
  'orders',
  'sales',
  'products',
  'employees',
  'charts',
  'settings',
  'sync',
  'printer',
  'status',
  'errors',
  'catalog',
] as const

export type I18nResource = {
  [key: string]: string | I18nResource
}

export const resources = {
  en,
  'pt-BR': ptBR,
  es,
  fr,
  zh,
  hi,
  ar,
} as const satisfies Record<SupportedLocale, Record<(typeof NAMESPACES)[number], I18nResource>>

export type I18nResources = typeof resources
