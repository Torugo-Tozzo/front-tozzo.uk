import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

type Employee = { id: string; name: string }
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase()

export default function EmployeeFilterDialog({ employees, selectedId, onApply }: { employees: Employee[]; selectedId: string | null; onApply: (id: string | null) => void }) {
  const { t } = useTranslation('calendar')
  const { t: common } = useTranslation('common')
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [draftId, setDraftId] = useState<string | null>(null)
  const visible = employees.filter(employee => normalize(employee.name).includes(normalize(query)))
  const begin = () => { setDraftId(selectedId); setQuery(''); setOpen(true) }
  const apply = () => { onApply(draftId); setOpen(false) }

  return <>
    <Button variant="outline" aria-label={t('filterByEmployee')} onClick={begin}><Search className="mr-2 h-4 w-4" />{t('filterByEmployee')}{selectedId && <span className="ml-2 h-2 w-2 rounded-full bg-primary" aria-hidden="true" />}</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>{t('filterByEmployee')}</DialogTitle><DialogDescription>{t('filterEmployeesHelp')}</DialogDescription></DialogHeader>
      <Input placeholder={t('searchEmployee')} aria-label={t('searchEmployee')} value={query} onChange={event => setQuery(event.target.value)} />
      <div className="max-h-64 space-y-1 overflow-y-auto">{visible.length ? visible.map(employee => <label key={employee.id} className="flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm hover:bg-accent"><input type="radio" name="calendar-employee-filter" checked={draftId === employee.id} onChange={() => setDraftId(employee.id)} />{employee.name}</label>) : <p className="p-3 text-sm text-muted-foreground">{t('noEmployeesFound')}</p>}</div>
      <DialogFooter className="gap-2"><Button variant="ghost" onClick={() => setDraftId(null)}>{t('clearFilter')}</Button><Button variant="outline" onClick={() => setOpen(false)}>{common('cancel')}</Button><Button onClick={apply}>{t('applyFilter')}</Button></DialogFooter>
    </DialogContent></Dialog>
  </>
}
