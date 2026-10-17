import { render, waitFor, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { beforeEach, expect, it, vi } from 'vitest'
import ReportChart from './ReportChart'
const runtime = vi.hoisted(() => ({ chart: { setOption: vi.fn(), resize: vi.fn(), dispose: vi.fn() }, init: vi.fn() }))
vi.mock('./echarts-runtime', () => ({ init: runtime.init }))
beforeEach(() => { vi.clearAllMocks(); runtime.init.mockReturnValue(runtime.chart) })
it('updates data and theme without remounting; disposes its instance on exit', async () => {
  const [kind, setKind] = createSignal<'bar' | 'pie'>('bar')
  const view = render(() => <ReportChart kind={kind()} label="Revenue" />)
  expect(screen.getByRole('img', { name: 'Revenue' })).toBeInTheDocument()
  await waitFor(() => expect(runtime.init).toHaveBeenCalledTimes(1))
  setKind('pie')
  await waitFor(() => expect(runtime.chart.setOption.mock.calls.at(-1)?.[0].series[0].type).toBe('pie'))
  const before = runtime.chart.setOption.mock.calls.length
  document.documentElement.classList.add('dark')
  await waitFor(() => expect(runtime.chart.setOption.mock.calls.length).toBeGreaterThan(before))
  expect(runtime.init).toHaveBeenCalledTimes(1)
  view.unmount(); expect(runtime.chart.dispose).toHaveBeenCalledTimes(1)
  document.documentElement.classList.remove('dark')
})
it('does not initialize after leaving before the dynamic import resolves', async () => {
  const view = render(() => <ReportChart kind="bar" label="Revenue" />)
  view.unmount()
  await new Promise(resolve => setTimeout(resolve, 0))
  expect(runtime.init).not.toHaveBeenCalled()
})
