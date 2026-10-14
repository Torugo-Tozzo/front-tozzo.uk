import { vi } from 'vitest'

export interface RecordedCall {
  method: string
  path: string
  body: unknown
  credentials: RequestCredentials
  authorization: string | null
}

type Handler = (call: RecordedCall) => Response | Promise<Response> | undefined

export const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

/** A /v1 problem+json answer. */
export const problem = (status: number, code: string) =>
  new Response(JSON.stringify({ title: code, status, code }), { status, headers: { 'Content-Type': 'application/problem+json' } })

export const noContent = () => new Response(null, { status: 204 })

/**
 * Stubs the global fetch (the openapi-fetch client looks it up per call) and
 * records every request with its parsed JSON body. Unhandled paths get a 404.
 */
export function mockApi(handler: Handler) {
  const calls: RecordedCall[] = []
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init)
    const text = request.method === 'GET' ? '' : await request.clone().text()
    const call: RecordedCall = {
      method: request.method,
      path: new URL(request.url).pathname,
      body: text ? JSON.parse(text) : undefined,
      credentials: request.credentials,
      authorization: request.headers.get('Authorization'),
    }
    calls.push(call)
    return (await handler(call)) ?? problem(404, 'NOT_FOUND')
  }))
  return {
    calls,
    to: (path: string) => calls.filter((call) => call.path === path),
  }
}
