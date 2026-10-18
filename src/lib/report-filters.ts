import type { ReportFilters } from '@/api/reports'

export function reportFilters(start: string, startTime: string, end: string, endTime: string, type: string): ReportFilters {
  return {
    ...(start && startTime ? { from: new Date(`${start}T${startTime}:00`).toISOString() } : {}),
    ...(end && endTime ? { to: new Date(`${end}T${endTime}:59`).toISOString() } : {}),
    ...(type && type !== '0' ? { productTypeId: type } : {}),
  }
}
export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
export function reportDay(start: string, offset: number): string {
  const date = new Date(`${start}T12:00:00`)
  date.setDate(date.getDate() + offset)
  return localDate(date)
}
export function reportDays(start: string, end: string): number {
  const days = Math.round((Date.parse(`${end}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) / 86_400_000)
  return Number.isFinite(days) ? Math.max(0, days) : 0
}
