import { createSignal } from 'solid-js'

import type { components } from './schema'

export type SessionBody = components['schemas']['SessionBody']
export type Me = components['schemas']['Me']

export const API_URL: string = import.meta.env.VITE_API_URL ?? 'https://dev-api.tozzo.uk'

// The access token lives only here, in memory (never in localStorage or
// sessionStorage). The refresh token is the HttpOnly `tozzo_rt` cookie, which
// only POST /v1/auth/refresh (credentials: 'include') can use.
const [accessToken, setAccessToken] = createSignal<string | null>(null)
const [sessionUser, setSessionUser] = createSignal<Me | null>(null)

export { accessToken, sessionUser }

export function startSession(body: SessionBody) {
  setAccessToken(body.accessToken)
  setSessionUser(body.user)
}

export function endSession() {
  setAccessToken(null)
  setSessionUser(null)
}

let refreshing: Promise<SessionBody | null> | null = null

/**
 * Rotates the refresh cookie for a new access token. Single-flight: callers
 * that arrive while a refresh is running share it, so a burst of 401s spends
 * one refresh token (using one twice revokes the whole session family).
 * Resolves to null when there is no valid session.
 */
export function refreshSession(): Promise<SessionBody | null> {
  refreshing ??= (async () => {
    try {
      const response = await fetch(`${API_URL}/v1/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      })
      if (!response.ok) {
        endSession()
        return null
      }
      const body = (await response.json()) as SessionBody
      startSession(body)
      return body
    } catch {
      // Network failure: keep the current state; the caller sees the original error.
      return null
    } finally {
      refreshing = null
    }
  })()
  return refreshing
}
