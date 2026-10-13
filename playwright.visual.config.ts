import { defineConfig, devices } from '@playwright/test'

// Visual regression (plan S0). The React app in this repo records the baseline
// under e2e/visual/__screenshots__/react/<platform>/; the Solid app (web/) compares
// against the same files. Screenshots depend on the OS font rendering, so each
// platform (win32, linux) has its own baseline.
const target = process.env.VISUAL_TARGET ?? 'react'
const baseURL = process.env.VISUAL_BASE_URL ?? 'http://localhost:5174'
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
  snapshotPathTemplate: `e2e/visual/__screenshots__/react/{platform}/{arg}--{projectName}{ext}`,
  expect: {
    // Generous waits: a cold Vite compile under 4 workers can pass 5 s.
    timeout: 15_000,
    toHaveScreenshot: {
      // React against its own baseline must be pixel-identical (determinism);
      // the Solid port gets the tolerance agreed in the plan.
      maxDiffPixelRatio: target === 'react' ? 0 : 0.002,
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
    themes.map((theme) => ({
      name: `${size.name}-${theme}`,
      use: {
        ...devices['Desktop Chrome'],
        viewport: size.viewport,
        isMobile: size.isMobile,
        hasTouch: size.isMobile,
        deviceScaleFactor: 1,
        colorScheme: theme,
      },
      metadata: { theme },
    })),
  ),
  webServer: startsLocalVite
    ? {
        command: 'bun run dev --host localhost --port 5174 --strictPort',
        url: `${baseURL}/login`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        // Fake hosts: the mocks answer them, and nothing reaches a real server.
        env: { VITE_API_URL: 'http://api.visual.test', VITE_AUTH_URL: 'http://auth.visual.test' },
      }
    : undefined,
})
