import { useEffect, useRef } from 'react'
import api, { getSseToken } from '@/services/api'

export type RealtimeTipo = 'pedidos' | 'vendas'

const TOKEN_REFRESH_MS = 4 * 60 * 1000 // token expira em 5min — troca antes

export function useRealtimeEvents(tipos: RealtimeTipo[], onEvent: (tipo: RealtimeTipo) => void): void {
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent
  const tiposRef = useRef(tipos)
  tiposRef.current = tipos

  useEffect(() => {
    let stopped = false
    let es: EventSource | null = null
    let refreshTimer: number | null = null

    const connect = async () => {
      if (stopped) return
      try {
        const token = await getSseToken()
        if (stopped) return

        const base = String(api.defaults.baseURL || '').replace(/\/$/, '')
        es = new EventSource(`${base}/events?token=${encodeURIComponent(token)}`)

        es.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data)
            const tipo = payload?.tipo as RealtimeTipo | 'connected' | undefined
            if (tipo && tiposRef.current.includes(tipo as RealtimeTipo)) {
              onEventRef.current(tipo as RealtimeTipo)
            }
          } catch (err) {
            console.error('[useRealtimeEvents] parse error', err)
          }
        }

        es.onerror = () => {
          console.error('[useRealtimeEvents] connection error')
        }
      } catch (err) {
        console.error('[useRealtimeEvents] failed to mint token', err)
      }
    }

    connect()
    refreshTimer = window.setInterval(() => {
      es?.close()
      connect()
    }, TOKEN_REFRESH_MS)

    return () => {
      stopped = true
      if (refreshTimer != null) clearInterval(refreshTimer)
      es?.close()
    }
  }, [])
}
