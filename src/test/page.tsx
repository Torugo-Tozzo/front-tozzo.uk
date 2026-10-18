import { QueryClient, QueryClientProvider } from '@tanstack/solid-query'
import type { JSX } from 'solid-js'

import { ThemeProvider } from '@/components/theme-provider'
import { renderAt } from './router'

/** Renders routes at `path` with the providers a page needs (query client, theme). */
export function renderPage(path: string, routes: () => JSX.Element) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const result = renderAt(path, routes, (router) => (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>{router()}</ThemeProvider>
    </QueryClientProvider>
  ))
  return { ...result, queryClient }
}
