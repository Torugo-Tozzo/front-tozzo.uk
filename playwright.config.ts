import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:5173'
const target = new URL(baseURL)
const startsLocalVite =
  (target.hostname === '127.0.0.1' || target.hostname === 'localhost') &&
  target.port === '5173'

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  forbidOnly: Boolean(process.env.CI),
  reporter: 'list',
  use: {
    baseURL,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: startsLocalVite
    ? {
        command: 'bun run dev --host localhost --strictPort',
        url: 'http://localhost:5173/login',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      }
    : undefined,
})
