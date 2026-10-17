import { createEffect, createSignal, onCleanup, onMount } from 'solid-js'
import type { EChartsType } from 'echarts/core'
import type { TopProducts, SalesByHour } from '@/api/reports'
import { useTranslation } from '@/i18n/solid'
import { buildReportChartOptions, readChartTheme, type ChartKind } from './report-chart-options'

export default function ReportChart(props: { kind: ChartKind; top?: TopProducts; hourly?: SalesByHour; label: string }) {
  const { t, language } = useTranslation('charts')
  const { t: tErrors } = useTranslation('errors')
  let element!: HTMLDivElement
  let instance: EChartsType | undefined
  let disposed = false
  const [revision, setRevision] = createSignal(0)
  const [ready, setReady] = createSignal(false)
  const [failed, setFailed] = createSignal(false)
  onMount(() => {
    const observer = new MutationObserver(() => setRevision(value => value + 1))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] })
    const resize = new ResizeObserver(() => instance?.resize())
    resize.observe(element)
    onCleanup(() => { observer.disconnect(); resize.disconnect() })
    void import('./echarts-runtime').then(runtime => {
      if (disposed) return
      instance = runtime.init(element, undefined, { renderer: 'svg' })
      setReady(true)
    }).catch(() => { if (!disposed) setFailed(true) })
  })
  createEffect(() => {
    revision()
    const option = buildReportChartOptions(props.kind, props.top, props.hourly, readChartTheme(element), language(), t)
    if (ready()) instance?.setOption(option, { notMerge: true })
  })
  onCleanup(() => { disposed = true; instance?.dispose() })
  return <div class="relative h-[400px] w-full" data-report-chart>
    <div ref={element} class="h-full w-full" role="img" aria-label={props.label} />
    {failed() && <p role="alert" class="absolute inset-0 flex items-center justify-center text-muted-foreground">{tErrors('generic')}</p>}
  </div>
}
