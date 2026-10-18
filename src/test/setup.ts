import '@testing-library/jest-dom/vitest'
import { cleanup } from '@solidjs/testing-library'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
})

// happy-dom does not implement these; the Kobalte popovers call them.
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}

// happy-dom computes animation-name as "" (browsers: "none"), so Kobalte's
// presence takes every unmount for an animation that never ends, and a closed
// tab panel stayed in the DOM. No CSS animations run here.
const noAnimations = document.createElement('style')
noAnimations.textContent = '* { animation-name: none; }'
document.head.appendChild(noAnimations)

// Tests get every locale up front (the app loads only the active one).
import { i18n, i18nReady } from '@/i18n/config'
import { resources } from '@/i18n/resources'

await i18nReady
for (const [locale, bundle] of Object.entries(resources)) {
  for (const [namespace, keys] of Object.entries(bundle)) i18n.addResourceBundle(locale, namespace, keys, true, true)
}
