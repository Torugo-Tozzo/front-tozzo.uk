import type { Page, TestInfo } from '@playwright/test'
import { FIXED_NOW } from '../data/canonical'

export type Theme = 'light' | 'dark'

const FREEZE_CSS = `
*, *::before, *::after {
  animation: none !important;
  transition: none !important;
  caret-color: transparent !important;
}
html { scroll-behavior: auto !important; }
`

export function themeOf(testInfo: TestInfo): Theme {
  return (testInfo.project.metadata as { theme?: Theme }).theme ?? 'light'
}

/** Fixed clock, theme, locale and the CSS that removes animations, before the app boots. */
export async function prepare(page: Page, theme: Theme, options: { locale?: string; pauseTimers?: boolean } = {}) {
  const locale = options.locale ?? 'pt-BR'
  // pauseTimers: timers only run when the test advances the clock.
  if (options.pauseTimers) await page.clock.install({ time: new Date(FIXED_NOW) })
  else await page.clock.setFixedTime(new Date(FIXED_NOW))
  await page.addInitScript(
    ({ theme, locale, css }) => {
      localStorage.setItem('vite-ui-theme', theme)
      localStorage.setItem('tozzo.locale', locale)
      const inject = () => {
        const style = document.createElement('style')
        style.setAttribute('data-visual-freeze', '')
        style.textContent = css
        document.head.appendChild(style)
      }
      if (document.head) inject()
      else document.addEventListener('DOMContentLoaded', inject, { once: true })
    },
    { theme, locale, css: FREEZE_CSS },
  )
}

/** Waits until the page is visually stable: network idle, fonts, images, two frames. */
export async function settle(page: Page) {
  await page.waitForLoadState('networkidle')
  await page.evaluate(async () => {
    await document.fonts.ready
    await Promise.all(
      Array.from(document.images)
        .filter((image) => !image.complete)
        .map((image) => new Promise((resolve) => { image.onload = image.onerror = resolve })),
    )
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  })
}
