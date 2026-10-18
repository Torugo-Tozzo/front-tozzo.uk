import { beforeEach, describe, expect, test, vi } from 'vitest'

import { CHUNK_RELOAD_KEY, withChunkReload } from './lazy-page'

describe('withChunkReload', () => {
  beforeEach(() => sessionStorage.clear())

  test('reloads once when a chunk fails to load', async () => {
    const reload = vi.fn()
    const load = withChunkReload(() => Promise.reject(new TypeError('Failed to fetch dynamically imported module')), sessionStorage, reload)

    void load()
    await Promise.resolve()
    await Promise.resolve()

    expect(reload).toHaveBeenCalledTimes(1)
    expect(sessionStorage.getItem(CHUNK_RELOAD_KEY)).toBe('1')
  })

  test('does not loop: after the reload, a second failure is thrown', async () => {
    sessionStorage.setItem(CHUNK_RELOAD_KEY, '1')
    const reload = vi.fn()
    const load = withChunkReload(() => Promise.reject(new Error('404')), sessionStorage, reload)

    await expect(load()).rejects.toThrow('404')
    expect(reload).not.toHaveBeenCalled()
  })

  test('a successful load clears the flag', async () => {
    sessionStorage.setItem(CHUNK_RELOAD_KEY, '1')
    const load = withChunkReload(() => Promise.resolve({ default: 'page' }))

    await expect(load()).resolves.toEqual({ default: 'page' })
    expect(sessionStorage.getItem(CHUNK_RELOAD_KEY)).toBeNull()
  })
})
