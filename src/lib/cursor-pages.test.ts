import { createRoot } from 'solid-js'
import { describe, expect, it } from 'vitest'

import { createCursorPages, totalPagesOf } from './cursor-pages'

describe('createCursorPages', () => {
  it('walks forward with the next cursor and back with the cursors seen', () => {
    createRoot((dispose) => {
      const pages = createCursorPages(10)
      expect(pages.page()).toBe(1)
      expect(pages.cursor()).toBeUndefined()

      pages.goTo(2, 'c2')
      expect(pages.page()).toBe(2)
      expect(pages.cursor()).toBe('c2')
      pages.goTo(3, 'c3')
      expect(pages.cursor()).toBe('c3')

      pages.goTo(2, null)
      expect(pages.cursor()).toBe('c2')
      // A new next cursor from page 2 replaces what came after it.
      pages.goTo(3, 'c3b')
      expect(pages.cursor()).toBe('c3b')
      dispose()
    })
  })

  it('does not move forward without a next cursor nor before page 1', () => {
    createRoot((dispose) => {
      const pages = createCursorPages()
      pages.goTo(2, null)
      pages.goTo(0, 'x')
      expect(pages.page()).toBe(1)
      dispose()
    })
  })

  it('starts over on a new page size or reset', () => {
    createRoot((dispose) => {
      const pages = createCursorPages()
      pages.goTo(2, 'c2')
      pages.setLimit(20)
      expect([pages.page(), pages.limit(), pages.cursor()]).toEqual([1, 20, undefined])
      pages.goTo(2, 'c2')
      pages.reset()
      expect(pages.page()).toBe(1)
      dispose()
    })
  })

  it('counts pages from the total', () => {
    expect(totalPagesOf(0, 10)).toBe(0)
    expect(totalPagesOf(30, 10)).toBe(3)
    expect(totalPagesOf(31, 10)).toBe(4)
  })
})
