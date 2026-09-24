import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import interactionPlugin from '@fullcalendar/interaction'
import enGb from '@fullcalendar/core/locales/en-gb'
import ptBr from '@fullcalendar/core/locales/pt-br'
import es from '@fullcalendar/core/locales/es'
import fr from '@fullcalendar/core/locales/fr'
import zhCn from '@fullcalendar/core/locales/zh-cn'
import hi from '@fullcalendar/core/locales/hi'
import { CalendarDays, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import api from '@/services/api'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import BusinessHoursPanel from './BusinessHoursPanel'
import EmployeeFilterDialog from './EmployeeFilterDialog'
import ShiftGroupDialog from './ShiftGroupDialog'
import { getCalendarSlotRange, getShiftOccurrence, getVisibleShiftMembers, toCalendarEvents, toCalendarShiftEvents, toFullCalendarBusinessHours, type BusinessHour, type CalendarRecord, type CalendarShift } from './calendarEvents'

type Employee = { id: string; name: string; role: string }
type FormState = Omit<CalendarRecord, 'id' | 'employee'>
const locales = { en: enGb, 'pt-BR': ptBr, es, fr, zh: zhCn, hi }
const palette = ['#2563eb', '#059669', '#dc2626', '#7c3aed', '#ea580c', '#0891b2', '#be185d', '#4d7c0f']
const today = () => new Date().toLocaleDateString('en-CA')
const nextDay = (date: string) => { const day = new Date(`${date}T12:00:00.000Z`); day.setUTCDate(day.getUTCDate() + 1); return day.toISOString().slice(0, 10) }
const emptyForm = (date = today()): FormState => ({ type: 'SPECIAL', employeeId: null, title: '', startDate: date, startTime: '11:00', endDate: date, endTime: '19:00', repeatWeekly: false, repeatUntil: null })

export default function SchedulePage() {
  const { user } = useAuth()
  const { t, i18n } = useTranslation('calendar')
  const { t: common } = useTranslation('common')
  const [searchParams] = useSearchParams()
  const canManage = user?.role === 'OWNER' || user?.role === 'MANAGER'
  const [range, setRange] = useState<{ from: string; to: string } | null>(null)
  const [records, setRecords] = useState<CalendarRecord[]>([])
  const [shifts, setShifts] = useState<CalendarShift[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(() => searchParams.get('employeeId'))
  const [hours, setHours] = useState<BusinessHour[]>([])
  const [shiftEditor, setShiftEditor] = useState<{ initial: CalendarShift | null; date: string } | null>(null)
  const [detailsShiftClick, setDetailsShiftClick] = useState<{ id: string; date: string | null } | null>(null)
  const [legacyDialog, setLegacyDialog] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [dialogError, setDialogError] = useState('')
  const sequence = useRef(0)

  const load = useCallback(async () => {
    if (!range) return
    const token = ++sequence.current
    setLoading(true)
    try {
      const response = await api.get('/calendar', { params: { from: range.from, to: range.to, userIds: selectedEmployeeId || undefined } })
      if (token !== sequence.current) return
      setRecords(response.data.events ?? [])
      setShifts(response.data.shifts ?? [])
      setEmployees(response.data.employees ?? [])
      setError('')
    } catch {
      if (token === sequence.current) setError(t('loadError'))
    } finally { if (token === sequence.current) setLoading(false) }
  }, [range, selectedEmployeeId, t])

  useEffect(() => { void load(); return () => { sequence.current++ } }, [load])
  useEffect(() => {
    let cancelled = false
    api.get('/calendar/business-hours').then(response => { if (!cancelled) setHours(response.data.hours ?? []) }).catch(() => { if (!cancelled) setError(t('hoursLoadError')) })
    return () => { cancelled = true }
  }, [t])

  const colors = useMemo(() => Object.fromEntries(employees.map((employee, index) => [employee.id, palette[index % palette.length]])), [employees])
  const events = useMemo(() => [...toCalendarEvents(records, colors), ...toCalendarShiftEvents(shifts, t('shift'))], [records, colors, shifts, t])
  const slotRange = useMemo(() => getCalendarSlotRange(hours, records, shifts), [hours, records, shifts])
  const locale = locales[i18n.language as keyof typeof locales] ?? enGb
  const detailsShift = shifts.find(shift => shift.id === detailsShiftClick?.id) ?? null
  const detailsOccurrence = detailsShift ? getShiftOccurrence(detailsShift, detailsShiftClick?.date ?? null) : null

  const openSpecial = (date = today()) => { setDialogError(''); setEditingId(null); setForm(emptyForm(date)); setLegacyDialog(true) }
  const openLegacyEdit = (id: string) => {
    const record = records.find(entry => entry.id === id)
    if (!record) return
    setDialogError('')
    setEditingId(record.id)
    setForm({ type: record.type, employeeId: record.employeeId, title: record.title, startDate: record.startDate, startTime: record.startTime, endDate: record.endDate, endTime: record.endTime, repeatWeekly: record.repeatWeekly, repeatUntil: record.repeatUntil })
    setLegacyDialog(true)
  }
  const saveEvent = async () => {
    if (busy) return
    setBusy(true)
    try {
      if (editingId) await api.put(`/calendar/${editingId}`, form)
      else await api.post('/calendar', form)
      setLegacyDialog(false); await load()
    } catch { setDialogError(t('saveError')) }
    finally { setBusy(false) }
  }
  const deleteEvent = async () => {
    if (!editingId || busy) return
    setBusy(true)
    try { await api.delete(`/calendar/${editingId}`); setLegacyDialog(false); await load() }
    catch { setDialogError(t('deleteError')) }
    finally { setBusy(false) }
  }

  return <section className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="flex items-center gap-2 text-3xl font-bold"><CalendarDays className="h-8 w-8" />{t('title')}</h1>{canManage && <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => openSpecial()}>{t('newSpecial')}</Button><Button onClick={() => setShiftEditor({ initial: null, date: today() })}><Plus className="mr-2 h-4 w-4" />{t('newShift')}</Button></div>}</div>
    <p className="text-sm text-muted-foreground">{t('description')}</p>
    {error && <p role="alert" className="text-destructive">{error}</p>}
    <BusinessHoursPanel hours={hours} canManage={canManage} onSaved={setHours} />
    <Card><CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3"><CardTitle>{t('schedule')}</CardTitle><EmployeeFilterDialog employees={employees} selectedId={selectedEmployeeId} onApply={setSelectedEmployeeId} /></CardHeader><CardContent>{loading && <p role="status" className="mb-2 text-sm">{common('loading')}</p>}<div className="schedule-calendar min-w-0 overflow-x-auto"><FullCalendar plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]} locale={locale} initialView="timeGridWeek" headerToolbar={{ left: 'prev,next today', center: 'title', right: 'timeGridDay,timeGridWeek,dayGridMonth,listWeek' }} views={{ timeGridDay: { buttonText: t('day') }, timeGridWeek: { buttonText: t('week') }, dayGridMonth: { buttonText: t('month') }, listWeek: { buttonText: t('list') } }} events={events} businessHours={toFullCalendarBusinessHours(hours)} slotMinTime={slotRange.slotMinTime} slotMaxTime={slotRange.slotMaxTime} scrollTime={slotRange.slotMinTime} datesSet={info => { const from = info.startStr.slice(0, 10), to = info.endStr.slice(0, 10); setRange(previous => previous?.from === from && previous.to === to ? previous : { from, to }) }} dateClick={info => { if (canManage) setShiftEditor({ initial: null, date: info.dateStr.slice(0, 10) }) }} eventClick={info => { const shiftId = String(info.event.extendedProps.shiftId ?? ''); if (shiftId) { const day = info.event.start; setDetailsShiftClick({ id: shiftId, date: day ? `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}` : null }) } else if (canManage) openLegacyEdit(String(info.event.extendedProps.recordId ?? info.event.id)) }} nowIndicator height="min(75vh, 720px)" /></div></CardContent></Card>
    {range && !loading && !records.length && !shifts.length && !error && <p className="text-sm text-muted-foreground">{t('empty')}</p>}

    <Dialog open={!!detailsShift} onOpenChange={open => { if (!open) setDetailsShiftClick(null) }}><DialogContent><DialogHeader><DialogTitle>{detailsShift?.title || t('shift')}</DialogTitle><DialogDescription>{detailsOccurrence && `${detailsOccurrence.startDate} ${detailsOccurrence.startTime}–${detailsOccurrence.endDate} ${detailsOccurrence.endTime}`}</DialogDescription></DialogHeader><div className="space-y-2"><h3 className="text-sm font-medium">{t('employeesInShift')}</h3>{detailsOccurrence && getVisibleShiftMembers(detailsOccurrence).map(member => <div key={member.id} className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm"><span>{member.employee?.name ?? member.employeeId}</span><span className="whitespace-nowrap text-muted-foreground">{member.startTime}–{member.endTime}</span></div>)}</div><DialogFooter>{canManage && detailsShift && <Button onClick={() => { setShiftEditor({ initial: detailsShift, date: detailsShift.startDate }); setDetailsShiftClick(null) }}>{detailsShift.repeatWeekly ? t('editShiftSeries') : t('editShift')}</Button>}<Button variant="outline" onClick={() => setDetailsShiftClick(null)}>{common('close')}</Button></DialogFooter></DialogContent></Dialog>

    {shiftEditor && <ShiftGroupDialog key={shiftEditor.initial?.id ?? `new-${shiftEditor.date}`} initial={shiftEditor.initial} defaultDate={shiftEditor.date} hours={hours} employees={employees} initialEmployeeIds={selectedEmployeeId ? [selectedEmployeeId] : []} onClose={() => setShiftEditor(null)} onSaved={load} />}

    <Dialog open={legacyDialog} onOpenChange={open => { if (!open && !busy) setLegacyDialog(false) }}><DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{editingId ? t('edit') : t('newSpecial')}</DialogTitle><DialogDescription>{t('eventDescription')}</DialogDescription></DialogHeader>{dialogError && <p role="alert" className="text-sm text-destructive">{dialogError}</p>}<div className="grid gap-3">
      {form.type === 'SHIFT' ? <div><Label htmlFor="schedule-employee">{t('employee')}</Label><select id="schedule-employee" className="h-9 w-full rounded-md border bg-background px-3" value={form.employeeId ?? ''} onChange={event => setForm(previous => ({ ...previous, employeeId: event.target.value }))}><option value="">{t('chooseEmployee')}</option>{employees.map(employee => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select></div> : <div><Label htmlFor="schedule-title">{t('specialTitle')}</Label><Input id="schedule-title" value={form.title ?? ''} maxLength={120} onChange={event => setForm(previous => ({ ...previous, title: event.target.value }))} /></div>}
      <div className="grid grid-cols-2 gap-3"><div><Label htmlFor="schedule-start-date">{t('startDate')}</Label><Input id="schedule-start-date" type="date" value={form.startDate} onChange={event => setForm(previous => ({ ...previous, startDate: event.target.value, endDate: event.target.value }))} /></div><div><Label htmlFor="schedule-start-time">{t('start')}</Label><Input id="schedule-start-time" type="time" value={form.startTime} onChange={event => setForm(previous => ({ ...previous, startTime: event.target.value }))} /></div><div><Label htmlFor="schedule-end-date">{t('endDate')}</Label><Input id="schedule-end-date" type="date" value={form.endDate} onChange={event => setForm(previous => ({ ...previous, endDate: event.target.value }))} /></div><div><Label htmlFor="schedule-end-time">{t('end')}</Label><Input id="schedule-end-time" type="time" value={form.endTime} onChange={event => setForm(previous => ({ ...previous, endTime: event.target.value }))} /></div></div>
      {form.type === 'SPECIAL' ? <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.startTime === '00:00' && form.endTime === '00:00' && form.endDate === nextDay(form.startDate)} onChange={event => setForm(previous => event.target.checked ? { ...previous, startTime: '00:00', endDate: nextDay(previous.startDate), endTime: '00:00' } : { ...previous, startTime: '11:00', endDate: previous.startDate, endTime: '19:00' })} />{t('allDay')}</label> : <><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.repeatWeekly} onChange={event => setForm(previous => ({ ...previous, repeatWeekly: event.target.checked, repeatUntil: event.target.checked ? previous.repeatUntil : null }))} />{t('repeatWeekly')}</label>{form.repeatWeekly && <div><Label htmlFor="schedule-repeat-until">{t('repeatUntil')}</Label><Input id="schedule-repeat-until" type="date" min={form.startDate} value={form.repeatUntil ?? ''} onChange={event => setForm(previous => ({ ...previous, repeatUntil: event.target.value || null }))} /><p className="mt-1 text-xs text-muted-foreground">{t('repeatUntilHelp')}</p></div>}</>}
    </div><DialogFooter className="gap-2">{editingId && <Button variant="destructive" disabled={busy} onClick={() => void deleteEvent()}>{common('delete')}</Button>}<Button variant="outline" disabled={busy} onClick={() => setLegacyDialog(false)}>{common('cancel')}</Button><Button disabled={busy || form.type === 'SHIFT' && !form.employeeId || form.type === 'SPECIAL' && !form.title?.trim()} onClick={() => void saveEvent()}>{t('save')}</Button></DialogFooter></DialogContent></Dialog>
  </section>
}
