import { createSignal, onCleanup, Show, type Component } from 'solid-js'
import { ChevronDown } from 'lucide-solid'
import { SELECT_TRIGGER_CLASS } from '@/components/ui/select-trigger-class'
import { formatNumber } from '@/i18n/format'
import { useTranslation } from '@/i18n/solid'
import { withChunkReload } from '@/lib/lazy-page'
import { cn } from '@/lib/utils'
import { PAGE_SIZE_TRIGGER_CLASS, type PageSizeSelectProps } from './page-size-select'

const loadSelect = withChunkReload(() => import('./PageSizeSelect'))

export function DeferredPageSizeSelect(props: PageSizeSelectProps) {
  const { t, language } = useTranslation('common')
  const [component, setComponent] = createSignal<Component<PageSizeSelectProps>>()
  const [failure, setFailure] = createSignal<unknown>()
  const [loading, setLoading] = createSignal(false)
  const [openRequested, setOpenRequested] = createSignal(false)
  let disposed = false
  let trigger!: HTMLButtonElement
  let mountIntent = { open: false, restore: false }
  onCleanup(() => { disposed = true })
  const open = () => {
    if (props.disabled || loading()) return
    setOpenRequested(true)
    setLoading(true)
    void loadSelect().then(module => {
      if (!disposed) {
        const focused = document.activeElement === trigger
        mountIntent = { open: openRequested() && focused, restore: focused }
        setComponent(() => module.default)
      }
    }).catch(error => { if (!disposed) setFailure(error) })
  }
  const current = () => {
    if (failure()) throw failure()
    return component()
  }
  return (
    <Show when={current()} keyed fallback={
      <button
        ref={trigger}
        type="button"
        class={cn(SELECT_TRIGGER_CLASS, PAGE_SIZE_TRIGGER_CLASS)}
        aria-label={`${t('pagination.rowsPerPage')} ${formatNumber(props.value, language())}`}
        aria-haspopup="listbox"
        aria-expanded={loading() && openRequested()}
        aria-busy={loading()}
        disabled={props.disabled}
        onClick={open}
        onBlur={() => { if (loading()) setOpenRequested(false) }}
        onKeyDown={event => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); open() }
          if (event.key === 'Escape' && loading()) { event.preventDefault(); event.stopPropagation(); setOpenRequested(false) }
        }}
      >
        <span>{formatNumber(props.value, language())}</span>
        <ChevronDown class="h-4 w-4 opacity-50" />
      </button>
    }>
      {SelectComponent => <SelectComponent value={props.value} onChange={props.onChange} disabled={props.disabled} initiallyOpen={mountIntent.open} restoreFocus={mountIntent.restore} />}
    </Show>
  )
}
