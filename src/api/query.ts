import { createEffect, on, untrack } from 'solid-js'
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

/**
 * The data of a query without suspending. Reading `query.data` while the
 * query is still pending suspends the nearest <Suspense> (Solid Query backs it
 * with a resource), which would swap the whole page for the loading overlay
 * instead of showing the page's own skeleton, like the React app.
 */
export function loadedData<T>(query: { isPending: boolean; data: T | undefined }): T | undefined {
  return query.isPending ? undefined : query.data
}

/**
 * Runs `handler` once for each failure of a query (a toast, a log). The
 * handler runs untracked: a toast writes to the toaster's store, and an
 * effect that read it would run again and again.
 */
export function onQueryError(query: { isError: boolean; errorUpdatedAt: number; error: unknown }, handler: (error: unknown) => void) {
  createEffect(on(() => (query.isError ? query.errorUpdatedAt : 0), (failedAt) => {
    if (failedAt) untrack(() => handler(query.error))
  }))
}
