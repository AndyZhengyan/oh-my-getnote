import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for E2E tests.
 *
 * In CI (GitHub Actions):
 *   - The dev server is started and managed by the CI workflow, NOT by Playwright's
 *     webServer block. Set E2E_BASE_URL to the address the CI server is listening on.
 *   - Use: E2E_BASE_URL=http://localhost:3001 npm run test:e2e
 *
 * Locally (dev):
 *   - Set webServer.reuseExistingServer: true (or run `npm run dev` yourself)
 *     to let Playwright auto-start the dev server via the webServer block below.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  timeout: 60000,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3001',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    headless: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // webServer is intentionally disabled when running in CI — the workflow starts
  // and tears down the server. Uncomment the block below for local dev if you
  // want Playwright to auto-start the server.
  webServer: process.env.CI ? undefined : {
    command: 'npm run dev',
    url: 'http://localhost:3001',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
