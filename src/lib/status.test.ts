import { describe, it, expect, beforeEach } from 'bun:test'
import { i18n } from '@/i18n/config'
import { getStatusLabel } from './status'

describe('status', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
  })

  it('maps each order item status through the requested locale', () => {
    expect(getStatusLabel('REQUESTED', 'en')).toBe('Requested')
    expect(getStatusLabel('IN_PREPARATION', 'en')).toBe('In preparation')
    expect(getStatusLabel('DELIVERED', 'en')).toBe('Delivered')
    expect(getStatusLabel('REQUESTED', 'pt-BR')).toBe('Solicitado')
    expect(getStatusLabel('DELIVERED', 'pt-BR')).toBe('Entregue')
  })

  it('falls back to the raw string for an unknown status label', () => {
    expect(getStatusLabel('UNKNOWN')).toBe('UNKNOWN')
  })
})
