import { defineConfig, devices } from '@playwright/test'

/**
 * Koa's end-to-end suite (Phase 10, Step 1). Details: docs/phase-10/e2e-suite.md.
 *
 * The tests run against the production build (`vite preview`), the same bundle users get. App
 * time is pinned and moved forward by the tests (e2e/support/koa.ts), so no test waits for a
 * real minute to pass. Nothing here talks to the network beyond the local preview server.
 */
const PORT = 4317
const CI = !!process.env.CI

export default defineConfig({
  testDir: './e2e',
  // `.e2e.ts`, so Vitest (which picks up *.test.ts and *.spec.ts) never runs these files.
  testMatch: '**/*.e2e.ts',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  workers: CI ? 2 : undefined,
  reporter: CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  // The longest journeys (a full cycle, earn → buy → reset) take ~15 s in WebKit on Windows.
  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: `http://localhost:${PORT}`,
    // Every test starts in a fresh context (empty LocalStorage). The service worker is blocked:
    // offline and update behavior were verified in Phase 9 and would only add cache state here.
    serviceWorkers: 'block',
    locale: 'en-US',
    timezoneId: 'UTC',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'iphone-chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      // Safari's engine at iPhone size. Not a real iPhone (no Home Screen app, no iOS quirks).
      name: 'iphone-webkit',
      use: { ...devices['iPhone 13'] },
    },
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],

  webServer: {
    // Build first so the tests never run against a stale dist/. To iterate faster, start
    // `pnpm build && pnpm exec vite preview --port 4317 --strictPort` yourself: it's reused locally.
    command: `pnpm build && pnpm exec vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !CI,
    timeout: 180_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
})
