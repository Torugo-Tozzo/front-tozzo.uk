import { createSignal } from 'solid-js'

/**
 * Page numbers over the /v1 keyset cursor. The screens keep the React
 * "Página N de M" with Previous/Next: page N is fetched with the cursor that
 * page N-1 returned, so the cursors seen so far are kept in order.
 * `total` (every /v1 list page has it) gives the page count.
 */
export function createCursorPages(initialLimit = 10) {
  const [page, setPage] = createSignal(1)
  const [limit, setLimitSignal] = createSignal(initialLimit)
  // cursors[i] opens page i + 1; page 1 has none.
  const [cursors, setCursors] = createSignal<(string | null)[]>([null])

  return {
    page,
    limit,
    /** The cursor of the current page (undefined on page 1). */
    cursor: () => cursors()[page() - 1] ?? undefined,
    /** Moves one page; going forward needs the nextCursor of the current page. */
    goTo(target: number, nextCursor: string | null | undefined) {
      if (target < 1) return
      if (target > page()) {
        if (!nextCursor) return
        setCursors((list) => [...list.slice(0, page()), nextCursor])
      }
      setPage(target)
    },
    /** Back to page 1 (a new search or filter). */
    reset() {
      setCursors([null])
      setPage(1)
    },
    setLimit(value: number) {
      setLimitSignal(value)
      setCursors([null])
      setPage(1)
    },
  }
}

export const totalPagesOf = (total: number, limit: number) => (total > 0 ? Math.ceil(total / limit) : 0)
