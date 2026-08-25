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

  test('reports empty and TODO-style translation leaves', async () => {
    const checker = await checkerPromise
    const resources = {
      en: { common: { empty: '', todo: 'TODO', ok: 'Hello' } },
      'pt-BR': { common: { empty: '   ', todo: 'PLACEHOLDER', ok: 'Olá' } },
    }

    expect(checker).not.toBeNull()
    if (!checker) return

    const invalidValues = checker.checkBundles(resources)
      .filter((issue) => issue.type === 'invalid-value')
      .map(({ locale, key, reason }) => ({ locale, key, reason }))

    expect(invalidValues).toEqual([
      { locale: 'en', key: 'empty', reason: 'empty' },
      { locale: 'en', key: 'todo', reason: 'placeholder' },
      { locale: 'pt-BR', key: 'empty', reason: 'empty' },
      { locale: 'pt-BR', key: 'todo', reason: 'placeholder' },
    ])
  })
})
