import type { TopProducts, SalesByHour } from '@/api/reports'
import { formatNumber, formatTime, formatCurrencyBRL } from '@/i18n/format'
import { formatCents, amountFromCents } from '@/lib/money'

export type ChartKind = 'bar' | 'column' | 'line' | 'pie' | 'hours'
export const REPORT_COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658']
export interface ChartTheme { foreground: string; muted: string; border: string; card: string; font: string }
type ChartTranslationKey = 'others' | 'sales' | 'revenue' | 'salesCount' | 'visualization.pieLabel' | 'tooltip.sales' | 'tooltip.revenue' | 'tooltip.details' | 'tooltip.more' | 'tooltip.label'
type Translate = (key: ChartTranslationKey, options?: Record<string, unknown>) => string
interface TooltipPoint { dataIndex: number; seriesIndex: number }
export function readChartTheme(element: HTMLElement): ChartTheme {
  const style = getComputedStyle(element)
  const color = (token: string) => `hsl(${style.getPropertyValue(token).trim().replace(/\s+/g, ', ')})`
  return { foreground: color('--foreground'), muted: color('--muted-foreground'), border: color('--border'), card: color('--card'), font: style.fontFamily }
}
export function buildReportChartOptions(kind: ChartKind, top: TopProducts | undefined, hourly: SalesByHour | undefined, theme: ChartTheme, locale: string, t: Translate) {
  const rows = [...(top?.products ?? []), ...(top?.others && (top.others.quantity || top.others.revenueCents) ? [{ name: t('others'), ...top.others }] : [])]
  const hours = hourly?.hours ?? []
  const names = kind === 'hours' ? hours.map(row => `${String(row.hour).padStart(2, '0')}:00`) : rows.map(row => row.name)
  const quantities = kind === 'hours' ? hours.map(row => row.salesCount) : rows.map(row => row.quantity)
  const revenue = rows.map(row => amountFromCents(row.revenueCents))
  const number = (value: number) => formatNumber(value, locale)
  const money = (value: number) => formatCents(value, locale)
  const series = kind === 'pie'
    ? [{ name: t('sales'), type: 'pie' as const, radius: 150, center: ['50%', '44%'], labelLine: { show: false }, label: { formatter: (point: { name: string; percent?: number }) => t('visualization.pieLabel', { name: point.name, value: formatNumber((point.percent ?? 0) / 100, locale, { style: 'percent', maximumFractionDigits: 0 }) }) }, data: rows.map(row => ({ name: row.name, value: row.quantity })) }]
    : kind === 'line'
      ? [{ name: t('revenue'), type: 'line' as const, smooth: true, data: revenue, itemStyle: { color: '#8884d8' } }, { name: t('salesCount'), type: 'line' as const, smooth: true, data: quantities, itemStyle: { color: '#82ca9d' } }]
      : [{ name: t(kind === 'bar' ? 'revenue' : 'sales'), type: 'bar' as const, data: kind === 'bar' ? revenue : quantities, itemStyle: { color: kind === 'bar' ? '#8884d8' : '#82ca9d' } }]
  // richText is drawn by the renderer: API text never becomes HTML.
  const formatter = (input: TooltipPoint | TooltipPoint[]) => {
    const point = Array.isArray(input) ? input[0] : input
    if (!point) return ''
    const index = point.dataIndex
    if (kind === 'hours') {
      const hour = hours[index]
      if (!hour) return ''
      const sales = (hourly?.sales ?? []).filter(sale => (new Date(sale.soldAt).getUTCHours() + 21) % 24 === hour.hour)
      return [names[index], `${t('tooltip.label', { label: t('tooltip.sales') })} ${number(hour.salesCount)}`, `${t('tooltip.label', { label: t('tooltip.revenue') })} ${money(hour.revenueCents)}`,
        ...(sales.length ? [t('tooltip.details'), ...sales.slice(0, 5).map(sale => `${formatTime(sale.soldAt, locale)}  ${money(sale.totalCents)}${sale.customerName ? `\n${sale.customerName}` : ''}`)] : []),
        ...(sales.length > 5 ? [t('tooltip.more', { count: number(sales.length - 5) })] : []),
      ].join('\n')
    }
    const row = rows[index]
    if (!row) return ''
    return [row.name, ...(kind === 'bar' || kind === 'line' ? [`${t('revenue')}: ${money(row.revenueCents)}`] : []), ...(kind !== 'bar' ? [`${t('sales')}: ${number(row.quantity)}`] : [])].join('\n')
  }
  const category = { type: 'category' as const, data: names, axisLabel: { color: theme.muted }, axisLine: { lineStyle: { color: theme.border } }, axisTick: { show: false } }
  const value = { type: 'value' as const, minInterval: kind === 'bar' || kind === 'line' ? undefined : 1, axisLabel: { color: theme.muted, formatter: kind === 'bar' ? (value: number) => formatCurrencyBRL(value, locale) : number }, splitLine: { lineStyle: { color: theme.border, type: 'dashed' as const } } }
  return {
    animation: false, color: REPORT_COLORS, textStyle: { color: theme.foreground, fontFamily: theme.font, fontSize: 12 },
    tooltip: { trigger: kind === 'pie' ? 'item' as const : 'axis' as const, renderMode: 'richText' as const, confine: true, backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1, borderRadius: 8, padding: 12, textStyle: { color: theme.foreground, fontFamily: theme.font }, shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.15)', formatter },
    legend: { bottom: 0, textStyle: { color: theme.muted, fontFamily: theme.font } },
    ...(kind === 'pie' ? {} : { grid: { top: 20, right: 30, left: kind === 'bar' ? 140 : 60, bottom: 50 }, xAxis: kind === 'bar' ? value : category, yAxis: kind === 'bar' ? { ...category, inverse: true } : value }),
    series,
  }
}
