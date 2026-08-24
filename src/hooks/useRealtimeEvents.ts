import { useEffect, useRef } from 'react'
import api, { getSseToken } from '@/services/api'
import { normalizeRealtimeEventType } from '@/lib/legacyWire'

export type RealtimeEvent = 'orders' | 'sales'

const TOKEN_REFRESH_MS = 4 * 60 * 1000 // token expira em 5min — troca antes

type Listener = (event: RealtimeEvent) => void

// Uma unica EventSource compartilhada por aba, nao uma por chamada do hook.
// Antes cada useRealtimeEvents() abria a sua propria conexao - DashboardLayout
// (badge de pedidos) e PedidosTab, por exemplo, abriam 2 conexoes SSE
// separadas pro mesmo 'pedidos' dentro da MESMA aba. Navegador limita ~6
// conexoes HTTP/1.1 por origem; com poucas abas do dashboard abertas isso
// estourava o limite e travava requests REST (POST/GET) esperando conexao
// livre - sintoma: acao trava "carregando" pra sempre.
let sharedEventSource: EventSource | null = null
let refreshTimer: number | null = null
let stopped = true
const listeners = new Set<Listener>()

function notify(event: RealtimeEvent) {
  listeners.forEach((listener) => listener(event))
}

async function connect() {
  if (stopped) return
  try {
    const token = await getSseToken()
    if (stopped) return

    const base = String(api.defaults.baseURL || '').replace(/\/$/, '')
    sharedEventSource = new EventSource(`${base}/events?token=${encodeURIComponent(token)}`)

    sharedEventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data)
        const eventType = normalizeRealtimeEventType(payload?.eventType ?? payload?.type ?? payload?.tipo)
        if (eventType) notify(eventType)
      } catch (err) {
        console.error('[useRealtimeEvents] parse error', err)
      }
    }

    sharedEventSource.onerror = () => {
      console.error('[useRealtimeEvents] connection error')
    }
  } catch (err) {
    console.error('[useRealtimeEvents] failed to mint token', err)
  }
}

function ensureConnection() {
  if (sharedEventSource || refreshTimer != null) return
  stopped = false
  connect()
  refreshTimer = window.setInterval(() => {
    sharedEventSource?.close()
    connect()
  }, TOKEN_REFRESH_MS)
}

function teardownConnection() {
  stopped = true
  if (refreshTimer != null) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
  sharedEventSource?.close()
  sharedEventSource = null
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
