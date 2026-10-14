import { describe, expect, it } from 'vitest'

import { centsFromInput, formatCents, inputFromCents } from './money'

describe('money helpers', () => {
  it('formats cents as BRL', () => {
    expect(formatCents(2490, 'pt-BR')).toBe('R$ 24,90')
    expect(formatCents(0, 'en')).toBe('R$0.00')
  })

  it('reads a price input as cents, keeping only the digits', () => {
    expect(centsFromInput('1250')).toBe(1250)
    expect(centsFromInput('12.50')).toBe(1250)
    expect(centsFromInput('0.005')).toBe(5)
    expect(centsFromInput('')).toBe(0)
    expect(centsFromInput('abc')).toBe(0)
  })

  it('shows cents the way the React price input did', () => {
    expect(inputFromCents(1250)).toBe('12.50')
    expect(inputFromCents(5)).toBe('0.05')
    expect(inputFromCents(centsFromInput('500'))).toBe('5.00')
  })
})
