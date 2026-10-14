import type { Page, Route } from '@playwright/test'
import { canonical, FIXED_NOW, type Role } from '../../../../e2e/visual/data/canonical'
import type { MockResponse } from '../../../../e2e/visual/data/legacy'
import { problem, toV1 } from '../../../../e2e/visual/data/v1'
import type { MockHandle, MockOptions, Override } from '../../../../e2e/visual/support/mock-api'

const NEUTRAL_PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNYsGABAAPEAeGUtBWxAAAAAElFTkSuQmCC', 'base64')

export interface V1MockOptions extends Omit<MockOptions, 'overrides'> {
  /** Keyed by the /v1 path, e.g. `/v1/orders`. */
  overrides?: Record<string, Override>
  /**
   * The role that login, Google and the email confirmation sign in (the page
   * starts signed out with `role: null`). Without it those calls answer 401.
   */
  signInAs?: Role
}

// The public /v1/auth calls that never open a session (S2 pages).
const acceptedAuthCalls: Record<string, MockResponse> = {
  '/v1/auth/register': { status: 202, body: {} },
  '/v1/auth/resend-verification': { status: 202, body: {} },
  '/v1/auth/password/forgot': { status: 202, body: {} },
  '/v1/auth/password/reset': { status: 204 },
  '/v1/auth/email/confirm': { status: 204 },
  '/v1/auth/registration-key/validate': { status: 200, body: { valid: true } },
}
const signInCalls = new Set(['/v1/auth/login', '/v1/auth/google', '/v1/auth/verify-email'])

/** The /v1 session the refresh cookie would give back for `role`. */
function sessionBody(role: Role, me: unknown) {
  const user = canonical.users.find((item) => item.role === role)!
  const expiresAt = new Date(new Date(FIXED_NOW).getTime() + 15 * 60_000).toISOString()
  return { accessToken: `visual-${user.id}`, accessTokenExpiresAt: expiresAt, user: me }
}

/**
 * The Go API (/v1) as the Solid app sees it, served from the canonical dataset
 * through toV1(). Same fake host, pixel and SSE handling as the React mock.
 */
export async function mockV1Api(page: Page, options: V1MockOptions = {}): Promise<MockHandle> {
  let role = options.role === undefined ? 'OWNER' : options.role
  const api = toV1(options.dataset ?? canonical, { role: role ?? options.signInAs ?? 'OWNER' })
  const overrides = options.overrides ?? {}
  const handle: MockHandle = { unknown: [] }

  // The realtime client opens an EventSource; keep it open forever without
  // network traffic so the page reaches network idle.
  await page.addInitScript(() => {
    class StillEventSource extends EventTarget {
      static readonly CONNECTING = 0
      static readonly OPEN = 1
      static readonly CLOSED = 2
      readonly url: string
      readonly withCredentials = false
      readyState = 0
      onopen: ((event: Event) => void) | null = null
      onmessage: ((event: MessageEvent) => void) | null = null
      onerror: ((event: Event) => void) | null = null
      constructor(url: string | URL) {
        super()
        this.url = String(url)
        // E2E specs push events through these (window.__eventStreams).
        const streams = ((window as unknown as { __eventStreams?: StillEventSource[] }).__eventStreams ??= [])
        streams.push(this)
        setTimeout(() => {
          if (this.readyState === 2) return
          this.readyState = 1
          const open = new Event('open')
          this.onopen?.(open)
          this.dispatchEvent(open)
          const message = new MessageEvent('message', { data: '{"type":"connected"}' })
          this.onmessage?.(message)
          this.dispatchEvent(message)
        }, 0)
      }
      close() { this.readyState = 2 }
      emit(data: unknown) {
        const message = new MessageEvent('message', { data: JSON.stringify(data) })
        this.onmessage?.(message)
        this.dispatchEvent(message)
      }
    }
    Object.defineProperty(window, 'EventSource', { value: StillEventSource, configurable: true, writable: true })
  })

  // CORS for the app's own origin (any local port), with the refresh cookie.
  const cors = (route: Route) => ({
    'Access-Control-Allow-Origin': route.request().headers().origin ?? '*',
    'Access-Control-Allow-Credentials': 'true',
  })
  const fulfill = (route: Route, response: MockResponse) => route.fulfill({
    status: response.status,
    contentType: response.contentType ?? 'application/json',
    headers: { ...cors(route), ...response.headers },
    body: response.body === undefined ? '' : JSON.stringify(response.body),
  })

  await page.route((url) => url.hostname !== 'localhost' && !url.hostname.endsWith('.visual.test'), (route) =>
    route.request().resourceType() === 'image'
      ? route.fulfill({ status: 200, contentType: 'image/png', body: NEUTRAL_PIXEL })
      : route.abort())

  await page.route((url) => url.hostname === 'api.visual.test', async (route) => {
    const request = route.request()
    if (request.method() === 'OPTIONS') {
      return route.fulfill({
        status: 204,
        headers: {
          ...cors(route),
          'Access-Control-Allow-Headers': 'authorization, content-type',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE',
        },
      })
    }
    const url = new URL(request.url())
    const path = url.pathname
    const override = overrides[path]
    if (override === 'loading') return
    if (override === 'error') return fulfill(route, problem(500, 'INTERNAL_ERROR'))
    if (override) return fulfill(route, override)
    if (request.method() === 'POST' && acceptedAuthCalls[path]) return fulfill(route, acceptedAuthCalls[path])
    if (request.method() === 'POST' && signInCalls.has(path)) {
      if (!options.signInAs) return fulfill(route, problem(401, 'INVALID_CREDENTIALS'))
      role = options.signInAs
      const me = api({ method: 'GET', path: '/v1/me', query: new URLSearchParams() })!.body
      return fulfill(route, { status: 200, body: sessionBody(role, me) })
    }
    if (path === '/v1/auth/refresh') {
      if (!role) return fulfill(route, problem(401, 'UNAUTHENTICATED'))
      const me = api({ method: 'GET', path: '/v1/me', query: new URLSearchParams() })!.body
      return fulfill(route, { status: 200, body: sessionBody(role, me) })
    }
    if (!role) return fulfill(route, problem(401, 'UNAUTHENTICATED'))
    const response = api({ method: request.method(), path, query: url.searchParams, body: request.postDataJSON?.() })
    if (response) return fulfill(route, response)
    handle.unknown.push(`${request.method()} ${path}`)
    return fulfill(route, problem(404, 'NOT_FOUND', `mock: ${path}`))
  })

  return handle
}

// The React scenarios key their overrides by the Bun path; the same state of
// the same screen comes from these /v1 paths.
const V1_PATHS: Record<string, string[]> = {
  '/produtos': ['/v1/products'],
  '/tipos': ['/v1/product-types'],
  '/usuarios': ['/v1/users'],
  '/dispositivos': ['/v1/devices'],
}
const LIST_PAGES = new Set(['/v1/products', '/v1/users'])

/**
 * The overrides of a React scenario (Bun paths) for the /v1 mock. An answer
 * with an empty Bun list becomes the empty /v1 answer of that path.
 */
export function v1Overrides(legacy: Record<string, Override> | undefined): Record<string, Override> {
  const result: Record<string, Override> = {}
  for (const [path, override] of Object.entries(legacy ?? {})) {
    const targets = V1_PATHS[path]
    if (!targets) throw new Error(`No /v1 path for the override of ${path}`)
    for (const target of targets) {
      if (typeof override === 'string') result[target] = override
      else if (Array.isArray(override.body) && override.body.length === 0) {
        result[target] = { status: 200, body: LIST_PAGES.has(target) ? { items: [], nextCursor: null, total: 0 } : [] }
      } else throw new Error(`Cannot translate the override of ${path} to /v1`)
    }
  }
  return result
}
