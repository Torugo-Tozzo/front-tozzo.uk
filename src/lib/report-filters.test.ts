import { expect, it } from 'vitest'
import { reportFilters, reportDay, reportDays } from './report-filters'
it('converts local date/time to inclusive instants and omits all-types', () => {
  expect(reportFilters('2026-10-01', '00:00', '2026-10-01', '23:59', '0')).toEqual({ from: new Date('2026-10-01T00:00:00').toISOString(), to: new Date('2026-10-01T23:59:59').toISOString() })
  expect(reportFilters('', '', '', '', 't1')).toEqual({ productTypeId: 't1' })
})
it('navigates calendar dates across month/year boundaries without UTC date shifts', () => {
  expect(reportDay('2026-12-31', 1)).toBe('2027-01-01')
  expect(reportDays('2026-10-31', '2026-11-02')).toBe(2)
  expect(reportDays('', '')).toBe(0)
})
