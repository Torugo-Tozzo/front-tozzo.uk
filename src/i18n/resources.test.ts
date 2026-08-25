import { describe, expect, test } from 'bun:test'

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
