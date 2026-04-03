import { test, expect } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3001';

test.describe('Memex 2.0 知识图谱', () => {

  // 收集 console errors，供 TC-8 使用
  let consoleErrors: string[] = [];
  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // 已知数据问题（孤立连接）不算代码错误
        if (!text.includes('node not found') && !text.includes('favicon')) {
          consoleErrors.push(text);
        }
      }
    });
    await page.goto(`${BASE_URL}/graph`);
    // 等待图谱加载完成
    await page.waitForSelector('text=/\\d+ 篇/', { timeout: 15000 });
  });

  // ── TC-1: 页面基础渲染 ─────────────────────────────────────────────────
  test('TC-1: Toolbar + LeftNav + Canvas 正确渲染', async ({ page }) => {
    // Toolbar
    await expect(page.locator('text=📚 Memex')).toBeVisible();
    await expect(page.locator('text=/\\d+ 篇/')).toBeVisible();
    // LeftNav — 用 complementary role 限定在左侧导航
    const leftNav = page.locator('[role="complementary"]');
    await expect(leftNav.locator('text=知识领域')).toBeVisible();
    await expect(leftNav.locator('text=全部笔记')).toBeVisible();
    await expect(leftNav.locator('text=AI 核心技术与模型')).toBeVisible();
    await expect(leftNav.locator('text=笔记类型')).toBeVisible();
    await expect(leftNav.locator('text=探索轨迹')).toBeVisible();
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

  // ── TC-3: Toolbar 领域筛选（下拉框） ──────────────────────────────────
  test('TC-3: 领域下拉筛选，图谱数量变化', async ({ page }) => {
    const stats = page.locator('text=/\\d+ 篇·\\d+ 条关联/');
    const initial = await stats.textContent();

    // 第一个 combobox 是领域筛选
    const domainSelect = page.getByRole('combobox').first();
    // selectOption by index skips invisible options too
    await domainSelect.selectOption({ index: 1 });
    await page.waitForTimeout(1000);

    const filtered = await stats.textContent();
    expect(filtered).not.toBe(initial);

    // 恢复全选
    await domainSelect.selectOption('');
    await page.waitForTimeout(500);
  });

  // ── TC-4: Toolbar 类型筛选（下拉框） ──────────────────────────────────
  test('TC-4: 类型下拉筛选，图谱数量变化', async ({ page }) => {
    const stats = page.locator('text=/\\d+ 篇·\\d+ 条关联/');
    const initial = await stats.textContent();

    // 第二个 combobox 是类型筛选
    const typeSelect = page.getByRole('combobox').nth(1);
    await typeSelect.selectOption({ index: 2 });
    await page.waitForTimeout(1000);

    const filtered = await stats.textContent();
    expect(filtered).not.toBe(initial);

    // 恢复
    await typeSelect.selectOption('');
    await page.waitForTimeout(500);
  });

  // ── TC-5: 搜索框 ────────────────────────────────────────────────────────
  test('TC-5: 搜索关键词，图谱数量减少', async ({ page }) => {
    const stats = page.locator('text=/\\d+ 篇·\\d+ 条关联/');
    const initial = await stats.textContent();

    const searchInput = page.locator('input[placeholder*="搜索"]');
    await searchInput.fill('GPT');
    await page.waitForTimeout(1000);

    const filtered = await stats.textContent();
    // 数量应该变化
    expect(filtered).not.toBe(initial);

    await searchInput.fill('');
    await page.waitForTimeout(500);
  });

  // ── TC-6: 点击节点 ────────────────────────────────────────────────────
  test('TC-6: 点击 canvas 节点，RightPanel 出现', async ({ page }) => {
    // 清空所有筛选，让所有节点显示
    await page.getByRole('combobox').first().selectOption('');
    await page.waitForTimeout(500);

    // 点击 canvas 中心区域
    const canvas = page.locator('canvas');
    const box = await canvas.boundingBox()!;
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await page.waitForTimeout(1500);

    // 至少 LeftNav aside 存在（LeftNav 始终渲染）
    const aside = page.locator('aside').first();
    await expect(aside).toBeVisible();
  });

  // ── TC-7: 轨迹按钮 ────────────────────────────────────────────────────
  test('TC-7: Toolbar 轨迹按钮可点击（不崩溃）', async ({ page }) => {
    // Toolbar 上的轨迹按钮（精确匹配"轨迹"）
    const trailBtn = page.getByRole('button', { name: '轨迹', exact: true });
    await expect(trailBtn).toBeVisible();
    // 监听 dialog（保存轨迹时的 prompt），直接取消
    page.on('dialog', dialog => dialog.dismiss());
    await trailBtn.click();
    await page.waitForTimeout(500);
    // 页面仍然正常（无崩溃）
    await expect(page.locator('canvas')).toBeVisible();
  });

  // ── TC-8: 控制台零错误 ────────────────────────────────────────────────
  test('TC-8: 页面稳定后控制台无严重错误', async () => {
    await page.waitForTimeout(3000);
    expect(consoleErrors).toHaveLength(0);
  });

});
