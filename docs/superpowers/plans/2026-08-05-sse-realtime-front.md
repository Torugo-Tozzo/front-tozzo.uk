# Realtime via SSE — Front Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the tight 8-15s polling in `DashboardLayout`, `OrdersPage`, and `SalesPage` with a `useRealtimeEvents` hook that consumes the API's SSE stream, keeping a much longer poll as a fallback safety net.

**Architecture:** New hook opens a native `EventSource` against `GET /events?token=...` using a short-lived token minted via `POST /auth/sse-token`. Proactively swaps the connection every ~4 minutes (token expires in 5). On any matching event, calls back into the page's existing refetch function — no incremental state patching, always a full refetch of the current view.

**Tech Stack:** React 18, Vitest + React Testing Library (`renderHook`), native `EventSource`.

**Depends on:** api repo, branch `feat/sse-realtime` (`docs/superpowers/plans/2026-08-05-sse-realtime-api.md`) — needs `POST /auth/sse-token` and `GET /events` deployed/running locally before this plan's manual verification steps.

**Spec:** `docs/superpowers/specs/2026-08-05-sse-realtime-design.md` (this repo).

## Global Constraints

- No incremental state from event payloads — every event handler triggers a full refetch via the page's existing fetch function, never manual state patching.
- `EventSource` mock required for tests — jsdom has no native implementation.
- Token refresh happens proactively (~4min), never reactively after a 401.
- Existing polling behavior (visibility pause/resume, diffing to avoid unnecessary re-renders) is preserved — only the trigger interval changes (8-15s → 60s fallback) and a new SSE-driven trigger is added alongside it.

---

### Task 1: `getSseToken` helper

**Files:**
- Modify: `src/services/api.ts`
- Test: `src/services/api.test.ts`

**Interfaces:**
- Produces: `getSseToken(): Promise<string>` (exported from `src/services/api.ts`).

- [ ] **Step 1: Write the failing test**

Create `src/services/api.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import api, { getSseToken } from './api'

describe('getSseToken', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('faz POST /auth/sse-token e retorna o token da resposta', async () => {
    vi.spyOn(api, 'post').mockResolvedValue({ data: { token: 'token-curto' } } as any)

    const token = await getSseToken()

    expect(api.post).toHaveBeenCalledWith('/auth/sse-token')
    expect(token).toBe('token-curto')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/services/api.test.ts`
Expected: FAIL — `getSseToken` não é exportado por `./api`.

- [ ] **Step 3: Write `getSseToken` em `src/services/api.ts`**

No final do arquivo (depois de `export function getErrorMessage(...)` já existente), adicionar:

```ts

export async function getSseToken(): Promise<string> {
  const response = await api.post('/auth/sse-token')
  return response.data.token
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test src/services/api.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/api.ts src/services/api.test.ts
git commit -m "feat(sse): getSseToken minta token curto pro stream"
```

---

### Task 2: `useRealtimeEvents` hook

**Files:**
- Create: `src/hooks/useRealtimeEvents.ts`
- Test: `src/hooks/useRealtimeEvents.test.ts`

**Interfaces:**
- Consumes: `getSseToken()` (Task 1), `api.defaults.baseURL` de `src/services/api.ts`.
- Produces: `useRealtimeEvents(tipos: ('pedidos' | 'vendas')[], onEvent: (tipo: 'pedidos' | 'vendas') => void): void`, tipo exportado `RealtimeTipo = 'pedidos' | 'vendas'`.

- [ ] **Step 1: Write the failing tests**

Create `src/hooks/useRealtimeEvents.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test src/hooks/useRealtimeEvents.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Write `src/hooks/useRealtimeEvents.ts`**

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test src/hooks/useRealtimeEvents.test.ts`
Expected: PASS, 3 testes.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useRealtimeEvents.ts src/hooks/useRealtimeEvents.test.ts
git commit -m "feat(sse): hook useRealtimeEvents com EventSource nativo"
```

---

### Task 3: Wire no `DashboardLayout.tsx` (badge de pedidos)

**Files:**
- Modify: `src/layouts/DashboardLayout.tsx:1,90-106`

**Interfaces:**
- Consumes: `useRealtimeEvents` (Task 2).

- [ ] **Step 1: Trocar o import do React**

Trocar:

```tsx
import { useState, useEffect, Suspense } from "react"
```

por:

```tsx
import { useState, useEffect, useCallback, Suspense } from "react"
```

- [ ] **Step 2: Adicionar import do hook**

Depois de `import api from "@/services/api"`, adicionar:

```tsx
import { useRealtimeEvents } from "@/hooks/useRealtimeEvents"
```

- [ ] **Step 3: Extrair `fetchCount` e trocar o polling**

Trocar:

```tsx
  useEffect(() => {
    let mounted = true
    const fetchCount = async () => {
      try {
        const resp = await api.get('/pedidos', { params: { status: 'NAO_FECHADOS', limit: 1 } })
        const totalHeader = resp.headers['x-total-count']
        const count = totalHeader ? parseInt(totalHeader) : (Array.isArray(resp.data) ? resp.data.length : 0)
        if (mounted) setNonClosedCount(count)
      } catch (err) {
        console.error('Error fetching non-closed orders count', err)
      }
    }

    fetchCount()
    const iv = setInterval(fetchCount, 15000)
    return () => { mounted = false; clearInterval(iv) }
  }, [])
```

por:

```tsx
  const fetchCount = useCallback(async () => {
    try {
      const resp = await api.get('/pedidos', { params: { status: 'NAO_FECHADOS', limit: 1 } })
      const totalHeader = resp.headers['x-total-count']
      const count = totalHeader ? parseInt(totalHeader) : (Array.isArray(resp.data) ? resp.data.length : 0)
      setNonClosedCount(count)
    } catch (err) {
      console.error('Error fetching non-closed orders count', err)
    }
  }, [])

  useRealtimeEvents(['pedidos'], fetchCount)

  useEffect(() => {
    fetchCount()
    const iv = setInterval(fetchCount, 60000)
    return () => clearInterval(iv)
  }, [fetchCount])
```

- [ ] **Step 4: Rodar a suíte e o build**

Run: `bun run test && bunx tsc --noEmit`
Expected: PASS (esses testes não cobrem `DashboardLayout` diretamente — o objetivo aqui é garantir que nada mais quebrou e que os tipos batem).

- [ ] **Step 5: Verificação manual**

Com a api local rodando (`bun run dev` na api, branch `feat/sse-realtime` já com Task 1-6 daquele plano aplicadas) e o front local (`bun run dev`, porta 5173): abrir o dashboard logado, abrir o Network tab, confirmar que existe uma conexão `EventSource` pra `/events` com status pendente (stream aberto). Fechar um pedido em outra aba/sessão e confirmar que o badge de pedidos não fechados atualiza sem F5.

- [ ] **Step 6: Commit**

```bash
git add src/layouts/DashboardLayout.tsx
git commit -m "feat(sse): DashboardLayout usa SSE pro badge de pedidos"
```

---

### Task 4: Wire no `OrdersPage.tsx`

**Files:**
- Modify: `src/pages/dashboard/OrdersPage.tsx`

**Interfaces:**
- Consumes: `useRealtimeEvents` (Task 2).

- [ ] **Step 1: Adicionar import do hook**

Depois de `import { useAuth } from "@/contexts/AuthContext"`, adicionar:

```tsx
import { useRealtimeEvents } from "@/hooks/useRealtimeEvents"
```

- [ ] **Step 2: Hoistar `isOrdersEqual` pra fora do componente**

Adicionar logo depois da definição do tipo `Order` (antes de `export default function OrdersPage()`):

```tsx
function isOrdersEqual(a: Order[], b: Order[]) {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const ai = a[i]
    const bi = b[i]
    if (ai.id !== bi.id) return false
    if (ai.status !== bi.status) return false
    if ((ai.updatedAt || ai.dataCriacao) !== (bi.updatedAt || bi.dataCriacao)) return false
    if (ai.total !== bi.total) return false
  }
  return true
}
```

- [ ] **Step 3: Extrair `poll` pra `useCallback` no nível do componente**

Depois da definição de `fetchOrders` (`}, [loadOrdersRaw])`), adicionar:

```tsx
  const poll = useCallback(async () => {
    try {
      const { data } = await loadOrdersRaw()
      const previous = ordersRef.current || []
      if (!isOrdersEqual(previous, data)) {
        setOrders(data)
        ordersRef.current = data

        if (page === 1 && data.length > previous.length) {
          setNewOrdersCount(data.length - previous.length)
        }
      }
    } catch (err) {
      console.error('[OrdersPage] Error polling orders', err)
    }
  }, [loadOrdersRaw, page])

  useRealtimeEvents(['pedidos'], poll)
```

- [ ] **Step 4: Simplificar o `useEffect` de polling pra usar o `poll` hoistado**

Trocar o bloco inteiro do `useEffect` de polling (que hoje começa em `// Polling: every 8 seconds...` e define `isOrdersEqual`, `poll`, `startPolling`, `stopPolling`, `handleVisibilityChange` localmente, terminando em `}, [page, limit, statusFilter])`) por:

```tsx
  // Fallback: SSE eh o caminho principal (useRealtimeEvents acima), esse
  // interval mais espaçado so cobre o caso de conexao SSE falhar silenciosamente.
  useEffect(() => {
    let interval: number | null = null

    const startPolling = () => {
      if (interval != null) return
      poll()
      interval = window.setInterval(poll, 60000)
    }

    const stopPolling = () => {
      if (interval != null) {
        clearInterval(interval)
        interval = null
      }
    }

    const handleVisibilityChange = () => {
      const visibility = (typeof document !== 'undefined' && document.visibilityState) || 'unknown'
      if (visibility === 'visible') {
        startPolling()
      } else {
        stopPolling()
      }
    }

    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      startPolling()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleVisibilityChange)
    window.addEventListener('blur', handleVisibilityChange)

    return () => {
      stopPolling()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleVisibilityChange)
      window.removeEventListener('blur', handleVisibilityChange)
    }
  }, [poll])
```

- [ ] **Step 5: Rodar a suíte e o build**

Run: `bun run test && bunx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Verificação manual**

Com api + front locais rodando: abrir `OrdersPage`, criar um pedido em outra aba/dispositivo, confirmar que a lista atualiza sem F5 e sem esperar até 60s.

- [ ] **Step 7: Commit**

```bash
git add src/pages/dashboard/OrdersPage.tsx
git commit -m "feat(sse): OrdersPage usa SSE, polling de 8s vira fallback de 60s"
```

---

### Task 5: Wire no `SalesPage.tsx`

**Files:**
- Modify: `src/pages/dashboard/SalesPage.tsx`

**Interfaces:**
- Consumes: `useRealtimeEvents` (Task 2).

- [ ] **Step 1: Trocar o import do React**

Trocar:

```tsx
import { useState, useEffect, useRef } from "react"
```

por:

```tsx
import { useState, useEffect, useRef, useCallback } from "react"
```

- [ ] **Step 2: Adicionar import do hook**

Depois de `import { useAuth } from "@/contexts/AuthContext"`, adicionar:

```tsx
import { useRealtimeEvents } from "@/hooks/useRealtimeEvents"
```

- [ ] **Step 3: Hoistar `isSalesEqual` pra fora do componente**

Adicionar logo depois da definição do tipo `Sale` (antes de `export default function SalesPage()`):

```tsx
function isSalesEqual(a: Sale[], b: Sale[]) {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const ai = a[i]
    const bi = b[i]
    if (ai.id !== bi.id) return false
    if (ai.total !== bi.total) return false
    if ((ai.horario || '') !== (bi.horario || '')) return false
  }
  return true
}
```

- [ ] **Step 4: Extrair `poll` pra `useCallback` no nível do componente**

Adicionar logo depois da definição de `filterRef` e do `useEffect` que o mantém sincronizado (antes do `useEffect` de polling atual):

```tsx
  const poll = useCallback(async () => {
    try {
      const { startDate, startTime, endDate, endTime } = filterRef.current
      const params: any = { page, limit }

      if (startDate && startTime) {
        params.dataInicial = new Date(`${startDate}T${startTime}:00`).toISOString()
      }
      if (endDate && endTime) {
        params.dataFinal = new Date(`${endDate}T${endTime}:59`).toISOString()
      }

      const response = await api.get(`/vendas`, { params })
      const { data, total } = parseListResponse<Sale>(response, 'vendas')
      const fechamento = Number(response.data.fechamento) || 0

      const previous = salesRef.current || []
      if (!isSalesEqual(previous, data)) {
        setSales(data)
        salesRef.current = data
        setTotalItems(total)
        setPeriodTotal(fechamento)

        if (total > 0) {
          setTotalPages(Math.ceil(total / limit))
          setHasMore(page < Math.ceil(total / limit))
        } else {
          setTotalPages(0)
          setHasMore(data.length === limit)
        }
      }
    } catch (err) {
      console.error('Error polling sales', err)
    }
  }, [page, limit])

  useRealtimeEvents(['vendas'], poll)
```

- [ ] **Step 5: Simplificar o `useEffect` de polling pra usar o `poll` hoistado**

Trocar o bloco inteiro do `useEffect` de polling (o que define `isSalesEqual`, `poll`, `startPolling`, `stopPolling`, `handleVisibilityChange` localmente, terminando em `}, [page, limit])`) por:

```tsx
  // Fallback: SSE eh o caminho principal (useRealtimeEvents acima), esse
  // interval mais espaçado so cobre o caso de conexao SSE falhar silenciosamente.
  useEffect(() => {
    let interval: number | null = null

    const startPolling = () => {
      if (interval != null) return
      poll()
      interval = window.setInterval(poll, 60000)
    }

    const stopPolling = () => {
      if (interval != null) {
        clearInterval(interval)
        interval = null
      }
    }

    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        startPolling()
      } else {
        stopPolling()
      }
    }

    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      startPolling()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleVisibilityChange)
    window.addEventListener('blur', handleVisibilityChange)

    return () => {
      stopPolling()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleVisibilityChange)
      window.removeEventListener('blur', handleVisibilityChange)
    }
  }, [poll])
```

- [ ] **Step 6: Rodar a suíte e o build**

Run: `bun run test && bunx tsc --noEmit`
Expected: PASS.

- [ ] **Step 7: Verificação manual**

Com api + front locais rodando: abrir `SalesPage`, registrar uma venda em outra aba/dispositivo, confirmar que a lista e o fechamento atualizam sem F5.

- [ ] **Step 8: Commit**

```bash
git add src/pages/dashboard/SalesPage.tsx
git commit -m "feat(sse): SalesPage usa SSE, polling de 8s vira fallback de 60s"
```

---

### Task 6: Verificação final end-to-end

**Files:** nenhum (task de verificação, sem código novo).

- [ ] **Step 1: Suíte completa dos dois repos**

Api (branch `feat/sse-realtime`): `bun test && bunx tsc --noEmit`
Front (branch `feat/sse-realtime`): `bun run test && bunx tsc --noEmit`
Expected: PASS nos dois.

- [ ] **Step 2: Checklist manual do spec (2 abas, mesma conta)**

Com api local (`bun run dev`, porta 3001) e front local (`bun run dev`, porta 5173) no ar:
1. Abrir `dashboard/orders` em 2 abas do mesmo browser, logado com o mesmo usuário.
2. Fechar um pedido na aba 1 → confirmar que a aba 2 atualiza a lista e o badge sem F5, em menos de 1-2s.
3. Deixar as 2 abas paradas por 4-5 minutos (cobre o ciclo de refresh do token) → confirmar que o realtime continua funcionando depois disso (não precisa reabrir a aba).
4. Repetir o teste de fechamento de pedido pra `SalesPage` (registrar uma venda).

- [ ] **Step 3: Abrir os PRs**

Api: `https://github.com/Torugo-Tozzo/api-tozzo.uk/compare/dev...feat/sse-realtime?expand=1`
Front: `https://github.com/Torugo-Tozzo/front-tozzo.uk/compare/dev...feat/sse-realtime?expand=1`

Nota: o PR da api precisa mergear (e a Task 7 do plano da api — ajuste do nginx — precisa estar aplicada em homolog) **antes** de testar o PR do front em `dev.tozzo.uk`, senão `/events` não existe no servidor ainda.
