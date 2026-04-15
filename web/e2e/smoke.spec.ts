import { test, expect } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3001';

/**
 * Smoke tests — the minimal set of checks required to confirm the app
 * boots and the graph page is functional. Run on every CI push.
 */
test.describe('Smoke', () => {
  let consoleErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Ignore known benign errors that are not application bugs.
        if (
          !text.includes('node not found') &&
          !text.includes('favicon') &&
          !text.includes('ResizeObserver')
        ) {
          consoleErrors.push(text);
        }
      }
    });
  });

  // ── APP-1: Main graph page loads ─────────────────────────────────────────
  test('APP-1: /graph loads without crashing', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/graph`);
    expect(response?.status()).toBeLessThan(400);
  });

  // ── APP-2: Canvas appears ─────────────────────────────────────────────────
  test('APP-2: Graph canvas is visible within 20 seconds', async ({ page }) => {
    await page.goto(`${BASE_URL}/graph`);
    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible({ timeout: 20_000 });
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(50);
    expect(box!.height).toBeGreaterThan(50);
  });

  // ── APP-3: Stats text is present ─────────────────────────────────────────
  test('APP-3: Stats text ("N 篇 · M 条关联") is visible', async ({ page }) => {
    await page.goto(`${BASE_URL}/graph`);
    await expect(
      page.getByText(/\d+ 篇 · \d+ 条关联/, { exact: false }),
      'Stats banner should show note + relation counts',
    ).toBeVisible({ timeout: 20_000 });
  });

  // ── APP-4: LeftNav aside is rendered ─────────────────────────────────────
  test('APP-4: LeftNav sidebar is present', async ({ page }) => {
    await page.goto(`${BASE_URL}/graph`);
    await expect(page.locator('aside').first()).toBeVisible({ timeout: 20_000 });
  });

  // ── APP-5: No console errors after load ───────────────────────────────────
  test('APP-5: No console errors after 4 seconds of stability', async ({ page }) => {
    await page.goto(`${BASE_URL}/graph`);
    await page.waitForSelector('canvas', { timeout: 20_000 });
    await page.waitForTimeout(4_000);
    expect(consoleErrors, 'Console should have zero application errors').toHaveLength(0);
  });
});
