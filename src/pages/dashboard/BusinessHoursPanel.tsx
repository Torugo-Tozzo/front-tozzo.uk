import { createMemo, createSignal, Index } from 'solid-js'
import { createMutation } from '@tanstack/solid-query'
import { useTranslation } from '@/i18n/solid'
import { saveBusinessHours } from '@/api/calendar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { BusinessHour } from './calendarEvents'

const days = [1, 2, 3, 4, 5, 6, 0]
type DayDraft = { day: number; open: boolean; custom: boolean; startTime: string; endTime: string }

function mostCommonHours(hours: BusinessHour[]) {
  const counts = new Map<string, number>()
  for (const hour of hours) {
    const key = `${hour.startTime}|${hour.endTime}`
    counts.set(key, (counts.get(key) ?? 0) + hour.daysOfWeek.length)
  }
  const [startTime = '11:00', endTime = '23:00'] = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0].split('|') ?? []
  return { startTime, endTime }
}

function makeDraft(hours: BusinessHour[]) {
  const base = mostCommonHours(hours)
  const draft = days.map(day => {
    const hour = hours.find(value => value.daysOfWeek.includes(day))
    return { day, open: !!hour, custom: !!hour && (hour.startTime !== base.startTime || hour.endTime !== base.endTime), startTime: hour?.startTime ?? base.startTime, endTime: hour?.endTime ?? base.endTime }
  })
  return { base, draft }
}

export default function BusinessHoursPanel(props: { hours: BusinessHour[]; canManage: boolean; onSaved: (hours: BusinessHour[]) => void }) {
  const { t, language } = useTranslation('calendar')
  const { t: common } = useTranslation('common')
  const [open, setOpen] = createSignal(false)
  const [base, setBase] = createSignal({ startTime: '11:00', endTime: '23:00' })
  const [draft, setDraft] = createSignal<DayDraft[]>([])
  const [busy, setBusy] = createSignal(false)
  const [error, setError] = createSignal('')
  const names = createMemo(() => days.map(day => new Intl.DateTimeFormat(language(), { weekday: 'long' }).format(new Date(2026, 8, 20 + day))))
  const groups = createMemo(() => {
    const grouped = new Map<string, string[]>()
    days.forEach((day, index) => {
      const hour = props.hours.find(value => value.daysOfWeek.includes(day))
      const key = hour ? `${hour.startTime}–${hour.endTime}` : t('closed')
      grouped.set(key, [...(grouped.get(key) ?? []), names()[index]])
    })
    return [...grouped].map(([time, weekdays]) => ({ time, weekdays }))
  })

  const mutation = createMutation(() => ({ mutationFn: saveBusinessHours }))
  const edit = () => {
    const next = makeDraft(props.hours)
    setBase(next.base)
    setDraft(next.draft)
    setError('')
    setOpen(true)
  }
  const changeDay = (day: number, changes: Partial<DayDraft>) => setDraft(previous => previous.map(value => value.day === day ? { ...value, ...changes } : value))
  const save = async () => {
    if (!props.canManage || busy()) return
    const nextHours = draft().filter(day => day.open).map(day => ({ daysOfWeek: [day.day], startTime: day.custom ? day.startTime : base().startTime, endTime: day.custom ? day.endTime : base().endTime }))
    if (nextHours.some(hour => !hour.startTime || !hour.endTime || hour.startTime === hour.endTime)) { setError(t('invalidHours')); return }
    setBusy(true)
    try {
      const response = await mutation.mutateAsync(nextHours)
      props.onSaved(response)
      setOpen(false)
    } catch { setError(t('hoursSaveError')) }
    finally { setBusy(false) }
  }

  return <>
    <Card>
      <CardHeader class="flex flex-row items-center justify-between gap-3 space-y-0"><CardTitle>{t('businessHours')}</CardTitle>{props.canManage && <Button variant="outline" onClick={edit}>{t('editBusinessHours')}</Button>}</CardHeader>
      <CardContent>{props.hours.length ? <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{groups().map(group => <div class="rounded-md border p-3"><p class="text-sm text-muted-foreground">{group.weekdays.join(', ')}</p><p class="font-medium">{group.time}</p></div>)}</div> : <p class="text-sm text-muted-foreground">{t('hoursNotConfigured')}</p>}</CardContent>
    </Card>
    <Dialog open={open()} onOpenChange={next => { if (!next && !busy()) setOpen(false) }}><DialogContent class="max-h-[90vh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>{t('businessHours')}</DialogTitle><DialogDescription>{t('hoursDescription')}</DialogDescription></DialogHeader>
      <div class="grid gap-3 sm:grid-cols-2"><div class="space-y-1"><Label for="base-opening">{t('defaultOpening')}</Label><Input id="base-opening" type="time" value={base().startTime} onInput={event => setBase(previous => ({ ...previous, startTime: event.currentTarget.value }))} /></div><div class="space-y-1"><Label for="base-closing">{t('defaultClosing')}</Label><Input id="base-closing" type="time" value={base().endTime} onInput={event => setBase(previous => ({ ...previous, endTime: event.currentTarget.value }))} /></div></div>
      <div class="flex flex-wrap gap-2"><Button type="button" variant="outline" size="sm" onClick={() => setDraft(previous => previous.map(day => ({ ...day, open: true })))}>{t('allDays')}</Button><Button type="button" variant="outline" size="sm" onClick={() => setDraft(previous => previous.map(day => ({ ...day, open: day.day >= 1 && day.day <= 5 })))}>{t('weekdays')}</Button><Button type="button" variant="outline" size="sm" onClick={() => setDraft(previous => previous.map(day => ({ ...day, open: day.day >= 1 && day.day <= 6 })))}>{t('mondayToSaturday')}</Button></div>
      <div class="space-y-2"><Index each={draft()}>{(day, index) => <div class="rounded-md border p-3"><div class="flex flex-wrap items-center justify-between gap-2"><label class="flex items-center gap-2 text-sm font-medium"><input type="checkbox" aria-label={`${names()[index]}: ${t('open')}`} checked={day().open} onInput={event => changeDay(day().day, { open: event.currentTarget.checked })} />{names()[index]}</label><label class="flex items-center gap-2 text-sm"><input type="checkbox" checked={day().custom} disabled={!day().open} onInput={event => changeDay(day().day, { custom: event.currentTarget.checked })} />{t('customizeDay', { day: names()[index] })}</label></div>{day().open && day().custom && <div class="mt-3 grid grid-cols-2 gap-2"><Input aria-label={`${names()[index]} ${t('opening')}`} type="time" value={day().startTime} onInput={event => changeDay(day().day, { startTime: event.currentTarget.value })} /><Input aria-label={`${names()[index]} ${t('closing')}`} type="time" value={day().endTime} onInput={event => changeDay(day().day, { endTime: event.currentTarget.value })} /></div>}</div>}</Index></div>
      {error() && <p role="alert" class="text-sm text-destructive">{error()}</p>}
      <DialogFooter><Button variant="outline" disabled={busy()} onClick={() => setOpen(false)}>{common('cancel')}</Button><Button disabled={busy()} onClick={() => void save()}>{t('saveBusinessHours')}</Button></DialogFooter>
    </DialogContent></Dialog>
  </>
}
