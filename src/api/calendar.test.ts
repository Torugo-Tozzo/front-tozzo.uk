import { afterEach, expect, test, vi } from 'vitest'
import { createShift, getCalendar, getBusinessHours, updateEvent } from './calendar'

afterEach(() => vi.unstubAllGlobals())
function backend(body: unknown, status = 200) {
  const requests: Request[] = []
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push(input instanceof Request ? input : new Request(input, init))
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': status >= 400 ? 'application/problem+json' : 'application/json' } })
  }))
  return requests
}

test('normalizes nullable slices from Go and sends the visible range/filter', async () => {
  const requests = backend({ events: null, shifts: [{ id: 's1', assignments: null }], employees: null })
  const result = await getCalendar({ from: '2026-10-01', to: '2026-10-08', userIds: 'ana' })
  expect(result).toEqual({ events: [], shifts: [{ id: 's1', assignments: [] }], employees: [] })
  expect(new URL(requests[0].url).pathname).toBe('/v1/calendar')
  expect(new URL(requests[0].url).searchParams.get('userIds')).toBe('ana')
  backend({ hours: [{ daysOfWeek: null, startTime: '11:00', endTime: '23:00' }] })
  expect(await getBusinessHours()).toEqual([{ daysOfWeek: [], startTime: '11:00', endTime: '23:00' }])
})

test('serializes calendar fields with the generated v1 optional contract', async () => {
  const requests = backend({ id: 's1' }, 201)
  await createShift({ title: 'Noite', startDate: '2026-10-01', endDate: '2026-10-02', startTime: '18:00', endTime: '01:00', repeatWeekly: true, repeatUntil: null, members: [{ employeeId: 'ana' }] })
  expect(new URL(requests[0].url).pathname).toBe('/v1/calendar/shifts')
  expect(await requests[0].json()).toEqual({ title: 'Noite', startDate: '2026-10-01', endDate: '2026-10-02', startTime: '18:00', endTime: '01:00', repeatWeekly: true, members: [{ employeeId: 'ana' }] })
})

test('preserves the problem code on a refused event update', async () => {
  const requests = backend({ code: 'CALENDAR_CONFLICT', status: 409, title: 'Conflict' }, 409)
  await expect(updateEvent('e1', { type: 'SPECIAL', title: 'Feriado', employeeId: null, startDate: '2026-10-01', endDate: '2026-10-02', startTime: '00:00', endTime: '00:00', repeatWeekly: false, repeatUntil: null })).rejects.toMatchObject({ code: 'CALENDAR_CONFLICT', status: 409 })
  expect(new URL(requests[0].url).pathname).toBe('/v1/calendar/events/e1')
  expect(await requests[0].json()).not.toHaveProperty('employeeId')
})
