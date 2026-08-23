import { describe, it, expect } from 'bun:test'
import { maskCentsInput } from './currency'

describe('maskCentsInput', () => {
  it('treats typed digits as cents', () => {
    expect(maskCentsInput('600')).toBe('6.00')
    expect(maskCentsInput('12345')).toBe('123.45')
  })

  it('strips non-digit characters before masking', () => {
    expect(maskCentsInput('R$ 6,00')).toBe('6.00')
  })

  it('returns 0.00 for empty input', () => {
    expect(maskCentsInput('')).toBe('0.00')
  })
})
