import type { EventInput } from '@fullcalendar/core'

export type CalendarRecord = {
  id: string
  type: 'SHIFT' | 'SPECIAL'
  employeeId: string | null
  employee: { id: string; name: string } | null
  title: string | null
  startDate: string
  startTime: string
  endDate: string
  endTime: string
  repeatWeekly: boolean
  repeatUntil: string | null
}

export type BusinessHour = { daysOfWeek: number[]; startTime: string; endTime: string }
export type ShiftAssignment = { id: string; employeeId: string; employee: { id: string; name: string } | null; startDate: string; startTime: string; endDate: string; endTime: string }
export type CalendarShift = { id: string; title: string | null; startDate: string; startTime: string; endDate: string; endTime: string; repeatWeekly: boolean; repeatUntil: string | null; assignments: ShiftAssignment[] }

export function replaceBusinessHoursDay(hours: BusinessHour[], day: number, value: BusinessHour | null): BusinessHour[] {
  const remaining = hours.flatMap(hour => {
    const daysOfWeek = hour.daysOfWeek.filter(current => current !== day)
    return daysOfWeek.length ? [{ ...hour, daysOfWeek }] : []
  })
  return value ? [...remaining, value] : remaining
}

function nextDay(date: string) {
  const value = new Date(`${date}T12:00:00.000Z`)
  value.setUTCDate(value.getUTCDate() + 1)
  return value.toISOString().slice(0, 10)
}

function moveDate(date: string, days: number) {
  const value = new Date(`${date}T12:00:00.000Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

function extendedEndTime(record: { startDate: string; endDate: string; endTime: string }) {
  const days = Math.round((Date.parse(record.endDate) - Date.parse(record.startDate)) / 86_400_000)
  const [hour, minute] = record.endTime.split(':').map(Number)
  return `${String(hour + days * 24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

const moment = (date: string, time: string) => Date.parse(`${date}T${time}:00.000Z`)

export function getVisibleShiftMembers(shift: CalendarShift): ShiftAssignment[] {
  return shift.assignments.filter(member => Math.min(moment(shift.endDate, shift.endTime), moment(member.endDate, member.endTime)) - Math.max(moment(shift.startDate, shift.startTime), moment(member.startDate, member.startTime)) > 60_000)
}

export function getShiftOccurrence(shift: CalendarShift, occurrenceDate: string | null): CalendarShift {
  if (!shift.repeatWeekly || !occurrenceDate) return shift
  const days = Math.round((Date.parse(occurrenceDate) - Date.parse(shift.startDate)) / 86_400_000)
  if (!Number.isFinite(days) || days === 0) return shift
  return { ...shift, startDate: moveDate(shift.startDate, days), endDate: moveDate(shift.endDate, days), assignments: shift.assignments.map(member => ({ ...member, startDate: moveDate(member.startDate, days), endDate: moveDate(member.endDate, days) })) }
}

export function toCalendarShiftEvents(shifts: CalendarShift[], defaultTitle: string): EventInput[] {
  return shifts.map(shift => {
    const base = { id: shift.id, title: `${shift.title || defaultTitle} (${getVisibleShiftMembers(shift).length})`, backgroundColor: '#4f46e5', borderColor: '#4f46e5', extendedProps: { shiftId: shift.id } }
    if (!shift.repeatWeekly) return { ...base, start: `${shift.startDate}T${shift.startTime}`, end: `${shift.endDate}T${shift.endTime}` }
    return { ...base, daysOfWeek: [new Date(`${shift.startDate}T12:00:00`).getDay()], startRecur: shift.startDate, endRecur: shift.repeatUntil ? nextDay(shift.repeatUntil) : undefined, startTime: shift.startTime, endTime: extendedEndTime(shift) }
  })
}

export function toCalendarEvents(records: CalendarRecord[], colors: Record<string, string>): EventInput[] {
  return records.flatMap<EventInput>(record => {
    const start = `${record.startDate}T${record.startTime}`
    const end = `${record.endDate}T${record.endTime}`
    if (record.type === 'SPECIAL') return [
      { id: `${record.id}:background`, start, end, display: 'background', backgroundColor: '#f59e0b', extendedProps: { recordId: record.id } },
      { id: record.id, title: record.title ?? '', start, end, allDay: record.startTime === '00:00' && record.endTime === '00:00', backgroundColor: '#b45309', borderColor: '#b45309', extendedProps: { recordId: record.id } },
    ]
    const color = colors[record.employeeId ?? ''] ?? '#2563eb'
    const base = { id: record.id, title: record.employee?.name ?? '', backgroundColor: color, borderColor: color, extendedProps: { recordId: record.id } }
    if (!record.repeatWeekly) return [{ ...base, start, end }]
    return [{ ...base, daysOfWeek: [new Date(`${record.startDate}T12:00:00`).getDay()], startRecur: record.startDate, endRecur: record.repeatUntil ? nextDay(record.repeatUntil) : undefined, startTime: record.startTime, endTime: extendedEndTime(record) }]
  })
}

export function toFullCalendarBusinessHours(hours: BusinessHour[]): BusinessHour[] {
  return hours.map(hour => {
    if (hour.endTime > hour.startTime) return hour
    const [endHour, minute] = hour.endTime.split(':').map(Number)
    return { ...hour, endTime: `${String(endHour + 24).padStart(2, '0')}:${String(minute).padStart(2, '0')}` }
  })
}

export function getCalendarSlotRange(hours: BusinessHour[], records: CalendarRecord[] = [], shifts: CalendarShift[] = []) {
  const normalized = toFullCalendarBusinessHours(hours)
  const intervals = [
    ...normalized.map(hour => ({ startDate: '2026-01-01', startTime: hour.startTime, endDate: '2026-01-01', endTime: hour.endTime })),
    ...records.filter(record => record.type === 'SHIFT'),
    ...shifts.flatMap(shift => [shift, ...getVisibleShiftMembers(shift)]),
  ]
  if (!intervals.length) return { slotMinTime: '08:00', slotMaxTime: '23:00' }
  const toMinutes = (time: string) => { const [hour, minute] = time.split(':').map(Number); return hour * 60 + minute }
  const earliest = Math.min(...intervals.map(entry => toMinutes(entry.startTime)))
  const latest = Math.max(...intervals.map(entry => toMinutes(entry.endTime) + Math.round((Date.parse(entry.endDate) - Date.parse(entry.startDate)) / 86_400_000) * 1440))
  // FullCalendar repeats the clock after 24:00. Show overnight tails at the
  // start of the following day instead of extending every day's time axis.
  const crossesMidnight = latest > 1440
  const start = crossesMidnight ? 0 : earliest
  const end = Math.min(latest, 1440)
  const format = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
  return {
    slotMinTime: format(start),
    slotMaxTime: format(end),
  }
}
