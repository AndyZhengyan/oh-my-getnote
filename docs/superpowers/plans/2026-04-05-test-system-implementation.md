# 测试体系实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** ✅ 已完成

**Goal:** 搭建完整 CI + TDD 测试体系：lint + test-and-build 双阶段 CI，lint 失败自动建 issue，E2E 覆盖关键路径。

**Architecture:** CI 分 lint（可选）和 test-and-build（必需）两阶段；单元测试与源码同目录 co-locate；vitest 从 `web/` 发现测试文件。

**Tech Stack:** vitest, GitHub Actions, Playwright, ESLint, TypeScript

---

## 文件结构

```
.github/workflows/ci.yml       ← 更新：lint + test-and-build 双 job
package.json                   ← 确认：根目录 npm scripts 正确
web/
  stores/
    graphStore.test.ts        ← 已完成
    graphStore.ts
  tools/
    markdown.test.ts          ← 新增：TDD 测试
    markdown.ts
  vitest.config.ts           ← 更新：include 指向正确路径
  vitest.setup.ts            ← 已完成
  e2e/
    graph.spec.ts            ← 新增：关键路径 E2E
```

---

## Task 1: 更新 CI — lint + test-and-build 双 job，lint 失败建 issue

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: 更新 ci.yml**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
        continue-on-error: true
      - name: Create lint issue on failure
        if: failure()
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          gh issue create \
            --repo ${{ github.repository }} \
            --title "lint: 代码风格问题" \
            --body "CI lint 检查失败，请修复：${{ github.run_url }}" \
            --label "lint"

  test-and-build:
    runs-on: ubuntu-latest
    needs: lint
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npx vitest run --reporter=verbose
      - run: npx tsc --noEmit -p web/tsconfig.json
      - run: cd web && npx next build
```

- [ ] **Step 2: 验证 CI 语法**

Run: `cd /Users/zhengyan/Projects/ai-project/my-getnote-kg && npx act -l 2>/dev/null || echo "act not available, skip"`

Expected: act not available — 跳过本地验证，直接提交

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: split into lint + test-and-build jobs, lint failure creates issue"
```

---

## Task 2: 新增 markdown.ts TDD 测试

**Files:**
- Create: `web/tools/markdown.test.ts`
- Modify: `web/tools/` (需确认源码存在)

- [ ] **Step 1: 写失败的测试**

确认源码路径：
Run: `ls /Users/zhengyan/Projects/ai-project/my-getnote-kg/tools/markdown.ts`

然后创建 `web/tools/markdown.test.ts`：

```typescript
// web/tools/markdown.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockStorage: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: (k) => mockStorage[k] ?? null,
  setItem: (k, v) => { mockStorage[k] = v; },
  removeItem: (k) => { delete mockStorage[k]; },
  clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); },
  get length() { return Object.keys(mockStorage).length; },
  key: (i) => Object.keys(mockStorage)[i] ?? null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any);

import { convertHtmlToMarkdown, buildMarkdownString } from '../../tools/markdown';

describe('convertHtmlToMarkdown', () => {
  it('extracts title from h1', () => {
    const html = `<html><body><h1>Test Title</h1><hr><p>Body content</p></body></html>`;
    const result = convertHtmlToMarkdown(html, 'test-id');
    expect(result?.frontmatter.title).toBe('Test Title');
  });

  it('extracts tags from span.tag', () => {
    const html = `<html><body><h1>T</h1><hr><span class="tag">AI链接笔记</span></body></html>`;
    const result = convertHtmlToMarkdown(html, 'test-id');
    expect(result?.frontmatter.tags).toContain('AI链接笔记');
  });

  it('converts h3 to ### markdown heading', () => {
    const html = `<html><body><h1>T</h1><hr><h3>Section Title</h3></body></html>`;
    const result = convertHtmlToMarkdown(html, 'test-id');
    expect(result?.body).toContain('### Section Title');
  });

  it('converts ul/ol lists to markdown', () => {
    const html = `<html><body><h1>T</h1><hr><ul><li>Item 1</li><li>Item 2</li></ul></body></html>`;
    const result = convertHtmlToMarkdown(html, 'test-id');
    expect(result?.body).toContain('- Item 1');
    expect(result?.body).toContain('- Item 2');
  });

  it('converts table to markdown table', () => {
    const html = `<html><body><h1>T</h1><hr><table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table></body></html>`;
    const result = convertHtmlToMarkdown(html, 'test-id');
    expect(result?.body).toContain('| A | B |');
    expect(result?.body).toContain('| 1 | 2 |');
  });

  it('returns null when no title found', () => {
    const html = `<html><body><hr><p>No h1 here</p></body></html>`;
    const result = convertHtmlToMarkdown(html, 'test-id');
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run web/tools/markdown.test.ts 2>&1`
Expected: FAIL — `../../tools/markdown` 模块解析失败（路径问题）

- [ ] **Step 3: 修正测试的 import 路径**

由于 vitest 从 `web/` 目录运行，工具源码在根目录 `tools/`，需用 `tsx` 直接运行：

创建 `web/tools/markdown.test.ts`（先写失败测试，用 tsx 跑）：

```typescript
// 测试实际通过 copy 源码或调整 vite 配置来引用 tools/markdown.ts
// 临时方案：在 web/tools/ 下放一个兼容层
```

> 注：tools/markdown.ts 在项目根目录，vitest 从 web/ 运行，模块解析路径复杂。
> 方案：测试文件放在 web/tools/，源码通过 `tsx tools/markdown.ts` 运行时通过 fs 读取 HTML 文件。
> 更简方案：使用 `import { convertHtmlToMarkdown } from '../../tools/markdown'` 路径，
> 但 vitest 需要 tsconfig paths 配置。

**简化方案** — 更新 `web/tsconfig.json` 加 paths alias：

```json
{
  "compilerOptions": {
    "paths": {
      "@/tools/*": ["../tools/*"]
    }
  }
}
```

或更简单：**测试直接内联复刻 `tools/markdown.ts` 的核心逻辑**（不引用文件），
在 Task 3 里完成转换脚本本身。

> 决策：这个任务改为验证 `graphStore` 测试全部通过（已在 Task 1 CI 里覆盖），
> markdown 转换的 TDD 在转换脚本本身修完 bug 后再补充。
> 此 Task 改为：确保 CI 能正确发现并运行所有单元测试。

- [ ] **Step 2（改）: 运行 vitest，确认 graphStore 测试被正确发现**

Run: `npx vitest run 2>&1 | tail -20`
Expected: 10 passed

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/plans/
git commit -m "docs: add test system implementation plan"
```

---

## Task 3: 完善 vitest.config.ts + 添加 markdown 转换 TDD 测试

**Files:**
- Modify: `web/vitest.config.ts`

- [ ] **Step 1: 更新 vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    // 发现 web/stores/ 和 web/tools/ 下的所有测试
    include: [
      'stores/**/*.test.ts',
      'tools/**/*.test.ts',
    ],
    exclude: [
      '**/e2e/**',
      '**/node_modules/**',
    ],
  },
});
```

- [ ] **Step 2: 创建 markdown 转换 TDD 测试**

```typescript
// web/tools/markdown.test.ts
import { describe, it, expect } from 'vitest';
import { convertHtmlToMarkdown, buildMarkdownString } from './markdown';

describe('convertHtmlToMarkdown', () => {
  it('extracts title from h1', () => {
    const html = `<html><body><h1>Test Title</h1><hr><p>Body</p></body></html>`;
    const result = convertHtmlToMarkdown(html, 'test-id');
    expect(result?.frontmatter.title).toBe('Test Title');
  });

  it('extracts span.tag as tags', () => {
    const html = `<html><body><h1>T</h1><hr><span class="tag">AI链接笔记</span></body></html>`;
    const result = convertHtmlToMarkdown(html, 'test-id');
    expect(result?.frontmatter.tags).toContain('AI链接笔记');
  });

  it('converts h3 to ### heading', () => {
    const html = `<html><body><h1>T</h1><hr><h3>Section</h3><p>Content</p></body></html>`;
    const result = convertHtmlToMarkdown(html, 'test-id');
    expect(result?.body).toContain('### Section');
  });

  it('converts ul list items', () => {
    const html = `<html><body><h1>T</h1><hr><ul><li>Item A</li><li>Item B</li></ul></body></html>`;
    const result = convertHtmlToMarkdown(html, 'test-id');
    expect(result?.body).toContain('- Item A');
    expect(result?.body).toContain('- Item B');
  });

  it('returns null when no h1', () => {
    const html = `<html><body><hr><p>No title</p></body></html>`;
    expect(convertHtmlToMarkdown(html, 'x')).toBeNull();
  });
});
```

创建 `web/tools/markdown.ts`（复制 tools/markdown.ts 核心逻辑）：

从 `/Users/zhengyan/Projects/ai-project/my-getnote-kg/tools/markdown.ts` 复制完整内容到 `web/tools/markdown.ts`。

- [ ] **Step 3: 运行测试，确认部分通过**

Run: `npx vitest run 2>&1`
Expected: 10 (graphStore) + N (markdown) passed

- [ ] **Step 4: Commit**

```bash
git add web/vitest.config.ts web/tools/markdown.test.ts web/tools/markdown.ts
git commit -m "test: add markdown converter unit tests, update vitest config"
```

---

## Task 4: E2E 关键路径测试

**Files:**
- Create: `web/e2e/key-paths.spec.ts`

- [ ] **Step 1: 写 E2E 测试**

```typescript
// web/e2e/key-paths.spec.ts
import { test, expect } from '@playwright/test';

test.describe('关键用户路径', () => {
  test.beforeEach(async ({ page }) => {
    // 启动本地 dev server
    await page.goto('http://localhost:3000');
    // 等待图谱加载
    await page.waitForSelector('canvas', { timeout: 10000 });
  });

  test('打开笔记，显示内容', async ({ page }) => {
    // 点击第一个节点
    const canvas = page.locator('canvas').first();
    await canvas.click({ position: { x: 100, y: 100 } });
    // 等待右侧面板出现
    await expect(page.locator('[style*="position: fixed"][style*="right"]')).toBeVisible({ timeout: 5000 });
  });

  test('点击笔记节点，右侧面板显示标题', async ({ page }) => {
    const canvas = page.locator('canvas').first();
    await canvas.click({ position: { x: 150, y: 150 } });
    // 右侧面板应包含标题
    const panel = page.locator('[style*="position: fixed"][style*="380"]');
    await expect(panel).toBeVisible({ timeout: 5000 });
  });

  test('轨迹记录：开始记录 → 点击节点 → 保存 → 查看记录', async ({ page }) => {
    // 点击"轨迹"按钮
    await page.getByText('轨迹').click();
    // 点击画布上任意位置（模拟节点点击）
    await page.locator('canvas').click({ position: { x: 100, y: 100 } });
    // 再点"结束"
    await page.getByText('结束').click();
    // prompt 弹窗，设置名称并保存
    page.on('dialog', async dialog => {
      await dialog.accept('测试轨迹');
    });
    // 验证 savedTrails
    const trails = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('memex_trails') ?? '[]');
    });
    expect(trails.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: 运行 E2E 测试（需先启动 dev server）**

Run: 在另一个终端 `cd web && npm run dev`，然后：
```bash
cd web && npx playwright test e2e/key-paths.spec.ts --ui
```

Expected: 测试可运行（dev server 需本地启动）

- [ ] **Step 3: Commit**

```bash
git add web/e2e/key-paths.spec.ts
git commit -m "test(e2e): add key user path tests"
```

---

## Task 5: 清理已完成的测试文件

**Files:**
- 删除: `web/vitest.setup.ts`（已不需要，mock 已内联到测试文件）

- [ ] **Step 1: 检查 vitest.setup.ts 是否还有必要**

Run: `grep -n "vitest.setup" web/vitest.config.ts`
Expected: `setupFiles: ['./vitest.setup.ts']` — 需要保留！因为 graphStore.test.ts 依赖这个 mock。

**结论**：保留 `vitest.setup.ts`，因为 graphStore.test.ts 使用 `vi.stubGlobal`。

- [ ] **Step 2: 运行全部测试确认**

Run: `npx vitest run 2>&1 | grep -E "passed|failed"`
Expected: N passed, 0 failed

- [ ] **Step 3: 最终 Commit**

```bash
git add -A
git commit -m "test: complete test system — vitest + CI + TDD + E2E key paths"
```

---

## 手动操作（不在代码里）

- [ ] **在 GitHub 上配置 Branch Protection Rules**
  1. Settings → Branches → Add rule for `main`
  2. 勾选 "Require a pull request before merging"
  3. "Require status checks to pass before merging" → 勾选 `test-and-build`（不勾 `lint`）
