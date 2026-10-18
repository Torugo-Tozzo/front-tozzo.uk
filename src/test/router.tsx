import { createMemoryHistory, MemoryRouter } from '@solidjs/router'
import { render } from '@solidjs/testing-library'
import type { JSX } from 'solid-js'

/** Renders route definitions at `path` in a memory router. */
// `wrap` gets the router as a function: JSX runs when evaluated, so it must be
// called inside the providers, not before them.
export function renderAt(path: string, routes: () => JSX.Element, wrap: (router: () => JSX.Element) => JSX.Element = (router) => router()) {
  const history = createMemoryHistory()
  history.set({ value: path })
  const result = render(() => wrap(() => <MemoryRouter history={history}>{routes()}</MemoryRouter>))
  return { ...result, history }
}
