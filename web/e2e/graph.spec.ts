import { test, expect } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3001';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function waitForGraph(page: any) {
  await page.waitForSelector('canvas', { timeout: 15000 });
  await page.waitForTimeout(2000);
}

// 动态读取当前 stats 文字（绕过 Playwright locator 缓存问题）
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getStatsText(page: any): Promise<string> {
  return page.evaluate(() => {
    const main = document.querySelector('main');
    if (!main) return '';
    // stats 文字格式: "655 篇 · 5224 条关联"
    const match = main.textContent?.match(/(\d+ 篇 · \d+ 条关联)/);
    return match ? match[1] : '';
  });
}

test.describe('Memex 2.0 知识图谱', () => {

  let consoleErrors: string[] = [];
  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!text.includes('node not found') && !text.includes('favicon')) {
          consoleErrors.push(text);
        }
      }
    });
    await page.goto(`${BASE_URL}/graph`);
    await waitForGraph(page);
  });

  // ── TC-1: 页面基础渲染 ─────────────────────────────────────────────────
  test('TC-1: Toolbar + LeftNav + Canvas 正确渲染', async ({ page }) => {
    await expect(page.locator('text=📚 Oh My Getnote')).toBeVisible();
    // stats 存在
    await expect(page.getByText(/\d+ 篇 · \d+ 条关联/)).toBeVisible();
    // LeftNav aside
    await expect(page.locator('aside').locator('text=知识领域')).toBeVisible();
    await expect(page.locator('aside').locator('text=全部笔记')).toBeVisible();
    await expect(page.locator('aside').locator('text=AI 核心技术与模型')).toBeVisible();
    await expect(page.locator('aside').locator('text=笔记类型')).toBeVisible();
    await expect(page.locator('aside').locator('text=探索轨迹')).toBeVisible();
    // Canvas
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    expect(box?.width!).toBeGreaterThan(100);
    expect(box?.height!).toBeGreaterThan(100);
  });

  // ── TC-2: Canvas 渲染 ─────────────────────────────────────────────────
  test('TC-2: Canvas 元素存在且尺寸有效', async ({ page }) => {
    const canvas = page.locator('canvas');
    const box = await canvas.boundingBox();
    expect(box?.width!).toBeGreaterThan(100);
    expect(box?.height!).toBeGreaterThan(100);
  });

  // ── TC-3: Toolbar 领域筛选 ────────────────────────────────────────────
  test('TC-3: 领域下拉筛选，图谱数量变化', async ({ page }) => {
    const initial = await getStatsText(page);

    // 用 JS 直接触发 React 兼容的 change 事件
    await page.evaluate(() => {
      const sel = document.querySelectorAll('select')[0] as HTMLSelectElement;
      sel.value = sel.options[1].value;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(1500);

    const filtered = await getStatsText(page);
    expect(filtered).not.toBe(initial);

    // 恢复
    await page.evaluate(() => {
      const sel = document.querySelectorAll('select')[0] as HTMLSelectElement;
      sel.value = '';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(500);
  });

  // ── TC-4: Toolbar 类型筛选 ────────────────────────────────────────────
  test('TC-4: 类型下拉筛选，图谱数量变化', async ({ page }) => {
    const initial = await getStatsText(page);

    await page.evaluate(() => {
      const sel = document.querySelectorAll('select')[1] as HTMLSelectElement;
      sel.value = sel.options[2].value;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(1500);

    const filtered = await getStatsText(page);
    expect(filtered).not.toBe(initial);

    await page.evaluate(() => {
      const sel = document.querySelectorAll('select')[1] as HTMLSelectElement;
      sel.value = '';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(500);
  });

  // ── TC-5: 搜索框 ────────────────────────────────────────────────────────
  test('TC-5: 搜索关键词，图谱数量减少', async ({ page }) => {
    const initial = await getStatsText(page);

    // Playwright fill() correctly triggers React onChange for controlled inputs
    const searchInput = page.locator('input[type="search"]');
    await searchInput.click();
    await searchInput.fill('AI');
    await page.waitForTimeout(2000);

    const filtered = await getStatsText(page);
    expect(filtered).not.toBe(initial);

    await searchInput.fill('');
    await page.waitForTimeout(500);
  });

  // ── TC-6: 点击节点 ────────────────────────────────────────────────────
  test('TC-6: 点击 canvas，LeftNav aside 仍然存在', async ({ page }) => {
    const canvas = page.locator('canvas');
    const box = await canvas.boundingBox()!;
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await page.waitForTimeout(1500);
    await expect(page.locator('aside').first()).toBeVisible();
  });

  // ── TC-7: 轨迹按钮 ────────────────────────────────────────────────────
  test('TC-7: Toolbar 轨迹按钮可点击（不崩溃）', async ({ page }) => {
    const trailBtn = page.getByRole('button', { name: '轨迹', exact: true });
    await expect(trailBtn).toBeVisible();
    page.on('dialog', dialog => dialog.dismiss());
    await trailBtn.click();
    await page.waitForTimeout(500);
    await expect(page.locator('canvas')).toBeVisible();
  });

  // ── TC-8: 控制台零错误 ────────────────────────────────────────────────
  test('TC-8: 页面稳定后控制台无严重错误', async ({ page }) => {
    await page.waitForTimeout(3000);
    expect(consoleErrors).toHaveLength(0);
  });

});
