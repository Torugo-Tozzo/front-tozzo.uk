import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:5177'
const startsLocalVite = !process.env.E2E_BASE_URL

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  forbidOnly: Boolean(process.env.CI),
  reporter: 'list',
  outputDir: './test-results/e2e',
  use: {
    baseURL,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: startsLocalVite
    ? {
        command: 'bun run dev --host localhost --port 5177 --strictPort',
        url: `${baseURL}/__ui`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        // Fake host: the toV1() mocks answer it.
        env: { VITE_API_URL: 'http://api.visual.test' },
      }
    : undefined,
})
