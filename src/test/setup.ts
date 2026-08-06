import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// vitest.config.ts runs without `globals: true`, so Testing Library's
// automatic afterEach(cleanup) (which relies on a global afterEach) never
// registers itself — do it explicitly instead.
afterEach(() => {
  cleanup()
})

// jsdom doesn't implement matchMedia; several components (theme detection, etc.) rely on it.
if (!window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }) as unknown as MediaQueryList
}

// jsdom doesn't implement hasPointerCapture; Radix UI components rely on it.
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false
}

// jsdom doesn't implement scrollIntoView; Radix UI components rely on it.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}
