import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { api, setSessionExpiredHandler } from './client'
import { accessToken, endSession, startSession, type SessionBody } from './session'

const me = {
  id: 'u1', name: 'Ana', email: 'ana@example.com', emailVerified: true, phone: null, locale: 'pt-BR', role: 'OWNER',
  establishment: { id: 'e1', tradeName: 'Tozzo', status: 'ACTIVE', plan: 'PAID', category: null, businessProfiles: ['FOOD'], visibleModules: [], preferencesRevision: 1 },
} as SessionBody['user']

const session = (token: string): SessionBody => ({ accessToken: token, accessTokenExpiresAt: '2026-10-01T18:15:00Z', user: me })
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': status >= 400 ? 'application/problem+json' : 'application/json' } })
const invalidToken = () => json(401, { title: 'Unauthorized', status: 401, code: 'INVALID_TOKEN' })

type Handler = (request: Request) => Response | Promise<Response>
function stubFetch(handler: Handler) {
  const calls: Request[] = []
  const mock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init)
    calls.push(request)
    return handler(request)
  })
  vi.stubGlobal('fetch', mock)
  return calls
}
const path = (request: Request) => new URL(request.url).pathname

describe('api client', () => {
  beforeEach(() => {
    endSession()
    startSession(session('old'))
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    setSessionExpiredHandler(() => {})
  })

  test('sends the in-memory access token and never stores it in web storage', async () => {
    const calls = stubFetch(() => json(200, me))
    await api.GET('/v1/me')
    expect(calls[0].headers.get('Authorization')).toBe('Bearer old')
    expect(JSON.stringify({ ...localStorage })).not.toContain('old')
    expect(JSON.stringify({ ...sessionStorage })).not.toContain('old')
  })

  test('on 401 INVALID_TOKEN refreshes once with the cookie and repeats the request with its body', async () => {
    const calls = stubFetch(async (request) => {
      if (path(request) === '/v1/auth/refresh') return json(200, session('new'))
      if (request.headers.get('Authorization') === 'Bearer old') return invalidToken()
      return json(201, { id: 'p1', echoed: await request.text() })
    })

    const result = await api.POST('/v1/product-types', { body: { description: 'Lanches', color: '#000000' } as never })

    expect(result.response.status).toBe(201)
    expect((result.data as unknown as { echoed: string }).echoed).toContain('Lanches')
    const refresh = calls.find((request) => path(request) === '/v1/auth/refresh')!
    expect(refresh.method).toBe('POST')
    expect(refresh.credentials).toBe('include')
    expect(accessToken()).toBe('new')
  })

  test('shares a single refresh between concurrent 401s', async () => {
    const calls = stubFetch((request) => {
      if (path(request) === '/v1/auth/refresh') return json(200, session('new'))
      return request.headers.get('Authorization') === 'Bearer old' ? invalidToken() : json(200, me)
    })

    const results = await Promise.all([api.GET('/v1/me'), api.GET('/v1/me'), api.GET('/v1/me')])

    expect(results.map((result) => result.response.status)).toEqual([200, 200, 200])
    expect(calls.filter((request) => path(request) === '/v1/auth/refresh')).toHaveLength(1)
  })

  test('a refused refresh ends the session and calls the expired handler', async () => {
    const expired = vi.fn()
    setSessionExpiredHandler(expired)
    stubFetch((request) => (path(request) === '/v1/auth/refresh'
      ? json(401, { title: 'Unauthorized', status: 401, code: 'SESSION_REVOKED' })
      : invalidToken()))

    const result = await api.GET('/v1/me')

    expect(result.response.status).toBe(401)
    expect(expired).toHaveBeenCalledTimes(1)
    expect(accessToken()).toBeNull()
  })

  test('other 401 codes do not refresh', async () => {
    const calls = stubFetch(() => json(401, { title: 'Unauthorized', status: 401, code: 'UNAUTHENTICATED' }))
    await api.GET('/v1/me')
    expect(calls.map(path)).toEqual(['/v1/me'])
  })
})
