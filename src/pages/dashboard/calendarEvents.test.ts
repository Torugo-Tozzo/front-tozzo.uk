import { expect, test } from 'bun:test'
import { getCalendarSlotRange, getVisibleShiftMembers, replaceBusinessHoursDay, toCalendarEvents, toCalendarShiftEvents, toFullCalendarBusinessHours } from './calendarEvents'

test('weekly shift repeats through the selected final date', () => {
  const events = toCalendarEvents([{ id: 'shift-1', type: 'SHIFT', employeeId: 'u-1', employee: { id: 'u-1', name: 'Ana' }, title: null, startDate: '2026-09-24', startTime: '11:00', endDate: '2026-09-24', endTime: '19:00', repeatWeekly: true, repeatUntil: '2026-10-01' }], { 'u-1': '#2563eb' })
  expect(events[0]).toMatchObject({ id: 'shift-1', title: 'Ana', daysOfWeek: [4], startRecur: '2026-09-24', endRecur: '2026-10-02', startTime: '11:00', endTime: '19:00', backgroundColor: '#2563eb' })
})

test('special day shades the grid and has a visible label', () => {
  const events = toCalendarEvents([{ id: 'special-1', type: 'SPECIAL', employeeId: null, employee: null, title: 'Feriado', startDate: '2026-09-24', startTime: '00:00', endDate: '2026-09-25', endTime: '00:00', repeatWeekly: false, repeatUntil: null }], {})
  expect(events).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'special-1:background', display: 'background' }), expect.objectContaining({ id: 'special-1', title: 'Feriado' })]))
})

test('overnight opening time extends into the next day', () => {
  expect(toFullCalendarBusinessHours([{ daysOfWeek: [6], startTime: '12:00', endTime: '01:00' }])).toEqual([{ daysOfWeek: [6], startTime: '12:00', endTime: '25:00' }])
})

test('time grid covers the earliest opening through an overnight closing', () => {
  expect(getCalendarSlotRange([
    { daysOfWeek: [1, 2, 3, 4, 5], startTime: '11:00', endTime: '23:00' },
    { daysOfWeek: [6], startTime: '12:00', endTime: '01:00' },
  ])).toEqual({ slotMinTime: '00:00', slotMaxTime: '24:00' })
  expect(getCalendarSlotRange([])).toEqual({ slotMinTime: '08:00', slotMaxTime: '23:00' })
})

test('time grid includes staff shifts before opening and after closing', () => {
  const hours = [{ daysOfWeek: [1, 2, 3, 4, 5], startTime: '11:00', endTime: '23:00' }]
  const records = [{ id: 'legacy', type: 'SHIFT' as const, employeeId: 'u-1', employee: null, title: null, startDate: '2026-09-24', startTime: '07:00', endDate: '2026-09-24', endTime: '10:00', repeatWeekly: false, repeatUntil: null }]
  const shifts = [{ id: 'group', title: null, startDate: '2026-09-24', startTime: '22:00', endDate: '2026-09-25', endTime: '01:00', repeatWeekly: false, repeatUntil: null, assignments: [{ id: 'a-1', employeeId: 'u-2', employee: null, startDate: '2026-09-24', startTime: '22:00', endDate: '2026-09-25', endTime: '01:00' }] }]
  expect(getCalendarSlotRange(hours, records, shifts)).toEqual({ slotMinTime: '00:00', slotMaxTime: '24:00' })
})

test('a shift ending at midnight does not add a second day to the grid', () => {
  const shifts = [{ id: 'group', title: null, startDate: '2026-09-24', startTime: '18:00', endDate: '2026-09-25', endTime: '00:00', repeatWeekly: false, repeatUntil: null, assignments: [] }]
  expect(getCalendarSlotRange([], [], shifts)).toEqual({ slotMinTime: '18:00', slotMaxTime: '24:00' })
})

test('editing one day preserves other days from a grouped schedule', () => {
  const hours = [{ daysOfWeek: [1, 2, 3, 4, 5], startTime: '11:00', endTime: '23:00' }]
  expect(replaceBusinessHoursDay(hours, 1, { daysOfWeek: [1], startTime: '12:00', endTime: '23:00' })).toEqual([
    { daysOfWeek: [2, 3, 4, 5], startTime: '11:00', endTime: '23:00' },
    { daysOfWeek: [1], startTime: '12:00', endTime: '23:00' },
  ])
})

test('renders one recurring calendar block for a shift with multiple employees', () => {
  const shift = { id: 'group-1', title: 'Noite', startDate: '2026-09-24', startTime: '18:00', endDate: '2026-09-25', endTime: '01:00', repeatWeekly: true, repeatUntil: null, assignments: [
    { id: 'a-1', employeeId: 'u-1', employee: { id: 'u-1', name: 'Ana' }, startDate: '2026-09-24', startTime: '18:00', endDate: '2026-09-25', endTime: '01:00' },
    { id: 'a-2', employeeId: 'u-2', employee: { id: 'u-2', name: 'Bia' }, startDate: '2026-09-24', startTime: '17:00', endDate: '2026-09-24', endTime: '20:00' },
  ] }
  expect(toCalendarShiftEvents([shift], 'Turno')).toEqual([expect.objectContaining({ id: 'group-1', title: 'Noite (2)', daysOfWeek: [4], startTime: '18:00', endTime: '25:00' })])
})

test('a person leaving exactly when a shift begins is not listed in that shift', () => {
  const shift = { startDate: '2026-09-24', startTime: '18:00', endDate: '2026-09-24', endTime: '23:00' }
  const member = (endTime: string) => ({ id: endTime, employeeId: endTime, employee: { id: endTime, name: endTime }, startDate: '2026-09-24', startTime: '17:00', endDate: '2026-09-24', endTime })
  expect(getVisibleShiftMembers({ ...shift, id: 'group', title: null, repeatWeekly: false, repeatUntil: null, assignments: [member('18:00'), member('18:01'), member('18:02')] }).map(value => value.id)).toEqual(['18:02'])
})
