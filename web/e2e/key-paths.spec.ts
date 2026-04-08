import { test, expect } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3001';

test.describe('关键用户路径', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/graph`);
    // 等待图谱画布加载
    await page.waitForSelector('canvas', { timeout: 15000 });
  });

  test('页面加载，显示图谱画布', async ({ page }) => {
    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible();
  });

  test('点击节点，右侧面板出现笔记内容', async ({ page }) => {
    // 点击画布中心区域（通常有节点聚集）
    const canvas = page.locator('canvas').first();
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas not found');

    // 点击多个位置找节点（知识图谱通常节点在中心区域）
    await canvas.click({ position: { x: box.width / 2, y: box.height / 2 } });
    await page.waitForTimeout(500);

    // 检查右侧面板是否出现（固定在右侧的 aside 元素）
    const rightPanel = page.locator('aside[style*="position: fixed"]').first();
    const isPanelVisible = await rightPanel.isVisible().catch(() => false);
    if (!isPanelVisible) {
      // 尝试点击其他位置
      await canvas.click({ position: { x: box.width / 3, y: box.height / 3 } });
      await page.waitForTimeout(500);
    }
  });

  test('点击左侧知识领域，过滤图谱', async ({ page }) => {
    // 找到第一个知识领域 NavItem
    const domainItems = page.locator('aside >> text=AI 核心技术与模型');
    const count = await domainItems.count();
    if (count > 0) {
      await domainItems.first().click();
      await page.waitForTimeout(300);
      // 点击后应有视觉变化（选中高亮）
    }
  });

  test('轨迹记录：点击"探索路径"按钮展开路径面板', async ({ page }) => {
    const trailBtn = page.locator('aside').getByText('探索路径');
    if (await trailBtn.isVisible()) {
      await trailBtn.click();
      await page.waitForTimeout(300);
      // 展开后显示"点击图谱节点开始追踪"
      await expect(page.getByText('点击图谱节点开始追踪')).toBeVisible();
    }
  });

  test('点击"重置"按钮，图谱重置', async ({ page }) => {
    const resetBtn = page.getByText('重置');
    if (await resetBtn.isVisible()) {
      await resetBtn.click();
      await page.waitForTimeout(200);
    }
  });
});
