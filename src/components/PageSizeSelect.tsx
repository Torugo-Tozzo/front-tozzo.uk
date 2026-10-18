import { onMount } from 'solid-js'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatNumber } from '@/i18n/format'
import { useTranslation } from '@/i18n/solid'
import { PAGE_SIZES, PAGE_SIZE_TRIGGER_CLASS, type PageSizeSelectProps } from './page-size-select'

export default function PageSizeSelect(props: PageSizeSelectProps) {
  const { t, language } = useTranslation('common')
  let trigger!: HTMLButtonElement
  // Escape while the chunk is pending cancels opening, without losing focus.
  onMount(() => { if (!props.initiallyOpen && props.restoreFocus) trigger.focus() })
  return (
    <Select<string>
      options={PAGE_SIZES}
      value={String(props.value)}
      onChange={value => { if (value) props.onChange(Number(value)) }}
      disabled={props.disabled}
      defaultOpen={props.initiallyOpen}
      placement="top-start"
      class="contents"
      itemComponent={item => <SelectItem item={item.item}>{formatNumber(Number(item.item.rawValue), language())}</SelectItem>}
    >
      <SelectTrigger ref={trigger} class={PAGE_SIZE_TRIGGER_CLASS} aria-label={t('pagination.rowsPerPage')}>
        <SelectValue<string>>{() => formatNumber(props.value, language())}</SelectValue>
      </SelectTrigger>
      <SelectContent />
    </Select>
  )
}
