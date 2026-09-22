import { useEffect, useRef } from 'react'
import { fetchEventSource, EventStreamContentType } from '@microsoft/fetch-event-source'
import api, { getSseToken } from '@/services/api'
import { normalizeRealtimeEventType } from '@/lib/legacyWire'

export type RealtimeEvent = 'orders' | 'sales'

const ALL_EVENTS: RealtimeEvent[] = ['orders', 'sales']
const MAX_RETRY_DELAY_MS = 30_000
// Aba escondida por mais que isso libera a conexão (limite de ~6 conexões
// HTTP/1.1 por origem, somando todas as abas). Troca rápida de aba não derruba.
export const HIDDEN_GRACE_MS = 30_000

type Listener = (event: RealtimeEvent) => void

// Uma única conexão SSE compartilhada por aba, não uma por chamada do hook.
// Antes cada useRealtimeEvents() abria a sua própria conexão - DashboardLayout
// (badge de pedidos) e PedidosTab, por exemplo, abriam 2 conexões SSE
// separadas pro mesmo 'pedidos' dentro da MESMA aba. Navegador limita ~6
// conexões HTTP/1.1 por origem; com poucas abas do dashboard abertas isso
// estourava o limite e travava requests REST (POST/GET) esperando conexão
// livre - sintoma: ação trava "carregando" pra sempre.
//
// Cada conexão tem o seu AbortController, criado ANTES de esperar o token. Com
// uma flag global (versão anterior, EventSource nativa), o StrictMode
// montava/desmontava/remontava antes do token chegar: a flag voltava pra
// "ativo", as duas conexões abriam e a primeira ficava órfã pra sempre.
let connection: AbortController | null = null
let hiddenTimer: number | null = null
let hasConnectedBefore = false
const listeners = new Set<Listener>()

function notify(event: RealtimeEvent) {
  listeners.forEach((listener) => listener(event))
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve()
    const timer = window.setTimeout(resolve, ms)
    signal.addEventListener('abort', () => { clearTimeout(timer); resolve() }, { once: true })
  })
}

// Loop de uma conexão: cada tentativa minta token novo (o token SSE vale 5min,
// e o retry interno da lib reusaria a URL com o token vencido).
async function run(signal: AbortSignal) {
  let failures = 0
  while (!signal.aborted) {
    try {
      const token = await getSseToken()
      // fetchEventSource com signal já abortado nunca resolve e deixa o fetch
      // pendurado — por isso o check fica logo antes da chamada.
      if (signal.aborted) return

      const base = String(api.defaults.baseURL || '').replace(/\/$/, '')
      await fetchEventSource(`${base}/events?token=${encodeURIComponent(token)}`, {
        signal,
        // Visibilidade é tratada aqui no módulo (com token novo), não pela lib.
        openWhenHidden: true,
        async onopen(response) {
          const contentType = response.headers.get('content-type') ?? ''
          if (!response.ok || !contentType.startsWith(EventStreamContentType)) {
            throw new Error(`SSE open failed: ${response.status}`)
          }
          failures = 0
          // Eventos emitidos enquanto estava desconectado se perderam: quem
          // escuta recarrega.
          if (hasConnectedBefore) ALL_EVENTS.forEach(notify)
          hasConnectedBefore = true
        },
        onmessage(message) {
          if (!message.data) return
          try {
            const payload = JSON.parse(message.data)
            const eventType = normalizeRealtimeEventType(payload?.eventType ?? payload?.type ?? payload?.tipo)
            if (eventType) notify(eventType)
          } catch (err) {
            console.error('[useRealtimeEvents] parse error', err)
          }
        },
        onclose() {
          throw new Error('SSE closed by server')
        },
        onerror(err) {
          // Sem isso a lib tenta de novo sozinha, com o mesmo token.
          throw err
        },
      })
    } catch (err) {
      if (signal.aborted) return
      console.error('[useRealtimeEvents] connection error', err)
    }
    if (signal.aborted) return
    failures += 1
    await sleep(Math.min(MAX_RETRY_DELAY_MS, 1000 * 2 ** (failures - 1)), signal)
  }
}

function openConnection() {
  connection?.abort()
  const controller = new AbortController()
  connection = controller
  void run(controller.signal)
}

function closeConnection() {
  connection?.abort()
  connection = null
}

function clearHiddenTimer() {
  if (hiddenTimer != null) {
    clearTimeout(hiddenTimer)
    hiddenTimer = null
  }
}

function onVisibilityChange() {
  if (document.hidden) {
    clearHiddenTimer()
    hiddenTimer = window.setTimeout(() => {
      hiddenTimer = null
      closeConnection()
    }, HIDDEN_GRACE_MS)
    return
  }
  clearHiddenTimer()
  if (!connection) openConnection()
}

function ensureConnection() {
  if (connection) return
  document.addEventListener('visibilitychange', onVisibilityChange)
  if (!document.hidden) openConnection()
}

function teardownConnection() {
  document.removeEventListener('visibilitychange', onVisibilityChange)
  clearHiddenTimer()
  closeConnection()
  hasConnectedBefore = false
}

export function useRealtimeEvents(events: RealtimeEvent[], onEvent: (event: RealtimeEvent) => void): void {
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent
  const eventsRef = useRef(events)
  eventsRef.current = events

  useEffect(() => {
    const listener: Listener = (event) => {
      if (eventsRef.current.includes(event)) onEventRef.current(event)
    }
    listeners.add(listener)
    ensureConnection()

    return () => {
      listeners.delete(listener)
      if (listeners.size === 0) teardownConnection()
    }
  }, [])
}
