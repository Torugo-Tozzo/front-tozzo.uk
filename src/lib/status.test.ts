import { describe, it, expect } from 'bun:test'
import { STATUS_OPTIONS, getStatusColor, getStatusLabel } from './status'

describe('status', () => {
  it('lists all 4 order statuses in workflow order', () => {
    expect(STATUS_OPTIONS.map((o) => o.value)).toEqual([
      'OPEN', 'IN_PREPARATION', 'DELIVERING', 'CLOSED',
    ])
  })

  it('maps each status to its approved hex color', () => {
    expect(getStatusColor('OPEN')).toBe('#dc2626')
    expect(getStatusColor('IN_PREPARATION')).toBe('#d97706')
    expect(getStatusColor('DELIVERING')).toBe('#2563eb')
    expect(getStatusColor('CLOSED')).toBe('#6b7280')
  })

  it('keeps the unknown fallback safe', () => {
    expect(getStatusColor('UNKNOWN')).toBe('#6b7280')
  })

  it('maps each status to its Portuguese label', () => {
    expect(getStatusLabel('IN_PREPARATION')).toBe('Em Preparo')
  })

  it('falls back to the raw string for an unknown status label', () => {
    expect(getStatusLabel('UNKNOWN')).toBe('UNKNOWN')
  })
})
