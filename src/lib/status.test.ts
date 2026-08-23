import { describe, it, expect } from 'bun:test'
import { STATUS_OPTIONS, getStatusColor, getStatusLabel } from './status'

describe('status', () => {
  it('lists all 4 order statuses in workflow order', () => {
    expect(STATUS_OPTIONS.map((o) => o.value)).toEqual([
      'ABERTO', 'EM_PREPARO', 'ENTREGANDO', 'FECHADO',
    ])
  })

  it('maps each status to its approved hex color', () => {
    expect(getStatusColor('ABERTO')).toBe('#dc2626')
    expect(getStatusColor('EM_PREPARO')).toBe('#d97706')
    expect(getStatusColor('ENTREGANDO')).toBe('#2563eb')
    expect(getStatusColor('FECHADO')).toBe('#6b7280')
  })

  it('falls back to the FECHADO color for an unknown status', () => {
    expect(getStatusColor('QUALQUER_COISA')).toBe('#6b7280')
  })

  it('maps each status to its Portuguese label', () => {
    expect(getStatusLabel('EM_PREPARO')).toBe('Em Preparo')
  })

  it('falls back to the raw string for an unknown status label', () => {
    expect(getStatusLabel('X')).toBe('X')
  })
})
