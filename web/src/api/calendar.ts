import { api } from './client'
import { unwrap } from './errors'
import type { components } from './schema'
import type { BusinessHour, CalendarRecord } from '@/pages/dashboard/calendarEvents'

type Schema = components['schemas']
export type CalendarFilter = { from: string; to: string; userIds?: string }
export type ShiftBody = Omit<Schema['CalendarShiftBody'], 'repeatUntil'> & { repeatUntil?: string | null }
export type EventBody = Omit<CalendarRecord, 'id' | 'employee'>
export const calendarKeys = { all: ['calendar'] as const, hours: ['calendar', 'hours'] as const, range: (filter: CalendarFilter | null) => ['calendar', 'range', filter] as const }

/** Normalize nullable Go slices once, before UI and FullCalendar consume them. */
export async function getCalendar(filter: CalendarFilter, signal?: AbortSignal) {
  const view = unwrap(await api.GET('/v1/calendar', { params: { query: filter }, signal }))
  return { events: view.events ?? [], shifts: (view.shifts ?? []).map(shift => ({ ...shift, assignments: shift.assignments ?? [] })), employees: view.employees ?? [] }
}
export async function getBusinessHours(signal?: AbortSignal): Promise<BusinessHour[]> {
  return (unwrap(await api.GET('/v1/business-hours', { signal })).hours ?? []).map(hour => ({ ...hour, daysOfWeek: hour.daysOfWeek ?? [] }))
}
export async function saveBusinessHours(hours: BusinessHour[]): Promise<BusinessHour[]> {
  return (unwrap(await api.PUT('/v1/business-hours', { body: { hours } })).hours ?? []).map(hour => ({ ...hour, daysOfWeek: hour.daysOfWeek ?? [] }))
}
const shiftBody = (body: ShiftBody): Schema['CalendarShiftBody'] => ({ ...body, repeatUntil: body.repeatUntil || undefined })
export async function createShift(body: ShiftBody) { return unwrap(await api.POST('/v1/calendar/shifts', { body: shiftBody(body) })) }
export async function updateShift(id: string, body: ShiftBody) { return unwrap(await api.PUT('/v1/calendar/shifts/{id}', { params: { path: { id } }, body: shiftBody(body) })) }
export async function deleteShift(id: string) { return unwrap(await api.DELETE('/v1/calendar/shifts/{id}', { params: { path: { id } } })) }
const eventBody = (body: EventBody): Schema['CalendarEventBody'] => ({ ...body, employeeId: body.employeeId || undefined, title: body.title ?? undefined, repeatUntil: body.repeatUntil || undefined })
export async function createEvent(body: EventBody) { return unwrap(await api.POST('/v1/calendar/events', { body: eventBody(body) })) }
export async function updateEvent(id: string, body: EventBody) { return unwrap(await api.PUT('/v1/calendar/events/{id}', { params: { path: { id } }, body: eventBody(body) })) }
export async function deleteEvent(id: string) { return unwrap(await api.DELETE('/v1/calendar/events/{id}', { params: { path: { id } } })) }
