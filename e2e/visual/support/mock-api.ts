import type { Page, Route } from '@playwright/test'
import { canonical, FIXED_NOW, type CanonicalDataset, type Role } from '../data/canonical'
import { toLegacyApi, type MockResponse } from '../data/legacy'

/** Per-path behaviour on top of the dataset: a server error, or a request that never answers. */
export type Override = 'error' | 'loading' | MockResponse

export interface MockOptions {
  /** Signed-in role; null renders the app signed out. */
  role?: Role | null
  dataset?: CanonicalDataset
  /** Keyed by the Bun path, e.g. `/pedidos`. */
  overrides?: Record<string, Override>
}

const NEUTRAL_PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNYsGABAAPEAeGUtBWxAAAAAElFTkSuQmCC', 'base64')

export interface MockHandle {
  /** API paths the app called that the mock does not know (should stay empty). */
  unknown: string[]
}

/** The dataset with every list emptied, for the empty states. */
export function emptyDataset(): CanonicalDataset {
  return { ...canonical, orders: [], sales: [], products: [], services: [], serviceOrders: [], devices: [], calendarEvents: [], shifts: [], users: canonical.users }
}

function gotrueSession(role: Role) {
  const user = canonical.users.find((item) => item.role === role)!
  const now = Math.floor(new Date(FIXED_NOW).getTime() / 1000)
  const expiresAt = now + 24 * 3600
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
  const accessToken = [encode({ alg: 'HS256', typ: 'JWT' }), encode({ sub: user.id, exp: expiresAt, aal: 'aal1', role: 'authenticated' }), 'visual'].join('.')
  return {
    access_token: accessToken,
    refresh_token: 'visual-refresh',
    token_type: 'bearer',
    expires_at: expiresAt,
    expires_in: 24 * 3600,
    user: { id: user.id, email: user.email, app_metadata: {}, user_metadata: {}, aud: 'authenticated', created_at: user.createdAt },
  }
}

export async function mockLegacyApi(page: Page, options: MockOptions = {}): Promise<MockHandle> {
  const role = options.role === undefined ? 'OWNER' : options.role
  const api = toLegacyApi(options.dataset ?? canonical, { role: role ?? 'OWNER' })
  const overrides = options.overrides ?? {}
  const handle: MockHandle = { unknown: [] }

  await page.addInitScript(({ session }) => {
    if (session) localStorage.setItem('supabase.auth.token', JSON.stringify(session))
    // The realtime hook streams /events through fetch; keep it open forever
    // without network traffic so the page reaches network idle.
    const nativeFetch = window.fetch.bind(window)
    window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      const target = input instanceof Request ? input.url : String(input)
      if (!target.includes('/events?token=')) return nativeFetch(input, init)
      const stream = new ReadableStream<Uint8Array>({
        start(controller) { controller.enqueue(new TextEncoder().encode('data: {"tipo":"connected"}\n\n')) },
      })
      return Promise.resolve(new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } }))
    }) as typeof window.fetch
  }, { session: role ? gotrueSession(role) : null })

  const fulfill = (route: Route, response: MockResponse) => route.fulfill({
    status: response.status,
    contentType: response.contentType ?? 'application/json',
    headers: { 'Access-Control-Expose-Headers': 'X-Total-Count', ...response.headers },
    body: response.body === undefined ? '' : JSON.stringify(response.body),
  })

  // External images (landing page): one fixed neutral pixel, so screenshots
  // never depend on a CDN. The Solid app gets the same pixel.
  await page.route((url) => url.hostname !== 'localhost' && !url.hostname.endsWith('.visual.test'), (route) =>
    route.request().resourceType() === 'image'
      ? route.fulfill({ status: 200, contentType: 'image/png', body: NEUTRAL_PIXEL })
      : route.abort())

  // GoTrue (VITE_AUTH_URL): answer refreshes and user lookups.
  await page.route((url) => url.hostname === 'auth.visual.test', (route) => {
    const session = role ? gotrueSession(role) : null
    if (!session) return route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"invalid_grant"}' })
    const path = new URL(route.request().url()).pathname
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(path === '/user' ? session.user : session) })
  })

  await page.route((url) => url.hostname === 'api.visual.test', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname
    const override = overrides[path]
    if (override === 'loading') return // never answered: the page stays in its loading state
    if (override === 'error') return fulfill(route, { status: 500, body: { code: 'INTERNAL_ERROR', message: 'Erro interno' } })
    if (override) return fulfill(route, override)
    if (!role) return fulfill(route, { status: 401, body: { code: 'UNAUTHENTICATED', message: 'Não autenticado' } })
    const response = api({ method: request.method(), path, query: url.searchParams, body: request.postDataJSON?.() })
    if (response) return fulfill(route, response)
    handle.unknown.push(`${request.method()} ${path}`)
    return fulfill(route, { status: 404, body: { code: 'NOT_FOUND', message: `mock: ${path}` } })
  })

  return handle
}
