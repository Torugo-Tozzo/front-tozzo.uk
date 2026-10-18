import { createSignal, onCleanup } from 'solid-js'
import type { QueryClient } from '@tanstack/solid-query'
import { createReportExport, getReportExport, reportKeys, type ReportExport, type ReportExportRequest } from '@/api/reports'

type ExportError = 'timeout' | 'generationFailed' | 'readyWithoutUrl' | 'invalidResponse' | 'startFailed' | 'pollingFailed'
interface Dependencies {
  post: (body: ReportExportRequest, signal: AbortSignal) => Promise<ReportExport>
  get: (id: string, signal: AbortSignal) => Promise<ReportExport>
  download: (url: string) => void
}
export function downloadReport(url: string) {
  const link = document.createElement('a')
  link.href = url
  link.rel = 'noopener noreferrer'
  link.download = ''
  document.body.appendChild(link)
  link.click()
  link.remove()
}

/** One export at a time; its absolute deadline also covers a hung POST/GET. */
export function createReportExportController(client: QueryClient, overrides: Partial<Dependencies> = {}) {
  const deps: Dependencies = { post: createReportExport, get: getReportExport, download: downloadReport, ...overrides }
  const [format, setFormat] = createSignal<ReportExportRequest['format'] | null>(null)
  const [error, setError] = createSignal<ExportError | null>(null)
  const [failure, setFailure] = createSignal<unknown>(null)
  let disposed = false
  let generation = 0
  let abort: AbortController | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  let deadline: ReturnType<typeof setTimeout> | undefined
  let queryKey: readonly unknown[] | undefined
  const stop = () => {
    generation++
    clearTimeout(timer); clearTimeout(deadline)
    abort?.abort()
    if (queryKey) void client.cancelQueries({ queryKey, exact: true })
    queryKey = undefined
    setFormat(null)
  }
  onCleanup(() => { disposed = true; stop() })
  const start = (body: ReportExportRequest) => {
    if (disposed || format()) return
    setError(null); setFailure(null); setFormat(body.format)
    abort = new AbortController()
    const requestAbort = abort
    const current = ++generation
    const active = () => !disposed && generation === current
    const fail = (message: ExportError, cause?: unknown) => {
      if (!active()) return
      setError(message); setFailure(() => cause); stop()
    }
    deadline = setTimeout(() => fail('timeout'), 120_000)
    const receive = (result: ReportExport) => {
      if (!active()) return
      if (result.status === 'failed') { fail('generationFailed'); return }
      if (result.status === 'done') {
        if (!result.downloadUrl) { fail('readyWithoutUrl'); return }
        let url: URL
        try { url = new URL(result.downloadUrl) } catch { fail('invalidResponse'); return }
        if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) { fail('invalidResponse'); return }
        try { deps.download(url.href); stop() } catch (cause) { fail('invalidResponse', cause) }
        return
      }
      if (result.status !== 'pending' || !result.id) { fail('invalidResponse'); return }
      const id = result.id
      queryKey = [...reportKeys.all, 'export', id]
      timer = setTimeout(async () => {
        try {
          receive(await client.fetchQuery({
            queryKey: queryKey!, staleTime: 0, retry: false,
            queryFn: ({ signal }) => deps.get(id, AbortSignal.any([signal, requestAbort.signal])),
          }))
        } catch (cause) { fail('pollingFailed', cause) }
      }, 2000)
    }
    const mutation = client.getMutationCache().build(client, {
      mutationKey: [...reportKeys.all, 'export'], retry: false,
      mutationFn: (input: ReportExportRequest) => deps.post(input, requestAbort.signal),
    })
    void mutation.execute({ ...body }).then(receive, cause => fail('startFailed', cause))
  }
  return { start, format, error, failure }
}
