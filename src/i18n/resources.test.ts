import { describe, expect, test } from 'bun:test'
import { resources, type I18nResource } from './resources'

type Assert<T extends true> = T
type IsString<T> = T extends string ? true : false

export type CommonAccessibilityLeafIsString = Assert<
  IsString<typeof resources.en.common.accessibility.linkedin>
>
export type CommonLandingLeafIsString = Assert<
  IsString<typeof resources.en.common.landing.features.kitchen.description>
>
export type NestedCommonResourceIsAccepted = Assert<
  { accessibility: { linkedin: string } } extends I18nResource ? true : false
>
export type NumericResourceLeavesAreRejected = Assert<
  { value: number } extends I18nResource ? false : true
>

const expectedLocales = ['en', 'pt-BR', 'es', 'fr', 'zh', 'hi', 'ar'] as const
const expectedNamespaces = [
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

describe('local i18n resources', () => {
  test('contains the closed locale set and exactly the required namespaces', async () => {
    const module = await import('./resources').catch(() => null)

    expect(module).not.toBeNull()
    if (!module) return

    expect(Object.keys(module.resources)).toEqual([...expectedLocales])
    for (const locale of expectedLocales) {
      expect(Object.keys(module.resources[locale])).toEqual([...expectedNamespaces])
      for (const namespace of expectedNamespaces) {
        expect(Object.keys(module.resources[locale][namespace])).not.toHaveLength(0)
      }
    }
  })
})
