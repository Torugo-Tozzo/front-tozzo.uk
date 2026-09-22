import { describe, it, expect, vi, beforeEach, afterEach, mock } from 'bun:test'
import { renderHook, waitFor } from '@testing-library/react'
import api from '@/services/api'
import { replaceProperty } from '@/test/replace-property'

type FakeConnection = {
  url: string
  opts: any
  settled: boolean
  resolve: () => void
  reject: (err: unknown) => void
}

const connections: FakeConnection[] = []

mock.module('@microsoft/fetch-event-source', () => ({
  EventStreamContentType: 'text/event-stream',
  fetchEventSource: (url: string, opts: any) => new Promise<void>((resolve, reject) => {
    const connection: FakeConnection = {
      url,
      opts,
      settled: false,
      resolve: () => { connection.settled = true; resolve() },
      reject: (err) => { connection.settled = true; reject(err) },
    }
    connections.push(connection)
    // Mesmo contrato da lib: abortar o signal resolve a promise.
    opts.signal.addEventListener('abort', () => connection.resolve(), { once: true })
  }),
}))

const { useRealtimeEvents, HIDDEN_GRACE_MS } = await import('./useRealtimeEvents')

const live = () => connections.filter((c) => !c.opts.signal.aborted)

async function open(connection: FakeConnection) {
  await connection.opts.onopen(new Response('', { status: 200, headers: { 'content-type': 'text/event-stream' } }))
}

function emit(connection: FakeConnection, data: unknown) {
  connection.opts.onmessage({ data: JSON.stringify(data), event: '', id: '' })
}

function fail(connection: FakeConnection) {
  try {
    connection.opts.onerror(new Error('network down'))
  } catch (err) {
    connection.reject(err)
  }
}

async function flush() {
  for (let i = 0; i < 5; i++) await Promise.resolve()
}

function setHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
  document.dispatchEvent(new Event('visibilitychange'))
}

let postMock: ReturnType<typeof vi.fn>
let restorePost: (() => void) | undefined
let tokenCount = 0

describe('useRealtimeEvents', () => {
  beforeEach(() => {
    connections.length = 0
    tokenCount = 0
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })
    postMock = vi.fn().mockImplementation(async () => ({ data: { token: `token-${++tokenCount}` } }))
    restorePost = replaceProperty(api, 'post', postMock as unknown as typeof api.post)
  })

  afterEach(() => {
    restorePost?.()
    restorePost = undefined
    vi.useRealTimers()
  })

  it('conecta com o token mintado e chama onEvent so pro tipo pedido', async () => {
    const onEvent = vi.fn()
    const { unmount } = renderHook(() => useRealtimeEvents(['orders'], onEvent))

    await waitFor(() => expect(connections).toHaveLength(1))
    const connection = connections[0]
    expect(connection.url).toContain('/events?token=token-1')
    await open(connection)

    emit(connection, { tipo: 'pedidos' })
    expect(onEvent).toHaveBeenCalledWith('orders')

    emit(connection, { tipo: 'vendas' })
    expect(onEvent).toHaveBeenCalledTimes(1)

    emit(connection, { tipo: 'connected' })
    expect(onEvent).toHaveBeenCalledTimes(1)
    unmount()
  })

  it('aborta a conexao no unmount', async () => {
    const { unmount } = renderHook(() => useRealtimeEvents(['orders'], vi.fn()))

    await waitFor(() => expect(connections).toHaveLength(1))
    unmount()

    expect(connections[0].opts.signal.aborted).toBe(true)
    expect(connections[0].settled).toBe(true)
  })

  it('nao deixa conexao orfa quando o efeito desmonta e remonta antes do token chegar (StrictMode)', async () => {
    // Regressão: com EventSource nativa e flag global, as duas chamadas de
    // connect() abriam conexão e a primeira ficava aberta pra sempre.
    const pending: Array<(token: string) => void> = []
    postMock.mockImplementation(() => new Promise((resolve) => {
      pending.push((token) => resolve({ data: { token } }))
    }))

    const first = renderHook(() => useRealtimeEvents(['orders'], vi.fn()))
    first.unmount()
    const second = renderHook(() => useRealtimeEvents(['orders'], vi.fn()))

    expect(pending).toHaveLength(2)
    pending[0]('token-stale')
    pending[1]('token-fresh')
    await flush()

    expect(connections).toHaveLength(1)
    expect(connections[0].url).toContain('token-fresh')
    expect(live()).toHaveLength(1)

    second.unmount()
    expect(live()).toHaveLength(0)
  })

  it('compartilha uma unica conexao entre varios hooks na mesma aba', async () => {
    const onEventA = vi.fn()
    const onEventB = vi.fn()
    const hookA = renderHook(() => useRealtimeEvents(['orders'], onEventA))
    const hookB = renderHook(() => useRealtimeEvents(['orders'], onEventB))

    await waitFor(() => expect(connections).toHaveLength(1))
    const connection = connections[0]
    await open(connection)

    emit(connection, { tipo: 'pedidos' })
    expect(onEventA).toHaveBeenCalledWith('orders')
    expect(onEventB).toHaveBeenCalledWith('orders')

    hookA.unmount()
    expect(connection.opts.signal.aborted).toBe(false)

    hookB.unmount()
    expect(connection.opts.signal.aborted).toBe(true)
  })

  it('em erro, minta token novo e reconecta (a lib sozinha reusaria o token vencido) e avisa quem escuta', async () => {
    vi.useFakeTimers()
    const onEvent = vi.fn()
    const { unmount } = renderHook(() => useRealtimeEvents(['orders'], onEvent))
    await flush()
    expect(connections).toHaveLength(1)
    await open(connections[0])

    fail(connections[0])
    await flush()
    vi.advanceTimersByTime(1000)
    await flush()

    expect(postMock).toHaveBeenCalledTimes(2)
    expect(connections).toHaveLength(2)
    expect(connections[1].url).toContain('token-2')

    // Eventos emitidos enquanto estava desconectado se perderam: recarrega.
    expect(onEvent).not.toHaveBeenCalled()
    await open(connections[1])
    expect(onEvent).toHaveBeenCalledWith('orders')
    unmount()
  })

  it('libera a conexao com a aba escondida e reconecta com token novo ao voltar', async () => {
    vi.useFakeTimers()
    const { unmount } = renderHook(() => useRealtimeEvents(['orders'], vi.fn()))
    await flush()
    expect(connections).toHaveLength(1)

    setHidden(true)
    vi.advanceTimersByTime(HIDDEN_GRACE_MS - 1)
    expect(connections[0].opts.signal.aborted).toBe(false)
    vi.advanceTimersByTime(1)
    expect(connections[0].opts.signal.aborted).toBe(true)

    setHidden(false)
    await flush()
    expect(connections).toHaveLength(2)
    expect(connections[1].url).toContain('token-2')
    expect(live()).toHaveLength(1)
    unmount()
  })

  it('troca rapida de aba nao derruba a conexao', async () => {
    vi.useFakeTimers()
    const { unmount } = renderHook(() => useRealtimeEvents(['orders'], vi.fn()))
    await flush()

    setHidden(true)
    vi.advanceTimersByTime(5_000)
    setHidden(false)
    vi.advanceTimersByTime(HIDDEN_GRACE_MS)
    await flush()

    expect(connections).toHaveLength(1)
    expect(connections[0].opts.signal.aborted).toBe(false)
    unmount()
  })
})
