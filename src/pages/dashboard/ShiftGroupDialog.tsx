import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '@/services/api'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { BusinessHour, CalendarShift } from './calendarEvents'

type Employee = { id: string; name: string }
type Interval = { startDate: string; startTime: string; endDate: string; endTime: string }
type MemberDraft = Interval & { employeeId: string; custom: boolean }
type ShiftDraft = Interval & { title: string; repeatWeekly: boolean; repeatUntil: string; members: MemberDraft[] }
const nextDay = (date: string) => { const value = new Date(`${date}T12:00:00.000Z`); value.setUTCDate(value.getUTCDate() + 1); return value.toISOString().slice(0, 10) }
const shiftDate = (date: string, offset: number) => { if (!date || !Number.isFinite(offset)) return date; const value = new Date(`${date}T12:00:00.000Z`); value.setUTCDate(value.getUTCDate() + offset); return value.toISOString().slice(0, 10) }
const movedEndDate = (newStart: string, oldStart: string, oldEnd: string) => {
  if (!newStart) return ''
  const offset = Math.round((Date.parse(oldEnd) - Date.parse(oldStart)) / 86_400_000)
  return shiftDate(newStart, offset)
}
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase()
const interval = (value: Interval): Interval => ({ startDate: value.startDate, startTime: value.startTime, endDate: value.endDate, endTime: value.endTime })

function initialDraft(initial: CalendarShift | null, date: string, hours: BusinessHour[], employeeIds: string[]): ShiftDraft {
  if (initial) return { ...interval(initial), title: initial.title ?? '', repeatWeekly: initial.repeatWeekly, repeatUntil: initial.repeatUntil ?? '', members: initial.assignments.map(member => ({ ...interval(member), employeeId: member.employeeId, custom: Object.keys(interval(initial)).some(key => member[key as keyof Interval] !== initial[key as keyof Interval]) })) }
  const day = new Date(`${date}T12:00:00`).getDay()
  const opening = hours.find(hour => hour.daysOfWeek.includes(day))
  const startTime = opening?.startTime ?? '11:00'
  const endTime = opening?.endTime ?? '19:00'
  const base = { startDate: date, startTime, endDate: endTime <= startTime ? nextDay(date) : date, endTime }
  return { ...base, title: '', repeatWeekly: false, repeatUntil: '', members: employeeIds.map(employeeId => ({ employeeId, ...base, custom: false })) }
}

export default function ShiftGroupDialog({ initial, defaultDate, hours, employees, initialEmployeeIds, onClose, onSaved }: { initial: CalendarShift | null; defaultDate: string; hours: BusinessHour[]; employees: Employee[]; initialEmployeeIds: string[]; onClose: () => void; onSaved: () => void | Promise<void> }) {
  const { t } = useTranslation('calendar')
  const { t: common } = useTranslation('common')
  const [form, setForm] = useState<ShiftDraft>(() => initialDraft(initial, defaultDate, hours, initialEmployeeIds))
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const visible = employees.filter(employee => normalize(employee.name).includes(normalize(query)))
  const updateInterval = (changes: Partial<Interval>) => setForm(previous => {
    const next = { ...previous, ...changes }
    const dayOffset = changes.startDate && previous.startDate ? Math.round((Date.parse(changes.startDate) - Date.parse(previous.startDate)) / 86_400_000) : 0
    return { ...next, members: previous.members.map(member => member.custom ? { ...member, startDate: shiftDate(member.startDate, dayOffset), endDate: shiftDate(member.endDate, dayOffset) } : { ...member, ...interval(next) }) }
  })
  const updateMember = (employeeId: string, changes: Partial<MemberDraft>) => setForm(previous => ({ ...previous, members: previous.members.map(member => member.employeeId === employeeId ? { ...member, ...changes } : member) }))
  const toggleEmployee = (employeeId: string) => setForm(previous => ({ ...previous, members: previous.members.some(member => member.employeeId === employeeId) ? previous.members.filter(member => member.employeeId !== employeeId) : [...previous.members, { employeeId, ...interval(previous), custom: false }] }))
  const payload = () => ({ title: form.title.trim(), ...interval(form), repeatWeekly: form.repeatWeekly, repeatUntil: form.repeatWeekly ? form.repeatUntil || null : null, members: form.members.map(member => member.custom ? { employeeId: member.employeeId, ...interval(member) } : { employeeId: member.employeeId }) })
  const save = async () => {
    if (busy || !form.members.length) return
    setBusy(true); setError('')
    try {
      if (initial) await api.put(`/calendar/shifts/${initial.id}`, payload())
      else await api.post('/calendar/shifts', payload())
      await onSaved(); onClose()
    } catch { setError(t('shiftSaveError')) }
    finally { setBusy(false) }
  }
  const remove = async () => {
    if (!initial || busy || !window.confirm(t('deleteShiftConfirm'))) return
    setBusy(true); setError('')
    try { await api.delete(`/calendar/shifts/${initial.id}`); await onSaved(); onClose() }
    catch { setError(t('shiftDeleteError')) }
    finally { setBusy(false) }
  }

  return <Dialog open onOpenChange={next => { if (!next && !busy) onClose() }}><DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>{initial ? t('editShift') : t('newShift')}</DialogTitle><DialogDescription>{t('shiftMembersHelp')}</DialogDescription></DialogHeader>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="space-y-4"><div className="space-y-1"><Label htmlFor="shift-title">{t('shiftTitle')}</Label><Input id="shift-title" value={form.title} maxLength={120} onChange={event => setForm(previous => ({ ...previous, title: event.target.value }))} /></div>
      <div className="grid grid-cols-2 gap-3"><div className="space-y-1"><Label htmlFor="shift-start-date">{t('startDate')}</Label><Input id="shift-start-date" type="date" value={form.startDate} onChange={event => updateInterval({ startDate: event.target.value, endDate: movedEndDate(event.target.value, form.startDate, form.endDate) })} /></div><div className="space-y-1"><Label htmlFor="shift-start-time">{t('start')}</Label><Input id="shift-start-time" type="time" value={form.startTime} onChange={event => updateInterval({ startTime: event.target.value })} /></div><div className="space-y-1"><Label htmlFor="shift-end-date">{t('endDate')}</Label><Input id="shift-end-date" type="date" value={form.endDate} onChange={event => updateInterval({ endDate: event.target.value })} /></div><div className="space-y-1"><Label htmlFor="shift-end-time">{t('end')}</Label><Input id="shift-end-time" type="time" value={form.endTime} onChange={event => updateInterval({ endTime: event.target.value })} /></div></div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.repeatWeekly} onChange={event => setForm(previous => ({ ...previous, repeatWeekly: event.target.checked }))} />{t('repeatWeekly')}</label>
      {form.repeatWeekly && <div className="space-y-1"><Label htmlFor="shift-repeat-until">{t('repeatUntil')}</Label><Input id="shift-repeat-until" type="date" min={form.startDate} value={form.repeatUntil} onChange={event => setForm(previous => ({ ...previous, repeatUntil: event.target.value }))} /><p className="text-xs text-muted-foreground">{t('repeatUntilHelp')}</p></div>}
      <div className="space-y-2"><Label htmlFor="shift-employee-search">{t('employeesInShift')}</Label><Input id="shift-employee-search" placeholder={t('searchEmployee')} value={query} onChange={event => setQuery(event.target.value)} /><div className="max-h-36 space-y-1 overflow-y-auto rounded-md border p-2">{visible.length ? visible.map(employee => <label key={employee.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent"><input type="checkbox" checked={form.members.some(member => member.employeeId === employee.id)} onChange={() => toggleEmployee(employee.id)} />{employee.name}</label>) : <p className="p-2 text-sm text-muted-foreground">{t('noEmployeesFound')}</p>}</div></div>
      {form.members.map(member => { const employee = employees.find(value => value.id === member.employeeId); if (!employee) return null; return <div key={member.employeeId} className="rounded-md border p-3"><label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={member.custom} onChange={event => updateMember(member.employeeId, event.target.checked ? { custom: true } : { custom: false, ...interval(form) })} />{t('customMemberHours', { name: employee.name })}</label>{member.custom ? <div className="mt-3 grid grid-cols-2 gap-2"><Input aria-label={t('memberStartDate', { name: employee.name })} type="date" value={member.startDate} onChange={event => updateMember(member.employeeId, { startDate: event.target.value })} /><Input aria-label={t('memberStartTime', { name: employee.name })} type="time" value={member.startTime} onChange={event => updateMember(member.employeeId, { startTime: event.target.value })} /><Input aria-label={t('memberEndDate', { name: employee.name })} type="date" value={member.endDate} onChange={event => updateMember(member.employeeId, { endDate: event.target.value })} /><Input aria-label={t('memberEndTime', { name: employee.name })} type="time" value={member.endTime} onChange={event => updateMember(member.employeeId, { endTime: event.target.value })} /></div> : <p className="mt-1 text-xs text-muted-foreground">{t('inheritsShiftHours')}</p>}</div> })}
    </div>
    <DialogFooter className="gap-2">{initial && <Button variant="destructive" disabled={busy} onClick={() => void remove()}>{common('delete')}</Button>}<Button variant="outline" disabled={busy} onClick={onClose}>{common('cancel')}</Button><Button disabled={busy || !form.members.length} onClick={() => void save()}>{t('saveShift')}</Button></DialogFooter>
  </DialogContent></Dialog>
}
