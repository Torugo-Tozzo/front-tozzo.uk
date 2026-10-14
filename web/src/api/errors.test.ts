import { describe, expect, test } from 'vitest'

import { ApiError, isPlanUpgradeRequired, isRetryable, unwrap } from './errors'

const response = (status: number) => new Response(null, { status })

describe('api errors', () => {
  test('unwrap returns the data of a successful answer', () => {
    expect(unwrap({ data: { id: 1 }, response: response(200) })).toEqual({ id: 1 })
  })

  test('unwrap throws the problem code, never the server text', () => {
    try {
      unwrap({ error: { title: 'Forbidden', status: 403, code: 'PLAN_UPGRADE_REQUIRED', detail: 'texto do servidor' }, response: response(403) })
      expect.unreachable()
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError)
      expect((error as ApiError).code).toBe('PLAN_UPGRADE_REQUIRED')
      expect((error as ApiError).message).not.toContain('texto do servidor')
      expect(isPlanUpgradeRequired(error)).toBe(true)
    }
  })

  test('retries only network failures and 5xx', () => {
    expect(isRetryable(new ApiError(0))).toBe(true)
    expect(isRetryable(new ApiError(503))).toBe(true)
    expect(isRetryable(new ApiError(404))).toBe(false)
    expect(isRetryable(new ApiError(401))).toBe(false)
    expect(isRetryable(new TypeError('Failed to fetch'))).toBe(true)
  })
})
