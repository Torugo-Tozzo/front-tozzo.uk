import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '@/services/api'
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

export default function BusinessHoursPanel({ hours, canManage, onSaved }: { hours: BusinessHour[]; canManage: boolean; onSaved: (hours: BusinessHour[]) => void }) {
  const { t, i18n } = useTranslation('calendar')
  const { t: common } = useTranslation('common')
  const [open, setOpen] = useState(false)
  const [base, setBase] = useState({ startTime: '11:00', endTime: '23:00' })
  const [draft, setDraft] = useState<DayDraft[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const names = useMemo(() => days.map(day => new Intl.DateTimeFormat(i18n.language, { weekday: 'long' }).format(new Date(2026, 8, 20 + day))), [i18n.language])
  const groups = useMemo(() => {
    const grouped = new Map<string, string[]>()
    days.forEach((day, index) => {
      const hour = hours.find(value => value.daysOfWeek.includes(day))
      const key = hour ? `${hour.startTime}–${hour.endTime}` : t('closed')
      grouped.set(key, [...(grouped.get(key) ?? []), names[index]])
    })
    return [...grouped].map(([time, weekdays]) => ({ time, weekdays }))
  }, [hours, names, t])

  const edit = () => {
    const next = makeDraft(hours)
    setBase(next.base)
    setDraft(next.draft)
    setError('')
    setOpen(true)
  }
  const changeDay = (day: number, changes: Partial<DayDraft>) => setDraft(previous => previous.map(value => value.day === day ? { ...value, ...changes } : value))
  const save = async () => {
    if (busy) return
    const nextHours = draft.filter(day => day.open).map(day => ({ daysOfWeek: [day.day], startTime: day.custom ? day.startTime : base.startTime, endTime: day.custom ? day.endTime : base.endTime }))
    if (nextHours.some(hour => !hour.startTime || !hour.endTime || hour.startTime === hour.endTime)) { setError(t('invalidHours')); return }
    setBusy(true)
    try {
      const response = await api.put('/calendar/business-hours', { hours: nextHours })
      onSaved(response.data.hours)
      setOpen(false)
    } catch { setError(t('hoursSaveError')) }
    finally { setBusy(false) }
  }

  return <>
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0"><CardTitle>{t('businessHours')}</CardTitle>{canManage && <Button variant="outline" onClick={edit}>{t('editBusinessHours')}</Button>}</CardHeader>
      <CardContent>{hours.length ? <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{groups.map(group => <div key={group.time} className="rounded-md border p-3"><p className="text-sm text-muted-foreground">{group.weekdays.join(', ')}</p><p className="font-medium">{group.time}</p></div>)}</div> : <p className="text-sm text-muted-foreground">{t('hoursNotConfigured')}</p>}</CardContent>
    </Card>
    <Dialog open={open} onOpenChange={next => { if (!next && !busy) setOpen(false) }}><DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>{t('businessHours')}</DialogTitle><DialogDescription>{t('hoursDescription')}</DialogDescription></DialogHeader>
      <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1"><Label htmlFor="base-opening">{t('defaultOpening')}</Label><Input id="base-opening" type="time" value={base.startTime} onChange={event => setBase(previous => ({ ...previous, startTime: event.target.value }))} /></div><div className="space-y-1"><Label htmlFor="base-closing">{t('defaultClosing')}</Label><Input id="base-closing" type="time" value={base.endTime} onChange={event => setBase(previous => ({ ...previous, endTime: event.target.value }))} /></div></div>
      <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" size="sm" onClick={() => setDraft(previous => previous.map(day => ({ ...day, open: true })))}>{t('allDays')}</Button><Button type="button" variant="outline" size="sm" onClick={() => setDraft(previous => previous.map(day => ({ ...day, open: day.day >= 1 && day.day <= 5 })))}>{t('weekdays')}</Button><Button type="button" variant="outline" size="sm" onClick={() => setDraft(previous => previous.map(day => ({ ...day, open: day.day >= 1 && day.day <= 6 })))}>{t('mondayToSaturday')}</Button></div>
      <div className="space-y-2">{draft.map((day, index) => <div key={day.day} className="rounded-md border p-3"><div className="flex flex-wrap items-center justify-between gap-2"><label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" aria-label={`${names[index]}: ${t('open')}`} checked={day.open} onChange={event => changeDay(day.day, { open: event.target.checked })} />{names[index]}</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={day.custom} disabled={!day.open} onChange={event => changeDay(day.day, { custom: event.target.checked })} />{t('customizeDay', { day: names[index] })}</label></div>{day.open && day.custom && <div className="mt-3 grid grid-cols-2 gap-2"><Input aria-label={`${names[index]} ${t('opening')}`} type="time" value={day.startTime} onChange={event => changeDay(day.day, { startTime: event.target.value })} /><Input aria-label={`${names[index]} ${t('closing')}`} type="time" value={day.endTime} onChange={event => changeDay(day.day, { endTime: event.target.value })} /></div>}</div>)}</div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <DialogFooter><Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>{common('cancel')}</Button><Button disabled={busy} onClick={() => void save()}>{t('saveBusinessHours')}</Button></DialogFooter>
    </DialogContent></Dialog>
  </>
}
