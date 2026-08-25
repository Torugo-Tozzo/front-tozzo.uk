import { beforeEach, describe, expect, test } from 'bun:test'

import { i18n } from './config'
import {
  formatCurrencyBRL,
  formatCount,
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

  test('formats localized count messages with Arabic plural categories and digits', async () => {
    await i18n.changeLanguage('ar')

    const messages = {
      zero: '{{count}} zero',
      one: '{{count}} one',
      two: '{{count}} two',
      few: '{{count}} few',
      many: '{{count}} many',
      other: '{{count}} other',
    }

    expect(formatCount(0, messages)).toBe(`${formatNumber(0, 'ar')} zero`)
    expect(formatCount(2, messages)).toBe(`${formatNumber(2, 'ar')} two`)
    expect(formatCount(3, messages)).toBe(`${formatNumber(3, 'ar')} few`)
    expect(formatCount(11, messages)).toBe(`${formatNumber(11, 'ar')} many`)
  })

  test('keeps the undefined-locale date overload options and timezone observable', async () => {
    await i18n.changeLanguage('en')

    const value = '2024-01-02T00:30:00.000Z'
    const utc = formatDate(value, undefined, {
      timeZone: 'UTC',
      weekday: 'long',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    const saoPaulo = formatDate(value, undefined, {
      timeZone: 'America/Sao_Paulo',
      weekday: 'long',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })

    expect(utc).toContain('Tuesday')
    expect(utc).toContain('01/02/2024')
    expect(saoPaulo).toContain('Monday')
    expect(saoPaulo).toContain('01/01/2024')
  })

  test('translates stable status and catalog IDs while preserving custom labels', async () => {
    await i18n.changeLanguage('en')
    expect(getStatusLabel('IN_PREPARATION')).toBe('In preparation')
    expect(getCatalogLabel('FOOD')).toBe('Food')
    expect(getCatalogLabel(1, 'Hambúrguer')).toBe('Burger')
    expect(getCatalogLabel(10, 'Sushi')).toBe('Sushi')
    expect(getCatalogLabel(23, 'Açaí')).toBe('Açaí')

    await i18n.changeLanguage('pt-BR')
    expect(getStatusLabel('OPEN')).toBe('Aberto')
    expect(getCatalogLabel('DRINK')).toBe('Bebidas')
    expect(getCatalogLabel(5, 'Bebida')).toBe('Bebidas')
    expect(getCatalogLabel(99, 'Bebida')).toBe('Bebida')
    expect(getCatalogLabel('CUSTOM_TYPE', 'Feijoada')).toBe('Feijoada')
  })
})
