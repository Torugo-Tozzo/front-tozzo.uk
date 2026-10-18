import { createEffect, createSignal, onCleanup, untrack, type Accessor } from 'solid-js'

/**
 * Keeps a loading flag on for at least `minMs` (the React useMinLoadingDuration),
 * so a skeleton does not flash when the answer comes back almost at once.
 */
export function createMinLoading(isLoading: Accessor<boolean>, minMs = 400): Accessor<boolean> {
  const [shown, setShown] = createSignal(untrack(isLoading))
  let startedAt: number | null = untrack(isLoading) ? Date.now() : null

  createEffect(() => {
    if (isLoading()) {
      startedAt = Date.now()
      setShown(true)
      return
    }
    const elapsed = startedAt != null ? Date.now() - startedAt : minMs
    const timer = setTimeout(() => setShown(false), Math.max(0, minMs - elapsed))
    onCleanup(() => clearTimeout(timer))
  })

  return shown
}

/** The value of `source` once it has not changed for `ms` (search inputs). */
export function createDebounced<T>(source: Accessor<T>, ms = 300): Accessor<T> {
  const [value, setValue] = createSignal<T>(untrack(source))
  createEffect(() => {
    const next = source()
    const timer = setTimeout(() => setValue(() => next), ms)
    onCleanup(() => clearTimeout(timer))
  })
  return value
}
