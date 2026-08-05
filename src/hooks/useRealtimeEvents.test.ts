import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useRealtimeEvents } from './useRealtimeEvents'
import api from '@/services/api'

class FakeEventSource {
  static instances: FakeEventSource[] = []
  onmessage: ((event: { data: string }) => void) | null = null
  onerror: (() => void) | null = null
  closed = false
  url: string
  constructor(url: string) {
    this.url = url
    FakeEventSource.instances.push(this)
  }
  close() {
    this.closed = true
  }
  emit(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) })
  }
}

describe('useRealtimeEvents', () => {
  beforeEach(() => {
    FakeEventSource.instances = []
    ;(globalThis as any).EventSource = FakeEventSource
    vi.spyOn(api, 'post').mockResolvedValue({ data: { token: 'fake-token' } } as any)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('abre EventSource com o token mintado e chama onEvent so pro tipo pedido', async () => {
    const onEvent = vi.fn()
    renderHook(() => useRealtimeEvents(['pedidos'], onEvent))

    await waitFor(() => expect(FakeEventSource.instances).toHaveLength(1))
    const es = FakeEventSource.instances[0]
    expect(es.url).toContain('/events?token=fake-token')

    es.emit({ tipo: 'pedidos' })
    expect(onEvent).toHaveBeenCalledWith('pedidos')

    es.emit({ tipo: 'vendas' })
    expect(onEvent).toHaveBeenCalledTimes(1)

    es.emit({ tipo: 'connected' })
    expect(onEvent).toHaveBeenCalledTimes(1)
  })

  it('fecha a conexao no unmount', async () => {
    const onEvent = vi.fn()
    const { unmount } = renderHook(() => useRealtimeEvents(['pedidos'], onEvent))

    await waitFor(() => expect(FakeEventSource.instances).toHaveLength(1))
    const es = FakeEventSource.instances[0]

    unmount()
    expect(es.closed).toBe(true)
  })

  it('renova a conexao proativamente antes do token expirar (~4min)', async () => {
    vi.useFakeTimers()
    const onEvent = vi.fn()
    renderHook(() => useRealtimeEvents(['pedidos'], onEvent))

    await vi.advanceTimersByTimeAsync(0)
    expect(FakeEventSource.instances).toHaveLength(1)
    const first = FakeEventSource.instances[0]

    await vi.advanceTimersByTimeAsync(4 * 60 * 1000)
    expect(first.closed).toBe(true)
    expect(FakeEventSource.instances).toHaveLength(2)
  })
})
