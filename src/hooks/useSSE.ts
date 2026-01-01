import { useEffect, useRef, useState } from 'react'
import api from '@/services/api'

type UseSSEOptions = {
  path?: string
  enabled?: boolean
}

// onPayload will be called with parsed JSON payloads from the stream
export function useSSE(onPayload: (payload: any) => void, options: UseSSEOptions = {}) {
  const { path = '/stream', enabled = true } = options
  const [key, setKey] = useState(0) // allow manual reconnect
  const stoppedRef = useRef(false)

  useEffect(() => {
    if (!enabled) return
    stoppedRef.current = false
    const ac = new AbortController()

    const connect = async () => {
      try {
        const base = (api as any).defaults?.baseURL || window.location.origin
        const url = `${String(base).replace(/\/$/, '')}${path.startsWith('/') ? path : '/' + path}`

        // try to obtain token from api defaults or localStorage
        let token: string | undefined = undefined
        try {
          const authHeader = (api as any).defaults?.headers?.Authorization
          if (typeof authHeader === 'string') token = authHeader.replace(/^Bearer\s+/i, '')
        } catch {}
        if (!token) {
          const stored = localStorage.getItem('tozzo_token')
          if (stored) token = stored.replace(/^Bearer\s+/i, '')
        }

        const headers: Record<string, string> = {}
        if (token) headers['Authorization'] = `Bearer ${token}`

        const res = await fetch(url, { headers, signal: ac.signal })
        if (!res.ok) {
          console.error('[useSSE] fetch error', res.status)
          return
        }

        const reader = res.body?.getReader()
        if (!reader) return
        const decoder = new TextDecoder()
        let buf = ''

        while (!stoppedRef.current) {
          const { done, value } = await reader.read()
          if (done) break
          if (value) {
            const chunk = decoder.decode(value, { stream: true })
            buf += chunk
            const parts = buf.split(/\n\n/)
            buf = parts.pop() || ''
            for (const part of parts) {
              const lines = part.split(/\n/).filter(Boolean)
              const dataLines = lines.filter(l => l.startsWith('data:')).map(l => l.replace(/^data:\s?/, ''))
              if (dataLines.length === 0) continue
              const dataStr = dataLines.join('\n')
              try {
                const payload = JSON.parse(dataStr)
                // deliver to consumer
                try { onPayload(payload) } catch (e) { console.error('[useSSE] onPayload error', e) }
              } catch (e) {
                console.error('[useSSE] parse error', e)
              }
            }
          }
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return
        console.error('[useSSE] connection error', err)
        // reconnect after delay
        if (!stoppedRef.current) setTimeout(() => { if (!stoppedRef.current) setKey(k => k + 1) }, 3000)
      }
    }

    connect()

    return () => { stoppedRef.current = true; try { ac.abort() } catch {} }
  }, [key, enabled, path])

  const reconnect = () => setKey(k => k + 1)
  return { reconnect }
}

export default useSSE
