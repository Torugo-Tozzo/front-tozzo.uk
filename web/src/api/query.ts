import { QueryClient } from '@tanstack/solid-query'

import { isRetryable } from './errors'

/**
 * Shared defaults: data stays fresh for 30 s, and only network failures and
 * 5xx are retried. A queryFn passes its `signal` to the request, so leaving the
 * page cancels what it was still loading.
 */
export function createAppQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (failureCount, error) => failureCount < 3 && isRetryable(error),
      },
      mutations: {
        retry: false,
      },
    },
  })
}
