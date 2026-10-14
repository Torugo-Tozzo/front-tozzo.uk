import { lazy, type Component } from 'solid-js'

export const CHUNK_RELOAD_KEY = 'tozzo.chunk-reload'

type Loader<T> = () => Promise<{ default: T }>

/**
 * lazy() that survives a deploy: an open tab still points at the previous
 * build's chunks, which are gone (404). The first failed import reloads the
 * page once; a flag in sessionStorage keeps it from looping, and a successful
 * import clears it.
 */
export function withChunkReload<T>(load: Loader<T>, storage: Storage = sessionStorage, reload = () => window.location.reload()): Loader<T> {
  return async () => {
    try {
      const module = await load()
      storage.removeItem(CHUNK_RELOAD_KEY)
      return module
    } catch (error) {
      if (storage.getItem(CHUNK_RELOAD_KEY)) throw error
      storage.setItem(CHUNK_RELOAD_KEY, '1')
      reload()
      return new Promise<never>(() => {})
    }
  }
}

export function lazyPage<T extends Component<any>>(load: Loader<T>) {
  return lazy(withChunkReload(load))
}
