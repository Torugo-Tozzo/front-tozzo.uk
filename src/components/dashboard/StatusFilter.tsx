import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useTranslation } from '@/i18n/solid'
import type { SelectFilterProps } from './FiltersBar'

export default function StatusFilter(props: { status: SelectFilterProps }) {
  const { t } = useTranslation('common')
  const label = (value: string) => props.status.options.find(option => option.value === value)?.label ?? ''
  return (
    <div class="space-y-2 w-full sm:w-[190px]">
      <Label for="filter-status">{t('status')}</Label>
      <Select<string>
        options={props.status.options.map(option => option.value)}
        value={props.status.value}
        onChange={value => { if (value) props.status.onChange(value) }}
        placeholder={props.status.placeholder ?? t('status')}
        itemComponent={item => <SelectItem item={item.item}>{label(item.item.rawValue)}</SelectItem>}
      >
        <SelectTrigger id="filter-status" aria-label={t('status')}>
          <SelectValue<string>>{state => label(state.selectedOption())}</SelectValue>
        </SelectTrigger>
        <SelectContent />
      </Select>
    </div>
  )
}
