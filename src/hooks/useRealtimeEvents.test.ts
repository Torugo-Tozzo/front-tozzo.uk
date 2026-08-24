import { describe, it, expect, vi, beforeEach, afterEach } from 'bun:test'
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
    renderHook(() => useRealtimeEvents(['orders'], onEvent))

    await waitFor(() => expect(FakeEventSource.instances).toHaveLength(1))
    const es = FakeEventSource.instances[0]
    expect(es.url).toContain('/events?token=fake-token')

    es.emit({ tipo: 'pedidos' })
    expect(onEvent).toHaveBeenCalledWith('orders')

    es.emit({ tipo: 'vendas' })
    expect(onEvent).toHaveBeenCalledTimes(1)

    es.emit({ tipo: 'connected' })
    expect(onEvent).toHaveBeenCalledTimes(1)
  })

  it('fecha a conexao no unmount', async () => {
    const onEvent = vi.fn()
    const { unmount } = renderHook(() => useRealtimeEvents(['orders'], onEvent))

    await waitFor(() => expect(FakeEventSource.instances).toHaveLength(1))
    const es = FakeEventSource.instances[0]

    unmount()
    expect(es.closed).toBe(true)
  })

  it('renova a conexao proativamente antes do token expirar (~4min)', async () => {
    vi.useFakeTimers()
    const onEvent = vi.fn()
    renderHook(() => useRealtimeEvents(['orders'], onEvent))

    // bun:test nao tem advanceTimersByTimeAsync - avanca sync e da 1 volta
    // no microtask queue pra deixar a promise de connect() (getSseToken) resolver.
    vi.advanceTimersByTime(0)
    await Promise.resolve()
    await Promise.resolve()
    expect(FakeEventSource.instances).toHaveLength(1)
    const first = FakeEventSource.instances[0]

    vi.advanceTimersByTime(4 * 60 * 1000)
    await Promise.resolve()
    await Promise.resolve()
    expect(first.closed).toBe(true)
    expect(FakeEventSource.instances).toHaveLength(2)
  })

  it('compartilha uma unica EventSource entre varios hooks na mesma aba', async () => {
    const onEventA = vi.fn()
    const onEventB = vi.fn()
    const hookA = renderHook(() => useRealtimeEvents(['orders'], onEventA))
    const hookB = renderHook(() => useRealtimeEvents(['orders'], onEventB))

    await waitFor(() => expect(FakeEventSource.instances).toHaveLength(1))
    const es = FakeEventSource.instances[0]

    es.emit({ tipo: 'pedidos' })
    expect(onEventA).toHaveBeenCalledWith('orders')
    expect(onEventB).toHaveBeenCalledWith('orders')

    hookA.unmount()
    expect(es.closed).toBe(false)

    hookB.unmount()
    expect(es.closed).toBe(true)
  })
})
