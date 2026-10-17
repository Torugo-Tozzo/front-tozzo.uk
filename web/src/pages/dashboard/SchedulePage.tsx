import { createEffect, createMemo, createSignal, onMount, onCleanup } from 'solid-js'
import { createMutation, createQuery, useQueryClient } from '@tanstack/solid-query'
import { loadedData } from '@/api/query'
import { useSearchParams } from '@solidjs/router'
import { Calendar, type CalendarOptions } from '@fullcalendar/core'
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
import { CalendarDays, Plus } from 'lucide-solid'
import { useTranslation } from '@/i18n/solid'
import { calendarKeys, getCalendar, getBusinessHours, createEvent, updateEvent, deleteEvent as removeCalendarEvent } from '@/api/calendar'
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

type FormState = Omit<CalendarRecord, 'id' | 'employee'>
const locales = { en: enGb, 'pt-BR': ptBr, es, fr, zh: zhCn, hi }
const palette = ['#2563eb', '#059669', '#dc2626', '#7c3aed', '#ea580c', '#0891b2', '#be185d', '#4d7c0f']
const today = () => new Date().toLocaleDateString('en-CA')
const nextDay = (date: string) => { const day = new Date(`${date}T12:00:00.000Z`); day.setUTCDate(day.getUTCDate() + 1); return day.toISOString().slice(0, 10) }
const emptyForm = (date = today()): FormState => ({ type: 'SPECIAL', employeeId: null, title: '', startDate: date, startTime: '11:00', endDate: date, endTime: '19:00', repeatWeekly: false, repeatUntil: null })

export default function SchedulePage() {
  const { user } = useAuth()
  const { t, language } = useTranslation('calendar')
  const { t: common } = useTranslation('common')
  const [searchParams] = useSearchParams()
  const canManage = () => user()?.role === 'OWNER' || user()?.role === 'MANAGER'
  const [range, setRange] = createSignal<{ from: string; to: string } | null>(null)
  const [selectedEmployeeId, setSelectedEmployeeId] = createSignal<string | null>(typeof searchParams.employeeId === 'string' ? searchParams.employeeId : null)
  const [shiftEditor, setShiftEditor] = createSignal<{ initial: CalendarShift | null; date: string } | null>(null)
  const [detailsShiftClick, setDetailsShiftClick] = createSignal<{ id: string; date: string | null } | null>(null)
  const [legacyDialog, setLegacyDialog] = createSignal(false)
  const [editingId, setEditingId] = createSignal<string | null>(null)
  const [form, setForm] = createSignal<FormState>(emptyForm())
  const [busy, setBusy] = createSignal(false)
  const [dialogError, setDialogError] = createSignal('')
  const queryClient = useQueryClient()
  const calendarQuery = createQuery(() => ({ queryKey: calendarKeys.range(range() ? { ...range()!, userIds: selectedEmployeeId() || undefined } : null), enabled: !!range(), queryFn: ({ signal }) => getCalendar({ ...range()!, userIds: selectedEmployeeId() || undefined }, signal) }))
  const hoursQuery = createQuery(() => ({ queryKey: calendarKeys.hours, queryFn: ({ signal }) => getBusinessHours(signal) }))
  const records = () => loadedData(calendarQuery)?.events ?? []
  const shifts = () => loadedData(calendarQuery)?.shifts ?? []
  const employees = () => loadedData(calendarQuery)?.employees ?? []
  const hours = () => loadedData(hoursQuery) ?? []
  const loading = () => calendarQuery.isFetching
  const error = () => calendarQuery.isError ? t('loadError') : hoursQuery.isError ? t('hoursLoadError') : ''
  const load = async () => { await queryClient.invalidateQueries({ queryKey: calendarKeys.all }) }
  const setHours = (value: BusinessHour[]) => queryClient.setQueryData(calendarKeys.hours, value)
  const colors = createMemo(() => Object.fromEntries(employees().map((employee, index) => [employee.id, palette[index % palette.length]])))
  const events = createMemo(() => [...toCalendarEvents(records(), colors()), ...toCalendarShiftEvents(shifts(), t('shift'))])
  const slotRange = createMemo(() => getCalendarSlotRange(hours(), records(), shifts()))
  const locale = () => locales[language() as keyof typeof locales] ?? enGb
  const detailsShift = () => shifts().find(shift => shift.id === detailsShiftClick()?.id) ?? null
  const detailsOccurrence = () => detailsShift() ? getShiftOccurrence(detailsShift()!, detailsShiftClick()?.date ?? null) : null

  const openSpecial = (date = today()) => { setDialogError(''); setEditingId(null); setForm(emptyForm(date)); setLegacyDialog(true) }
  const openLegacyEdit = (id: string) => {
    const record = records().find(entry => entry.id === id)
    if (!record) return
    setDialogError('')
    setEditingId(record.id)
    setForm({ type: record.type, employeeId: record.employeeId, title: record.title, startDate: record.startDate, startTime: record.startTime, endDate: record.endDate, endTime: record.endTime, repeatWeekly: record.repeatWeekly, repeatUntil: record.repeatUntil })
    setLegacyDialog(true)
  }
  const eventMutation = createMutation(() => ({ mutationFn: () => editingId() ? updateEvent(editingId()!, form()) : createEvent(form()) }))
  const eventRemoval = createMutation(() => ({ mutationFn: removeCalendarEvent }))
  const saveEvent = async () => {
    if (!canManage() || busy()) return
    setBusy(true)
    try {
      await eventMutation.mutateAsync()
      setLegacyDialog(false); await load()
    } catch { setDialogError(t('saveError')) }
    finally { setBusy(false) }
  }
  const deleteEvent = async () => {
    if (!canManage() || !editingId() || busy()) return
    setBusy(true)
    try { await eventRemoval.mutateAsync(editingId()!); setLegacyDialog(false); await load() }
    catch { setDialogError(t('deleteError')) }
    finally { setBusy(false) }
  }

  let calendarElement!: HTMLDivElement
  let calendar: Calendar | undefined
  // FullCalendar labels the navigation buttons, but also gives their purely
  // decorative chevrons role="img" without a name. Keep that second image out
  // of the accessibility tree, including when the toolbar is rebuilt.
  const hideButtonIcons = () => calendarElement.querySelectorAll('.fc-button .fc-icon').forEach(icon => icon.setAttribute('aria-hidden', 'true'))
  onMount(() => {
    calendar = new Calendar(calendarElement, {
      plugins: [dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin],
      initialView: 'timeGridWeek',
      headerToolbar: { left: 'prev,next today', center: 'title', right: 'timeGridDay,timeGridWeek,dayGridMonth,listWeek' },
      nowIndicator: true, height: 'min(75vh, 720px)',
      datesSet: info => { const from = info.startStr.slice(0, 10), to = info.endStr.slice(0, 10); setRange(previous => previous?.from === from && previous.to === to ? previous : { from, to }); hideButtonIcons() },
      dateClick: info => { if (canManage()) setShiftEditor({ initial: null, date: info.dateStr.slice(0, 10) }) },
      eventClick: info => { const shiftId = String(info.event.extendedProps.shiftId ?? ''); if (shiftId) { const day = info.event.start; setDetailsShiftClick({ id: shiftId, date: day ? `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}` : null }) } else if (canManage()) openLegacyEdit(String(info.event.extendedProps.recordId ?? info.event.id)) }
    })
    calendar.render()
    hideButtonIcons()
  })
  createEffect(() => {
    const options: CalendarOptions = { locale: locale(), events: events(), businessHours: toFullCalendarBusinessHours(hours()), ...slotRange(), scrollTime: slotRange().slotMinTime, views: { timeGridDay: { buttonText: t('day') }, timeGridWeek: { buttonText: t('week') }, dayGridMonth: { buttonText: t('month') }, listWeek: { buttonText: t('list') } } }
    calendar?.batchRendering(() => { for (const [key, value] of Object.entries(options)) calendar!.setOption(key as keyof CalendarOptions, value) })
    if (calendar) hideButtonIcons()
  })
  onCleanup(() => calendar?.destroy())

  return <section class="space-y-5">
    <div class="flex flex-wrap items-center justify-between gap-3"><h1 class="flex items-center gap-2 text-3xl font-bold"><CalendarDays class="h-8 w-8" />{t('title')}</h1>{canManage() && <div class="flex flex-wrap gap-2"><Button variant="outline" onClick={() => openSpecial()}>{t('newSpecial')}</Button><Button onClick={() => setShiftEditor({ initial: null, date: today() })}><Plus class="mr-2 h-4 w-4" />{t('newShift')}</Button></div>}</div>
    <p class="text-sm text-muted-foreground">{t('description')}</p>
    {error() && <p role="alert" class="text-destructive">{error()}</p>}
    <BusinessHoursPanel hours={hours()} canManage={canManage()} onSaved={setHours} />
    <Card><CardHeader class="flex flex-row flex-wrap items-center justify-between gap-3"><CardTitle>{t('schedule')}</CardTitle><EmployeeFilterDialog employees={employees()} selectedId={selectedEmployeeId()} onApply={setSelectedEmployeeId} /></CardHeader><CardContent>{loading() && <p role="status" class="mb-2 text-sm">{common('loading')}</p>}<div class="schedule-calendar min-w-0 overflow-x-auto"><div ref={calendarElement} /></div></CardContent></Card>
    {range() && !loading() && !records().length && !shifts().length && !error() && <p class="text-sm text-muted-foreground">{t('empty')}</p>}

    <Dialog open={!!detailsShift()} onOpenChange={open => { if (!open) setDetailsShiftClick(null) }}><DialogContent><DialogHeader><DialogTitle>{detailsShift()?.title || t('shift')}</DialogTitle><DialogDescription>{detailsOccurrence() && `${detailsOccurrence()!.startDate} ${detailsOccurrence()!.startTime}–${detailsOccurrence()!.endDate} ${detailsOccurrence()!.endTime}`}</DialogDescription></DialogHeader><div class="space-y-2"><h3 class="text-sm font-medium">{t('employeesInShift')}</h3>{detailsOccurrence() && getVisibleShiftMembers(detailsOccurrence()!).map(member => <div class="flex items-center justify-between gap-3 rounded-md border p-3 text-sm"><span>{member.employee?.name ?? member.employeeId}</span><span class="whitespace-nowrap text-muted-foreground">{member.startTime}–{member.endTime}</span></div>)}</div><DialogFooter>{canManage() && detailsShift() && <Button onClick={() => { setShiftEditor({ initial: detailsShift(), date: detailsShift()!.startDate }); setDetailsShiftClick(null) }}>{detailsShift()!.repeatWeekly ? t('editShiftSeries') : t('editShift')}</Button>}<Button variant="outline" onClick={() => setDetailsShiftClick(null)}>{common('close')}</Button></DialogFooter></DialogContent></Dialog>

    {canManage() && shiftEditor() && <ShiftGroupDialog initial={shiftEditor()!.initial} defaultDate={shiftEditor()!.date} hours={hours()} employees={employees()} initialEmployeeIds={selectedEmployeeId() ? [selectedEmployeeId()!] : []} onClose={() => setShiftEditor(null)} onSaved={load} />}

    <Dialog open={legacyDialog()} onOpenChange={open => { if (!open && !busy()) setLegacyDialog(false) }}><DialogContent class="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{editingId() ? t('edit') : t('newSpecial')}</DialogTitle><DialogDescription>{t('eventDescription')}</DialogDescription></DialogHeader>{dialogError() && <p role="alert" class="text-sm text-destructive">{dialogError()}</p>}<div class="grid gap-3">
      {form().type === 'SHIFT' ? <div><Label for="schedule-employee">{t('employee')}</Label><select id="schedule-employee" class="h-9 w-full rounded-md border bg-background px-3" value={form().employeeId ?? ''} onInput={event => setForm(previous => ({ ...previous, employeeId: event.currentTarget.value }))}><option value="">{t('chooseEmployee')}</option>{employees().map(employee => <option value={employee.id}>{employee.name}</option>)}</select></div> : <div><Label for="schedule-title">{t('specialTitle')}</Label><Input id="schedule-title" value={form().title ?? ''} maxLength={120} onInput={event => setForm(previous => ({ ...previous, title: event.currentTarget.value }))} /></div>}
      <div class="grid grid-cols-2 gap-3"><div><Label for="schedule-start-date">{t('startDate')}</Label><Input id="schedule-start-date" type="date" value={form().startDate} onInput={event => setForm(previous => ({ ...previous, startDate: event.currentTarget.value, endDate: event.currentTarget.value }))} /></div><div><Label for="schedule-start-time">{t('start')}</Label><Input id="schedule-start-time" type="time" value={form().startTime} onInput={event => setForm(previous => ({ ...previous, startTime: event.currentTarget.value }))} /></div><div><Label for="schedule-end-date">{t('endDate')}</Label><Input id="schedule-end-date" type="date" value={form().endDate} onInput={event => setForm(previous => ({ ...previous, endDate: event.currentTarget.value }))} /></div><div><Label for="schedule-end-time">{t('end')}</Label><Input id="schedule-end-time" type="time" value={form().endTime} onInput={event => setForm(previous => ({ ...previous, endTime: event.currentTarget.value }))} /></div></div>
      {form().type === 'SPECIAL' ? <label class="flex items-center gap-2 text-sm"><input type="checkbox" checked={form().startTime === '00:00' && form().endTime === '00:00' && form().endDate === nextDay(form().startDate)} onInput={event => setForm(previous => event.currentTarget.checked ? { ...previous, startTime: '00:00', endDate: nextDay(previous.startDate), endTime: '00:00' } : { ...previous, startTime: '11:00', endDate: previous.startDate, endTime: '19:00' })} />{t('allDay')}</label> : <><label class="flex items-center gap-2 text-sm"><input type="checkbox" checked={form().repeatWeekly} onInput={event => setForm(previous => ({ ...previous, repeatWeekly: event.currentTarget.checked, repeatUntil: event.currentTarget.checked ? previous.repeatUntil : null }))} />{t('repeatWeekly')}</label>{form().repeatWeekly && <div><Label for="schedule-repeat-until">{t('repeatUntil')}</Label><Input id="schedule-repeat-until" type="date" min={form().startDate} value={form().repeatUntil ?? ''} onInput={event => setForm(previous => ({ ...previous, repeatUntil: event.currentTarget.value || null }))} /><p class="mt-1 text-xs text-muted-foreground">{t('repeatUntilHelp')}</p></div>}</>}
    </div><DialogFooter class="gap-2">{editingId() && <Button variant="destructive" disabled={busy()} onClick={() => void deleteEvent()}>{common('delete')}</Button>}<Button variant="outline" disabled={busy()} onClick={() => setLegacyDialog(false)}>{common('cancel')}</Button><Button disabled={busy() || form().type === 'SHIFT' && !form().employeeId || form().type === 'SPECIAL' && !form().title?.trim()} onClick={() => void saveEvent()}>{t('save')}</Button></DialogFooter></DialogContent></Dialog>
  </section>
}
