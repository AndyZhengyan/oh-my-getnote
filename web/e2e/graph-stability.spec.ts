import { test, expect } from '@playwright/test';

test.describe('Graph Stability', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3001/graph');
    // Wait for graph to load
    await page.waitForSelector('canvas');
    // Give it a moment to settle
    await page.waitForTimeout(2000);
  });

  test('Filtering to 1 node stays stable and visible', async ({ page }) => {
    // Click "AI" note type in the LeftNav list
    await page.getByRole('complementary').getByText('AI', { exact: true }).click();
    await page.waitForTimeout(3000);

    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
    await page.screenshot({ path: 'test-results/stability-1-node.png' });
  });

  test('Filtering to 2 nodes stays stable and visible', async ({ page }) => {
    // Click "OpenAI" note type in the LeftNav list
    await page.getByRole('complementary').getByText('OpenAI', { exact: true }).click();
    await page.waitForTimeout(3000);

    await expect(page.locator('canvas')).toBeVisible();
    await page.screenshot({ path: 'test-results/stability-2-nodes.png' });
  });

  test('Clicking nodes remains responsive', async ({ page }) => {
    // Click a domain in LeftNav
    await page.getByRole('complementary').getByText('AI 核心技术与模型').first().click();
    await page.waitForTimeout(2000);

    const canvas = page.locator('canvas');
    const box = await canvas.boundingBox();
    if (box) {
      // Click center of canvas where nodes should be
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(1000);

      // Check if RightPanel opened (has title)
      const panelTitle = page.locator('h3');
      await expect(panelTitle).toBeVisible();
    }
  });
});
