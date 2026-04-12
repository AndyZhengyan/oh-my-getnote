import { test, expect } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';

async function waitForGraph(page: import('@playwright/test').Page) {
  await page.waitForSelector('canvas', { timeout: 15000 });
  await page.waitForTimeout(2000);
}

test.describe('三栏布局', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/graph`);
    await waitForGraph(page);
  });

  test('LeftNav 展开/收起', async ({ page }) => {
    // LeftNav 渲染为 <motion.aside>
    const leftNav = page.locator('aside').first();

    // 默认应展开（280px 左右）
    await expect(leftNav).toBeVisible();

    // 找到 toggle 按钮
    const toggleBtn = leftNav.locator('button[title="收起侧边栏"]').first();
    await expect(toggleBtn).toBeVisible();

    // 收起
    await toggleBtn.click();
    await page.waitForTimeout(400);

    // 再次展开
    const expandBtn = leftNav.locator('button[title="展开侧边栏"]').first();
    await expandBtn.click();
    await page.waitForTimeout(400);

    await expect(leftNav).toBeVisible();
  });

  test('LeftNav 收起态切换行为', async ({ page }) => {
    const leftNav = page.locator('aside').first();

    // 收起 LeftNav
    const toggleBtn = leftNav.locator('button[title="收起侧边栏"]').first();
    await toggleBtn.click();
    await page.waitForTimeout(400);

    // 收起后 toggle 按钮文字变为"展开侧边栏"
    const expandBtn = leftNav.locator('button[title="展开侧边栏"]').first();
    await expect(expandBtn).toBeVisible();

    // 收起态应在 sidebar 内有展开按钮（收起后左侧图标按钮出现）
    // Layers 按钮（展开侧边栏）
    const layersBtn = leftNav.locator('button[title="展开侧边栏"]').nth(1);
    await expect(layersBtn).toBeVisible();
  });

  test('LeftNav 展开态显示 Logo 行和所有 section header', async ({ page }) => {
    // Logo 行
    await expect(page.getByText('Oh My Getnote')).toBeVisible();
    // 四个 section header 均应在页面中（知识领域、笔记类型、探索路径、历史轨迹）
    await expect(page.getByText('Tags')).toBeVisible();
    await expect(page.getByText('笔记类型')).toBeVisible();
    await expect(page.getByText('探索路径')).toBeVisible();
    await expect(page.getByText('历史轨迹')).toBeVisible();
  });

  test('RightPanel 展开/收起', async ({ page }) => {
    // 点击图谱节点触发 RightPanel 展开
    const canvas = page.locator('canvas').first();
    await canvas.click({ position: { x: 100, y: 100 } });
    await page.waitForTimeout(600);

    // RightPanel 展开后会显示笔记标题（h3），scoped to last <aside>
    const rightPanelTitle = page.locator('aside').last().locator('h3');
    await expect(rightPanelTitle).toBeVisible({ timeout: 5000 });
  });
});
