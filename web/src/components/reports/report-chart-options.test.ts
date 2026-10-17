import { expect, it } from 'vitest'
import { buildReportChartOptions, REPORT_COLORS } from './report-chart-options'
const theme = { foreground: '#111', muted: '#666', border: '#ddd', card: '#fff', font: 'Arial' }
const top = { products: [{ id: 'p1', name: '<script>bad</script>', quantity: 4, revenueCents: 12345 }], others: { quantity: 2, revenueCents: 1000 }, totals: { revenueCents: 13345, units: 6, salesCount: 2 } }
const translate = (key: string) => key
it('formats revenue for plotting, quantities for columns/pie and the exact React palette', () => {
  expect(REPORT_COLORS).toEqual(['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'])
  const bar = buildReportChartOptions('bar', top, undefined, theme, 'en', translate)
  expect(bar.series[0].data).toEqual([123.45, 10])
  expect('itemStyle' in bar.series[0] && bar.series[0].itemStyle.color).toBe('#8884d8')
  expect(buildReportChartOptions('column', top, undefined, theme, 'en', translate).series[0].data).toEqual([4, 2])
  expect(buildReportChartOptions('pie', top, undefined, theme, 'en', translate).series[0].data).toEqual([{ name: '<script>bad</script>', value: 4 }, { name: 'others', value: 2 }])
  expect(buildReportChartOptions('line', top, undefined, theme, 'en', translate).series).toHaveLength(2)
})
it('uses rich text tooltips and theme tokens without interpolating API names into HTML', () => {
  const option = buildReportChartOptions('bar', top, undefined, theme, 'en', translate)
  expect(option.tooltip.renderMode).toBe('richText')
  expect(option.tooltip.backgroundColor).toBe(theme.card)
  expect(option.textStyle.fontFamily).toBe(theme.font)
  const text = option.tooltip.formatter([{ dataIndex: 0, seriesIndex: 0 }])
  expect(text).toContain('<script>bad</script>')
  expect(text).toMatch(/123.45/)
})
it('renders 24 hourly aggregates and safe sale details with the Brazilian offset', () => {
  const hours = { hours: Array.from({ length: 24 }, (_, hour) => ({ hour, salesCount: hour === 23 ? 1 : 0, revenueCents: hour === 23 ? 12345 : 0 })), sales: [{ id: 's1', customerName: '<img src=x>', soldAt: '2026-10-02T02:30:00Z', totalCents: 12345 }] }
  const option = buildReportChartOptions('hours', undefined, hours, theme, 'en', translate)
  expect(option.series[0].data).toHaveLength(24)
  expect(option.tooltip.formatter([{ dataIndex: 23, seriesIndex: 0 }])).toContain('<img src=x>')
})

it('plots revenue and sales on the same scale as React, never treating cents as reais', () => {
  const line = buildReportChartOptions('line', top, undefined, theme, 'en', translate)
  expect(line.series[0].data).toEqual([123.45, 10])
  expect(line.series[1].data).toEqual([4, 2])
})
