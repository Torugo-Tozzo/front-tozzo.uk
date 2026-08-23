import '@testing-library/jest-dom'
import { afterEach } from 'bun:test'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
})

// happy-dom nao implementa hasPointerCapture; Radix UI depende disso.
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false
}

// happy-dom nao implementa scrollIntoView; Radix UI depende disso.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}
