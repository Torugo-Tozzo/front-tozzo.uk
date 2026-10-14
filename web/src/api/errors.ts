import type { components } from './schema'

export type Problem = components['schemas']['Problem']

/** An error answer of the /v1 (application/problem+json), or a network failure (status 0). */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly problem: Problem | undefined

  constructor(status: number, problem?: Problem) {
    super(problem?.code ?? (status === 0 ? 'NETWORK_ERROR' : `HTTP_${status}`))
    this.name = 'ApiError'
    this.status = status
    this.code = problem?.code ?? (status === 0 ? 'NETWORK_ERROR' : `HTTP_${status}`)
    this.problem = problem
  }
}

function isProblem(value: unknown): value is Problem {
  return typeof value === 'object' && value !== null && typeof (value as Problem).code === 'string'
}

/**
 * Turns an openapi-fetch result into its data, or throws an ApiError. Use it in
 * every queryFn and mutationFn, so TanStack Query sees a failure as an error.
 */
export function unwrap<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (result.error !== undefined || !result.response.ok) {
    throw new ApiError(result.response.status, isProblem(result.error) ? result.error : undefined)
  }
  return result.data as T
}

export function apiErrorOf(error: unknown): ApiError {
  if (error instanceof ApiError) return error
  return new ApiError(0)
}

/** Network failures and 5xx are worth a retry; any other answer is final. */
export function isRetryable(error: unknown): boolean {
  const { status } = apiErrorOf(error)
  return status === 0 || status >= 500
}

/**
 * A 403 PLAN_UPGRADE_REQUIRED shows the PaywallBanner (user's decision,
 * 2026-10-14), unlike the React app, where it became an error toast.
 */
export function isPlanUpgradeRequired(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'PLAN_UPGRADE_REQUIRED'
}
