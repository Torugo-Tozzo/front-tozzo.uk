import type { EstablishmentCategory } from '@/api/establishment'
import { CATEGORY_SEEDS, type EstablishmentCategory as LegacyCategory } from '@/lib/categorySeeds'

/** The categories of the /v1, in the order the React picker shows them. */
export const ESTABLISHMENT_CATEGORIES: readonly EstablishmentCategory[] = [
  'BURGER_SHOP', 'PIZZERIA', 'ICE_CREAM_SHOP', 'COFFEE_SHOP', 'SNACK_BAR', 'OTHER',
]

// The translation keys (settings.category.options.*) and the seeds keep the
// React app's (Bun) names; the /v1 speaks English.
const LEGACY_NAME: Record<EstablishmentCategory, LegacyCategory> = {
  BURGER_SHOP: 'HAMBURGUERIA',
  PIZZERIA: 'PIZZARIA',
  ICE_CREAM_SHOP: 'SORVETERIA',
  COFFEE_SHOP: 'CAFETERIA',
  SNACK_BAR: 'LANCHONETE',
  OTHER: 'OUTRO',
}

export const isEstablishmentCategory = (value: unknown): value is EstablishmentCategory =>
  typeof value === 'string' && (ESTABLISHMENT_CATEGORIES as readonly string[]).includes(value)

/** Key under settings.category.options. */
export const categoryLabelKey = (category: EstablishmentCategory) => `category.options.${LEGACY_NAME[category]}`

/** The product types suggested for a category (same texts as the React app). */
export const categorySeeds = (category: EstablishmentCategory): string[] => [...CATEGORY_SEEDS[LEGACY_NAME[category]]]

/** Plan names of the /v1 → keys under settings.plan.tiers (the React app's names). */
export const PLAN_TIER_KEY = {
  FREE: 'FREE',
  PAID: 'PAGO',
  LEGACY_PAID: 'PAGO_LEGADO',
  ENTERPRISE: 'ENTERPRISE',
} as const
