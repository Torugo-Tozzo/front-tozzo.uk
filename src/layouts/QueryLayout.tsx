import { type JSX } from 'solid-js'
import { QueryClientProvider } from '@tanstack/solid-query'
import { createAppQueryClient } from '@/api/query'

// One cache across data routes, loaded only when a route actually needs it.
// Public landing/legal pages use AuthProvider without downloading queries.
const queryClient = createAppQueryClient()

export default function QueryLayout(props: { children?: JSX.Element }) {
  return <QueryClientProvider client={queryClient}>{props.children}</QueryClientProvider>
}
