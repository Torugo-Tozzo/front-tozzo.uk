import { createRoot } from 'solid-js'
import { afterEach, expect, it, vi } from 'vitest'
import { QueryClient } from '@tanstack/solid-query'
import { createReportExportController } from './create-report-export'

const pending = { id: 'job', status: 'pending' as const }
const done = { id: 'job', status: 'done' as const, downloadUrl: 'https://files.example.test/report.xlsx' }
afterEach(() => vi.useRealTimers())
function setup(get = vi.fn().mockResolvedValue(done), post = vi.fn().mockResolvedValue(pending)) {
  let dispose = () => {}
  const download = vi.fn()
  const controller = createRoot(d => { dispose = d; return createReportExportController(new QueryClient(), { post, get, download }) })
  return { controller, dispose, download, get, post }
}
it('polls after 2 seconds and downloads directly once while blocking duplicate starts', async () => {
  vi.useFakeTimers()
  const { controller, dispose, download, post, get } = setup()
  controller.start({ format: 'xlsx' }); controller.start({ format: 'pdf' })
  await vi.advanceTimersByTimeAsync(1999)
  expect(post).toHaveBeenCalledTimes(1); expect(get).not.toHaveBeenCalled(); expect(controller.format()).toBe('xlsx')
  await vi.advanceTimersByTimeAsync(1)
  expect(download).toHaveBeenCalledExactlyOnceWith(done.downloadUrl)
  expect(controller.format()).toBeNull(); dispose()
})
it.each(['pending', 'stalled'] as const)('stops at 120 seconds for a %s response', async mode => {
  vi.useFakeTimers()
  const { controller, dispose, download } = setup(mode === 'stalled' ? vi.fn(() => new Promise(() => {})) : vi.fn().mockResolvedValue(pending))
  controller.start({ format: 'pdf' })
  await vi.advanceTimersByTimeAsync(120_000)
  expect(controller.error()).toBe('timeout'); expect(controller.format()).toBeNull(); expect(download).not.toHaveBeenCalled(); dispose()
})
it.each([{ id: 'job', status: 'failed', error: 'REPORT_GENERATION_FAILED' }, { id: 'job', status: 'done' }, { ...done, downloadUrl: 'javascript:alert(1)' }])('shows a failure for an unusable final response %#', async response => {
  vi.useFakeTimers()
  const { controller, dispose, download } = setup(vi.fn().mockResolvedValue(response))
  controller.start({ format: 'pdf' }); await vi.advanceTimersByTimeAsync(2000)
  expect(controller.error()).toBeTruthy(); expect(controller.format()).toBeNull(); expect(download).not.toHaveBeenCalled(); dispose()
})
it('ignores a late POST after disposal and aborts its signal', async () => {
  vi.useFakeTimers()
  let answer!: (value: typeof pending) => void
  const post = vi.fn((_body: unknown, _signal: AbortSignal) => new Promise<typeof pending>(resolve => { answer = resolve }))
  const { controller, dispose, download, get } = setup(undefined, post)
  controller.start({ format: 'pdf' }); await Promise.resolve(); dispose()
  answer(pending); await vi.advanceTimersByTimeAsync(10_000)
  expect(post.mock.calls[0][1].aborted).toBe(true); expect(get).not.toHaveBeenCalled(); expect(download).not.toHaveBeenCalled()
})
it('preserves a code from a failed creation without retrying the POST', async () => {
  vi.useFakeTimers()
  const { controller, dispose, post } = setup(undefined, vi.fn().mockRejectedValue({ code: 'NOT_READY' }))
  controller.start({ format: 'pdf' }); await vi.advanceTimersByTimeAsync(0)
  expect(controller.error()).toBe('startFailed'); expect(controller.failure()).toEqual({ code: 'NOT_READY' }); expect(post).toHaveBeenCalledTimes(1); dispose()
})

it('releases the controls when the creation POST itself never resolves', async () => {
  vi.useFakeTimers()
  const { controller, dispose, download } = setup(undefined, vi.fn(() => new Promise(() => {})))
  controller.start({ format: 'pdf' })
  await vi.advanceTimersByTimeAsync(120_000)
  expect(controller.error()).toBe('timeout'); expect(controller.format()).toBeNull(); expect(download).not.toHaveBeenCalled(); dispose()
})
it('ignores a GET that finishes after leaving the page', async () => {
  vi.useFakeTimers()
  let answer!: (value: typeof done) => void
  const { controller, dispose, download } = setup(vi.fn(() => new Promise(resolve => { answer = resolve })))
  controller.start({ format: 'pdf' }); await vi.advanceTimersByTimeAsync(2000)
  dispose(); answer(done); await vi.advanceTimersByTimeAsync(0)
  expect(download).not.toHaveBeenCalled()
})
