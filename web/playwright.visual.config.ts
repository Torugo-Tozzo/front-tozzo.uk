// Uses the root's @playwright/test (one instance for the shared scenarios in
// ../e2e/visual) until the cut-over (S8) moves web/ to the root.
import { defineConfig, devices } from '@playwright/test'

// Visual regression of the Solid app (plan S1+): every screenshot is compared
// with the React baseline recorded in S0 (../e2e/visual/__screenshots__/react/
// <platform>/). This config never writes there: updating the baseline needs the
// user's "ok" and is done from the React app (root `test:visual:baseline`).
// The exception is the `solid-*` projects (screens React does not have), whose
// reference lives in ../e2e/visual/__screenshots__/solid/<platform>/ and is
// recorded only with `--project 'solid-*' --update-snapshots`, with the user's "ok".
const baseURL = process.env.VISUAL_BASE_URL ?? 'http://localhost:5176'
const startsLocalVite = !process.env.VISUAL_BASE_URL

const sizes = [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, isMobile: false },
  { name: 'tablet', viewport: { width: 768, height: 1024 }, isMobile: false },
  { name: 'mobile', viewport: { width: 390, height: 844 }, isMobile: true },
] as const
const themes = ['light', 'dark'] as const

export default defineConfig({
  testDir: './e2e/visual',
  testMatch: '**/*.visual.ts',
  forbidOnly: Boolean(process.env.CI),
  reporter: 'list',
  fullyParallel: true,
  workers: process.env.VISUAL_WORKERS ? Number(process.env.VISUAL_WORKERS) : 4,
  updateSnapshots: 'none',
  snapshotPathTemplate: `../e2e/visual/__screenshots__/react/{platform}/{arg}--{projectName}{ext}`,
  outputDir: './test-results/visual',
  expect: {
    timeout: 15_000,
    toHaveScreenshot: {
      // Tolerance agreed in the plan for the Solid port.
      maxDiffPixelRatio: 0.002,
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
    },
  },
  use: {
    baseURL,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'retain-on-failure',
    screenshot: 'off',
  },
  projects: sizes.flatMap((size) =>
    themes.flatMap((theme) => {
      const use = {
        ...devices['Desktop Chrome'],
        viewport: size.viewport,
        isMobile: size.isMobile,
        hasTouch: size.isMobile,
        deviceScaleFactor: 1,
        colorScheme: theme,
      }
      return [
        // Compared with the React baseline.
        { name: `${size.name}-${theme}`, use, metadata: { theme }, testIgnore: '**/solid-only.visual.ts' },
        // Screens with no React counterpart: their own reference, recorded from
        // the Solid app with the user's "ok" (plan S2). Same file names as the
        // React ones, in ../e2e/visual/__screenshots__/solid/<platform>/.
        {
          name: `solid-${size.name}-${theme}`,
          use,
          metadata: { theme },
          testMatch: '**/solid-only.visual.ts',
          snapshotPathTemplate: `../e2e/visual/__screenshots__/solid/{platform}/{arg}--${size.name}-${theme}{ext}`,
        },
      ]
    }),
  ),
  webServer: startsLocalVite
    ? {
        command: 'bun run dev --host localhost --port 5176 --strictPort',
        url: `${baseURL}/__ui`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        // Fake host: the mocks answer it, and nothing reaches a real server.
        env: { VITE_API_URL: 'http://api.visual.test' },
      }
    : undefined,
})
