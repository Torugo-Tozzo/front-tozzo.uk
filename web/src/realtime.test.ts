import { QueryClient } from '@tanstack/solid-query'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { BACKOFF_MS, HIDDEN_PAUSE_MS, startRealtime, type RealtimeDeps } from './realtime'

class FakeStream {
  onopen: (() => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: (() => void) | null = null
  closed = false
  constructor(readonly url: string) {}
  close() { this.closed = true }
  open() { this.onopen?.() }
  emit(data: unknown) { this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(data) })) }
  fail() { this.onerror?.() }
}

function setup() {
  const streams: FakeStream[] = []
  let ticketCount = 0
  const listeners = new Set<() => void>()
  const doc = {
    hidden: false,
    addEventListener: (_: string, listener: () => void) => { listeners.add(listener) },
    removeEventListener: (_: string, listener: () => void) => { listeners.delete(listener) },
  }
  const deps: Partial<RealtimeDeps> = {
    createTicket: vi.fn(async () => `t${++ticketCount}`),
    openStream: (url) => {
      const stream = new FakeStream(url)
      streams.push(stream)
      return stream as unknown as EventSource
    },
    document: doc as unknown as RealtimeDeps['document'],
  }
  const client = new QueryClient()
  const invalidate = vi.spyOn(client, 'invalidateQueries')
  const setHidden = (hidden: boolean) => {
    doc.hidden = hidden
    for (const listener of listeners) listener()
  }
  const keys = () => invalidate.mock.calls.map(([filters]) => (filters as { queryKey: string[] }).queryKey[0])
  return { streams, deps, client, invalidate, keys, setHidden, tickets: () => ticketCount, listeners }
}

describe('realtime', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  test('opens the stream with a fresh ticket and maps events to query keys', async () => {
    const ctx = setup()
    const stop = startRealtime(ctx.client, ctx.deps)
    await vi.advanceTimersByTimeAsync(0)

    expect(ctx.streams).toHaveLength(1)
    expect(ctx.streams[0].url).toMatch(/\/v1\/events\?ticket=t1$/)
    ctx.streams[0].open()
    ctx.streams[0].emit({ type: 'connected' })
    expect(ctx.keys()).toEqual([])

    ctx.streams[0].emit({ type: 'order.changed', id: 'o1' })
    expect(ctx.keys()).toEqual(['orders', 'kitchen', 'delivery'])
    ctx.invalidate.mockClear()
    ctx.streams[0].emit({ type: 'sale.changed', id: 's1' })
    ctx.streams[0].emit({ type: 'service.changed', id: 'v1' })
    ctx.streams[0].emit({ type: 'service-order.changed', id: 'so1' })
    expect(ctx.keys()).toEqual(['sales', 'reports', 'services', 'service-orders', 'sales'])
    stop()
  })

  test('reconnects with backoff 1, 2, 5, 10 and 30 s, each time with a new ticket', async () => {
    const ctx = setup()
    const stop = startRealtime(ctx.client, ctx.deps)
    await vi.advanceTimersByTimeAsync(0)

    for (const [index, delay] of [...BACKOFF_MS, 30_000].entries()) {
      ctx.streams.at(-1)!.fail()
      expect(ctx.streams.at(-1)!.closed).toBe(true)
      await vi.advanceTimersByTimeAsync(delay - 1)
      expect(ctx.streams).toHaveLength(index + 1)
      await vi.advanceTimersByTimeAsync(1)
      expect(ctx.streams).toHaveLength(index + 2)
      expect(ctx.streams.at(-1)!.url).toMatch(new RegExp(`ticket=t${index + 2}$`))
    }
    stop()
  })

  test('a successful reconnect resets the backoff and reloads every realtime query', async () => {
    const ctx = setup()
    const stop = startRealtime(ctx.client, ctx.deps)
    await vi.advanceTimersByTimeAsync(0)
    ctx.streams[0].open()
    ctx.streams[0].fail()
    await vi.advanceTimersByTimeAsync(1_000)
    ctx.streams[1].open()
    expect(new Set(ctx.keys())).toEqual(new Set(['orders', 'kitchen', 'delivery', 'sales', 'reports', 'services', 'service-orders']))

    ctx.streams[1].fail()
    await vi.advanceTimersByTimeAsync(1_000)
    expect(ctx.streams).toHaveLength(3)
    stop()
  })

  test('a failed ticket request also backs off', async () => {
    const ctx = setup()
    ;(ctx.deps.createTicket as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('offline'))
    const stop = startRealtime(ctx.client, ctx.deps)
    await vi.advanceTimersByTimeAsync(0)
    expect(ctx.streams).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(1_000)
    expect(ctx.streams).toHaveLength(1)
    stop()
  })

  test('pauses after 5 minutes hidden and resumes with a new ticket when visible', async () => {
    const ctx = setup()
    const stop = startRealtime(ctx.client, ctx.deps)
    await vi.advanceTimersByTimeAsync(0)
    ctx.streams[0].open()

    ctx.setHidden(true)
    await vi.advanceTimersByTimeAsync(HIDDEN_PAUSE_MS - 1)
    expect(ctx.streams[0].closed).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(ctx.streams[0].closed).toBe(true)

    await vi.advanceTimersByTimeAsync(60_000)
    expect(ctx.streams).toHaveLength(1)

    ctx.setHidden(false)
    await vi.advanceTimersByTimeAsync(0)
    expect(ctx.streams).toHaveLength(2)
    expect(ctx.streams[1].url).toMatch(/ticket=t2$/)
    stop()
  })

  test('a short hide does not pause', async () => {
    const ctx = setup()
    const stop = startRealtime(ctx.client, ctx.deps)
    await vi.advanceTimersByTimeAsync(0)
    ctx.setHidden(true)
    await vi.advanceTimersByTimeAsync(HIDDEN_PAUSE_MS / 2)
    ctx.setHidden(false)
    await vi.advanceTimersByTimeAsync(HIDDEN_PAUSE_MS)
    expect(ctx.streams).toHaveLength(1)
    expect(ctx.streams[0].closed).toBe(false)
    stop()
  })

  test('stop closes the stream, cancels retries and removes the listener', async () => {
    const ctx = setup()
    const stop = startRealtime(ctx.client, ctx.deps)
    await vi.advanceTimersByTimeAsync(0)
    ctx.streams[0].fail()
    stop()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(ctx.streams).toHaveLength(1)
    expect(ctx.listeners.size).toBe(0)
  })
})
