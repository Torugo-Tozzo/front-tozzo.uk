import type { QueryClient } from '@tanstack/solid-query'

import { api } from '@/api/client'
import { unwrap } from '@/api/errors'
import { API_URL } from '@/api/session'

// The only place that opens an EventSource (CONVENTIONS: "Tempo real").
// Events carry no data: each one marks queries stale and they reload through the API.
export const EVENT_QUERY_KEYS: Record<string, readonly string[]> = {
  'order.changed': ['orders', 'kitchen', 'delivery'],
  'sale.changed': ['sales', 'reports'],
  'service.changed': ['services'],
  'service-order.changed': ['service-orders', 'sales'],
}
const ALL_KEYS = [...new Set(Object.values(EVENT_QUERY_KEYS).flat())]

export const BACKOFF_MS = [1_000, 2_000, 5_000, 10_000, 30_000] as const
export const HIDDEN_PAUSE_MS = 5 * 60_000

export interface RealtimeDeps {
  createTicket: (signal?: AbortSignal) => Promise<string>
  openStream: (url: string) => EventSource
  document: Pick<Document, 'hidden' | 'addEventListener' | 'removeEventListener'>
}

const defaultDeps = (): RealtimeDeps => ({
  createTicket: async (signal) => unwrap(await api.POST('/v1/events/ticket', { signal })).ticket,
  openStream: (url) => new EventSource(url),
  document,
})

/**
 * Keeps one event stream open while the user is signed in:
 * 1. POST /v1/events/ticket, then EventSource(`/v1/events?ticket=…`);
 * 2. on error, closes and reconnects after 1, 2, 5, 10 and 30 s, always with a new ticket;
 * 3. each event invalidates the queries in EVENT_QUERY_KEYS;
 * 4. pauses when the tab stays hidden for 5 minutes and resumes when it comes back.
 * After a reconnect or a pause, every realtime query is invalidated: events may
 * have been missed. Returns the function that stops it.
 */
export function startRealtime(queryClient: QueryClient, overrides: Partial<RealtimeDeps> = {}): () => void {
  const deps = { ...defaultDeps(), ...overrides }
  let source: EventSource | null = null
  let retryTimer: ReturnType<typeof setTimeout> | undefined
  let hiddenTimer: ReturnType<typeof setTimeout> | undefined
  let ticketAbort: AbortController | null = null
  let attempt = 0
  let stopped = false
  let paused = false
  let hadConnection = false

  const invalidate = (keys: readonly string[]) => {
    for (const key of keys) void queryClient.invalidateQueries({ queryKey: [key] })
  }

  const disconnect = () => {
    clearTimeout(retryTimer)
    retryTimer = undefined
    ticketAbort?.abort()
    ticketAbort = null
    source?.close()
    source = null
  }

  const scheduleRetry = () => {
    disconnect()
    if (stopped || paused) return
    const delay = BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)]
    attempt += 1
    retryTimer = setTimeout(() => void connect(), delay)
  }

  const connect = async () => {
    if (stopped || paused) return
    disconnect()
    const abort = new AbortController()
    ticketAbort = abort
    let ticket: string
    try {
      ticket = await deps.createTicket(abort.signal)
    } catch {
      if (!abort.signal.aborted) scheduleRetry()
      return
    }
    if (abort.signal.aborted || stopped || paused) return
    ticketAbort = null

    const stream = deps.openStream(`${API_URL}/v1/events?ticket=${encodeURIComponent(ticket)}`)
    source = stream
    stream.onopen = () => {
      attempt = 0
      if (hadConnection) invalidate(ALL_KEYS)
      hadConnection = true
    }
    stream.onmessage = (message: MessageEvent) => {
      let event: { type?: unknown }
      try {
        event = JSON.parse(String(message.data)) as { type?: unknown }
      } catch {
        return
      }
      const keys = typeof event.type === 'string' ? EVENT_QUERY_KEYS[event.type] : undefined
      if (keys) invalidate(keys)
    }
    stream.onerror = () => {
      if (source === stream) scheduleRetry()
    }
  }

  const onVisibility = () => {
    if (deps.document.hidden) {
      clearTimeout(hiddenTimer)
      hiddenTimer = setTimeout(() => {
        paused = true
        disconnect()
      }, HIDDEN_PAUSE_MS)
      return
    }
    clearTimeout(hiddenTimer)
    if (paused) {
      paused = false
      attempt = 0
      void connect()
    }
  }

  deps.document.addEventListener('visibilitychange', onVisibility)
  void connect()

  return () => {
    stopped = true
    clearTimeout(hiddenTimer)
    deps.document.removeEventListener('visibilitychange', onVisibility)
    disconnect()
  }
}
