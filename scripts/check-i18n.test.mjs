import { describe, expect, test } from 'bun:test'

const checkerPromise = import('./check-i18n.mjs').catch(() => null)

describe('i18n bundle checker', () => {
  test('reports a missing leaf instead of accepting fallback completion', async () => {
    const checker = await checkerPromise
    const resources = {
      en: { common: { greeting: 'Hello', save: 'Save' } },
      'pt-BR': { common: { greeting: 'Olá' } },
    }

    expect(checker).not.toBeNull()
    if (!checker) return

    expect(checker.checkBundles(resources)).toEqual([
      {
        type: 'missing-key',
        locale: 'pt-BR',
        namespace: 'common',
        key: 'save',
      },
    ])
  })

  test('reports placeholder incompatibility and extra leaves with their location', async () => {
    const checker = await checkerPromise
    const resources = {
      en: { common: { greeting: 'Hello {{name}}', save: 'Save' } },
      'pt-BR': {
        common: { greeting: 'Olá {{customer}}', save: 'Salvar', extra: 'Extra' },
      },
    }

    expect(checker).not.toBeNull()
    if (!checker) return

    expect(checker.checkBundles(resources)).toEqual([
      {
        type: 'extra-key',
        locale: 'pt-BR',
        namespace: 'common',
        key: 'extra',
      },
      {
        type: 'placeholder-mismatch',
        locale: 'pt-BR',
        namespace: 'common',
        key: 'greeting',
        expected: ['name'],
        received: ['customer'],
      },
    ])
  })
})
