import createClient, { type Middleware } from 'openapi-fetch'

import type { paths } from './schema'
import { accessToken, API_URL, refreshSession } from './session'

type ExpiredHandler = () => void
let onSessionExpired: ExpiredHandler = () => {}

/** What to do when the refresh fails (the auth provider sends the user to /login). */
export function setSessionExpiredHandler(handler: ExpiredHandler) {
  onSessionExpired = handler
}

// Each request is cloned before it goes out: the retry after a refresh needs
// the body again, and fetch consumes the original.
const pending = new WeakMap<Request, Request>()
const REFRESH_PATH = '/v1/auth/refresh'

async function isInvalidToken(response: Response) {
  if (response.status !== 401) return false
  try {
    const body = (await response.clone().json()) as { code?: unknown }
    return body.code === 'INVALID_TOKEN'
  } catch {
    return false
  }
}

export const authMiddleware: Middleware = {
  onRequest({ request }) {
    const token = accessToken()
    if (token) request.headers.set('Authorization', `Bearer ${token}`)
    pending.set(request, request.clone())
    return request
  },
  async onResponse({ request, response }) {
    const original = pending.get(request)
    pending.delete(request)
    if (!original || new URL(request.url).pathname === REFRESH_PATH) return response
    if (!(await isInvalidToken(response))) return response

    const session = await refreshSession()
    if (!session) {
      // A refused refresh ends the session; a network failure keeps it.
      if (!accessToken()) onSessionExpired()
      return response
    }
    // One retry with the new token; a second 401 goes back to the caller.
    original.headers.set('Authorization', `Bearer ${session.accessToken}`)
    return fetch(original)
  },
}

// fetch is looked up per call, so tests can stub the global.
export const api = createClient<paths>({ baseUrl: API_URL, fetch: (request) => fetch(request) })
api.use(authMiddleware)
