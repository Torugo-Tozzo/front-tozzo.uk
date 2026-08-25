import { beforeEach, describe, expect, test } from 'bun:test'

import { i18n } from './config'
import {
  formatCurrencyBRL,
  formatDate,
  formatNumber,
  formatPlural,
  getActiveLocale,
} from './format'
import { getCatalogLabel, getStatusLabel } from './labels'

describe('active-locale helpers', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
  })

  test('formats BRL, numbers, and dates with the active locale', async () => {
    await i18n.changeLanguage('pt-BR')

    expect(getActiveLocale()).toBe('pt-BR')
    expect(formatCurrencyBRL(1234.5)).toContain('1.234,50')
    expect(formatNumber(1234.5)).toBe('1.234,5')
    expect(formatDate('2024-01-02T03:04:05.000Z', undefined, {
      timeZone: 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })).toBe('02/01/2024')
  })

  test('selects plural messages using the active locale rules', async () => {
    await i18n.changeLanguage('en')

    expect(formatPlural(1, { one: 'item', other: 'items' })).toBe('item')
    expect(formatPlural(2, { one: 'item', other: 'items' })).toBe('items')
  })

  test('translates stable status and catalog IDs while preserving custom labels', async () => {
    await i18n.changeLanguage('en')
    expect(getStatusLabel('IN_PREPARATION')).toBe('In preparation')
    expect(getCatalogLabel('FOOD')).toBe('Food')

    await i18n.changeLanguage('pt-BR')
    expect(getStatusLabel('OPEN')).toBe('Aberto')
    expect(getCatalogLabel('DRINK')).toBe('Bebidas')
    expect(getCatalogLabel('CUSTOM_TYPE', 'Feijoada')).toBe('Feijoada')
  })
})
