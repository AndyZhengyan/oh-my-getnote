# 三栏布局重构 v2 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将图谱页面三栏布局升级为类 Manus 风格：LeftNav 48px ↔ 280px 可折叠 + Logo 内置 + 各 section 可独立收起；RightPanel 改为 `position: relative` + `flex: 1.2` + `maxWidth: 800px`，真正参与 flex 三栏布局。

**Architecture:** 三栏 flex 布局，LeftNav 和 RightPanel 都是 flex item，展开/收起通过宽度动画实现，中间画布 flex: 1 自动压缩。

**Tech Stack:** React, framer-motion, Zustand (graphStore), Tailwind-less inline styles (现有风格)

---

## 文件改动总览

| 文件 | 改动 |
|---|---|
| `web/app/graph/page.tsx` | 移除独立 Logo div；LeftNav 不传 panelLeft prop；RightPanel 改为 `position: relative` + `flex: 1.2` |
| `web/components/panels/LeftNav.tsx` | COLLAPSED_WIDTH: 60→48；新增 Logo 行；各 section 可独立收起；笔记类型/Tags 按数量倒序 |
| `web/components/panels/RightPanel.tsx` | `position: relative`（移除 absolute）；移除 `panelLeft` prop；外层用 `overflow: hidden` + `flex: rightPanelOpen ? 1.2 : 0` 控制宽度 |
| `web/stores/graphStore.ts` | 无需改动 |

---

## Task 1: LeftNav 收起态改为 48px，内置 Logo

**Files:**
- Modify: `web/components/panels/LeftNav.tsx`

- [ ] **Step 1: 调整 COLLAPSED_WIDTH**

在 `LeftNav.tsx` 第 40 行附近，将：

```ts
const COLLAPSED_WIDTH = 60;
```

改为：

```ts
const COLLAPSED_WIDTH = 48;
```

- [ ] **Step 2: 收起态内置 Logo**

在收起态（`!leftNavOpen`）的 `<div>` 中，新增 Logo 显示在图标区域最上方（搜索图标之前），替换掉现有顶部的空 padding：

```tsx
{/* 收起态：Logo + 垂直图标 */}
{!leftNavOpen && (
  <div style={{
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',  // 改从顶部开始
    gap: 0,
    paddingTop: 8,
  }}>
    {/* Logo — 居中显示 */}
    <div style={{
      fontSize: 18,
      fontWeight: 700,
      marginBottom: 12,
      letterSpacing: '-0.02em',
    }}>
      📚
    </div>
    {/* 搜索图标 */}
    <button
      onClick={() => setSearchModalOpen(true)}
      title="搜索笔记"
      style={{ /* 同现有搜索图标样式 */ }}
    >
      <Search size={18} />
    </button>
    {/* Layers 图标 */}
    <button
      onClick={() => setLeftNavOpen(true)}
      title="展开侧边栏"
      style={{ /* 同现有样式 */ }}
    >
      <Layers size={18} />
    </button>
    {/* Bookmark 图标 */}
    <button
      onClick={() => setLeftNavOpen(true)}
      title="展开侧边栏"
      style={{ /* 同现有样式 */ }}
    >
      <Bookmark size={18} />
    </button>
  </div>
)}
```

- [ ] **Step 3: 提交**

```bash
git add web/components/panels/LeftNav.tsx
git commit -m "feat(leftnav): 收起态改为48px，内置Logo"
```

---

## Task 2: LeftNav 展开态内容重排 — Logo 行 + 搜索 + 笔记类型 + Tags + 探索路径 + 历史轨迹，紧密排列

**Files:**
- Modify: `web/components/panels/LeftNav.tsx`

- [ ] **Step 1: 展开态新增 Logo 行**

在展开态内容区（`{leftNavOpen && (...)` 内）的最顶部，搜索按钮之上，新增 Logo 行，替换掉原有的 padding:

```tsx
{leftNavOpen && (
  <>
    {/* Logo 行 — 新增 */}
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '12px 16px',
      borderBottom: '1px solid var(--border)',
      flexShrink: 0,
    }}>
      <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>📚</span>
      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }}>
        Oh My Getnote
      </span>
    </div>

    {/* 搜索触发按钮 */}
    <div
      onClick={() => setSearchModalOpen(true)}
      style={{ /* 同现有搜索按钮样式 */ }}
    >
      <Search size={14} style={{ color: 'var(--text-muted)' }} />
      <span>点击搜索笔记…</span>
    </div>
    {/* ... 其余内容 ... */}
  </>
)}
```

- [ ] **Step 2: 调整整体滚动结构 — 紧密排列无空白**

找到现有的底部固定区块（探索路径 + 历史轨迹，`borderTop: 1px solid var(--border)`），将其改为跟随上方内容自然排列，移除固定高度限制：

```tsx
{/* 移除原有的固定 height: 280 包装，让探索路径和历史轨迹跟随内容自然排列 */}
{/* 探索路径 section */}
<div style={{
  borderTop: '1px solid var(--border)',
  display: 'flex',
  flexDirection: 'column',
  // 不设置固定 height，自然高度
}}>
  {/* ... 现有探索路径内容 ... */}
</div>

{/* 历史轨迹 section */}
<div style={{
  borderTop: '1px solid var(--border)',
  display: 'flex',
  flexDirection: 'column',
}}>
  {/* ... 现有历史轨迹内容 ... */}
</div>
```

同时移除搜索按钮外层的 `flex: 1` 约束，让它高度自适应。

- [ ] **Step 3: 提交**

```bash
git add web/components/panels/LeftNav.tsx
git commit -m "refactor(leftnav): 展开态内容重排，Logo内置，紧密排列"
```

---

## Task 3: 笔记类型和 Tags 按数量倒序排列

**Files:**
- Modify: `web/components/panels/LeftNav.tsx`

- [ ] **Step 1: 笔记类型排序改为倒序**

找到"笔记类型" section 的 `types.sort(compareAlphaFirst)`，改为按数量倒序：

```tsx
{types
  .filter(t => t !== '其他')
  .sort((a, b) => (graphIndex.stats.by_type[b] ?? 0) - (graphIndex.stats.by_type[a] ?? 0))  // 倒序
  .map(type => (
    <NavItem key={type} ... />
  ))}
```

"其他"保持放在最后（现有逻辑不变）。

- [ ] **Step 2: Tags（知识领域）排序改为倒序**

找到知识领域 section 的排序逻辑：

```tsx
{graphIndex.domains
  .filter(d => d !== '其他')
  .sort((a, b) => (graphIndex.stats.by_domain[b] ?? 0) - (graphIndex.stats.by_domain[a] ?? 0))  // 倒序
  .map(domain => (
    <NavItem key={domain} ... />
  ))}
```

"其他"保持放在最后（现有逻辑不变）。

- [ ] **Step 3: 提交**

```bash
git add web/components/panels/LeftNav.tsx
git commit -m "refactor(leftnav): 笔记类型和Tags按数量倒序排列"
```

---

## Task 4: LeftNav 所有 section 均可独立收起

**Files:**
- Modify: `web/components/panels/LeftNav.tsx`

- [ ] **Step 1: 新增 4 个 section 折叠 state**

在 `LeftNav` 组件顶部 `useState` 处，新增 4 个 state：

```tsx
const [typeCollapsed, setTypeCollapsed] = useState(false);
const [tagsCollapsed, setTagsCollapsed] = useState(false);
const [trailCollapsed, setTrailCollapsed] = useState(false);     // 已有，跳过
const [historyCollapsed, setHistoryCollapsed] = useState(false);
```

- [ ] **Step 2: 笔记类型 section 添加折叠功能**

在"笔记类型" section header 右侧添加 chevron-up 按钮，`content` div 用 `display: none` 或高度 0 控制折叠：

```tsx
<div style={{
  display: 'flex',
  alignItems: 'center',
  padding: '8px 12px 8px 16px',
  flexShrink: 0,
  gap: 6,
}}>
  <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, flex: 1 }}>
    笔记类型
  </span>
  <button
    onClick={() => setTypeCollapsed(c => !c)}
    title={typeCollapsed ? '展开' : '收起'}
    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex' }}
    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
  >
    <ChevronUp size={12} style={{ transition: 'transform 0.2s', transform: typeCollapsed ? 'rotate(180deg)' : 'rotate(0deg)' }} />
  </button>
</div>

{/* 内容区 — 折叠时隐藏 */}
{!typeCollapsed && (
  <div>
    {types.filter(t => t !== '其他').sort(/* 倒序 */).map(/* ... */)}
    {types.includes('其他') && <NavItem ... />}
  </div>
)}
```

- [ ] **Step 3: Tags section 添加折叠功能**

同上，将"知识领域" section header 右侧添加 chevron-up，`content` 用 `!tagsCollapsed && (...)` 包裹。

- [ ] **Step 4: 探索路径 section — 已有折叠逻辑，确认行为正确**

现有 `trailCollapsed` state 已存在，确认它包裹的是 `<div style={{ flex: 1, overflowY: 'auto' }}>` 区域。

- [ ] **Step 5: 历史轨迹 section 添加折叠功能**

在历史轨迹 section header 右侧添加 chevron-up，`content` 用 `!historyCollapsed && (...)` 包裹：

```tsx
<div style={{ borderTop: '1px solid var(--border)' }}>
  <div style={{ display: 'flex', alignItems: 'center', padding: '6px 12px 6px 16px', flexShrink: 0, gap: 6 }}>
    <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, flex: 1 }}>
      历史轨迹
    </span>
    <button
      onClick={() => setHistoryCollapsed(c => !c)}
      title={historyCollapsed ? '展开' : '收起'}
      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex' }}
    >
      <ChevronUp size={12} style={{ transition: 'transform 0.2s', transform: historyCollapsed ? 'rotate(180deg)' : 'rotate(0deg)' }} />
    </button>
  </div>
  {!historyCollapsed && (
    <div style={{ padding: '2px 0 6px' }}>
      {/* 现有历史轨迹内容 */}
    </div>
  )}
</div>
```

- [ ] **Step 6: 提交**

```bash
git add web/components/panels/LeftNav.tsx
git commit -m "feat(leftnav): 笔记类型/Tags/探索路径/历史轨迹均可独立收起"
```

---

## Task 5: page.tsx 移除独立 Logo，RightPanel 改为 relative + flex 布局

**Files:**
- Modify: `web/app/graph/page.tsx`
- Modify: `web/components/panels/RightPanel.tsx`

- [ ] **Step 1: page.tsx 移除独立 Logo div**

删除第 53-62 行的独立 Logo div：

```tsx
// 删除这段：
{/* Logo — fixed top-left */}
<div style={{ position: 'fixed', top: 14, left: 80, ... }}>
  <span>📚 Oh My Getnote</span>
</div>
```

- [ ] **Step 2: page.tsx — RightPanel 改为 relative + flex**

在 `page.tsx` 第 123 行附近，将 `<RightPanel panelLeft={0} />` 改为直接渲染（RightPanel 不再需要 panelLeft），并用外层容器控制其 flex 比例：

```tsx
{/* Three-column flex layout */}
<div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
  <LeftNav />

  {/* 中间画布 */}
  <div style={{
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    margin: '0 7px',
    overflow: 'hidden',
  }}>
    {/* 图谱区域 */}
    <div style={{ /* ... 现有样式 ... */ }}>
      <ForceGraph />
    </div>
    {/* 状态栏 */}
    <div style={{ /* ... 现有样式 ... */ }}>
      {/* ... */}
    </div>
  </div>

  {/* RightPanel — flex 控制宽度 */}
  <div style={{
    flexShrink: 0,
    flex: rightPanelOpen ? 1.2 : 0,
    width: rightPanelOpen ? 'auto' : 0,
    maxWidth: 800,
    transition: 'flex 0.25s ease-out, width 0.25s ease-out',
    overflow: 'hidden',
    display: 'flex',
  }}>
    {rightPanelOpen && <RightPanel />}
  </div>
</div>
```

需要先从 `graphStore` 引入 `rightPanelOpen`：

```tsx
const rightPanelOpen = useGraphStore((s) => s.rightPanelOpen);
```

- [ ] **Step 3: RightPanel — 移除 absolute 定位，改为普通 div**

在 `RightPanel.tsx` 中：

1. 移除 `panelLeft` prop（不再需要）
2. 移除 `panelStyle` 中的 `position: 'absolute'` 相关样式
3. 简化根组件为普通 `motion.aside`（不再用 AnimatePresence + absolute）

新结构：

```tsx
// 移除 interface RightPanelProps（如果有的话）
// export default function RightPanel({ panelLeft }: RightPanelProps) 改为：
export default function RightPanel() {
  // ... 现有 hooks 和逻辑 ...

  return (
    <motion.aside
      key="right-panel"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      style={{
        width: '100%',
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: 'none',
        borderLeft: '1px solid var(--border)',
        boxShadow: '-4px 0 20px rgba(0,0,0,0.06)',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'var(--font-ui)',
      }}
    >
      {/* Focus mode banner */}
      {/* Header */}
      {/* Meta */}
      {/* AI Summary */}
      {/* Content */}
      {/* Footer: recommendations */}
    </motion.aside>
  );
}
```

同时删除 `AnimatePresence`（不再需要），保留 `motion`。

- [ ] **Step 4: 提交**

```bash
git add web/app/graph/page.tsx web/components/panels/RightPanel.tsx
git commit -m "refactor: 三栏flex布局，RightPanel改为relative+flex，Logo移入LeftNav"
```

---

## Task 6: E2E 测试验证 — 三栏联动行为

**Files:**
- Modify: `web/e2e/graph-stability.spec.ts`（如现有）
- Create: `web/e2e/layout.spec.ts`（如无）

- [ ] **Step 1: 新增三栏布局 E2E 测试**

```ts
// web/e2e/layout.spec.ts
import { test, expect } from '@playwright/test';

test('三栏布局 — LeftNav 展开/收起', async ({ page }) => {
  await page.goto('/graph');

  // LeftNav 默认收起态为 48px
  const leftNav = page.locator('aside').first();
  await expect(leftNav).toBeVisible();

  // 展开 LeftNav
  const expandBtn = leftNav.locator('button').last();
  await expandBtn.click();
  await page.waitForTimeout(300);

  // 再次收起
  await expandBtn.click();
  await page.waitForTimeout(300);
});

test('三栏布局 — RightPanel 展开/收起', async ({ page }) => {
  await page.goto('/graph');

  // 点击图谱节点，RightPanel 应展开
  // （根据现有 E2E 逻辑补充）
});
```

- [ ] **Step 2: 运行 E2E 测试验证**

```bash
cd web && npx playwright test e2e/layout.spec.ts --reporter=line
```

预期：测试通过（无报错即可，无需截图对比）。

- [ ] **Step 3: 提交**

```bash
git add web/e2e/layout.spec.ts
git commit -m "test(e2e): 新增三栏布局E2E测试"
```

---

## Task 7: 最终验证 — 三栏同时展开/收起

- [ ] **Step 1: 浏览器验证**

手动验证以下场景：
1. LeftNav 收起 + RightPanel 收起 → 中间画布最大化
2. LeftNav 展开 + RightPanel 收起 → 中间画布压缩
3. LeftNav 收起 + RightPanel 展开 → 中间画布压缩
4. LeftNav 展开 + RightPanel 展开 → 三栏并存，中间画布最小

验证动画流畅无跳跃。

- [ ] **Step 2: 运行现有 E2E 确保无回归**

```bash
cd web && npx playwright test --reporter=line
```

预期：所有测试通过。

- [ ] **Step 3: 提交最终改动**

```bash
git add -A && git commit -m "feat: 完成三栏布局v2重构，LeftNav 48px↔280px，RightPanel flex布局"
```

---

## 自检清单

- [ ] **Spec 覆盖**：所有 spec 要求均已覆盖（LeftNav 48px、Logo 内置、内容紧密排列、section 独立收起、倒序、RightPanel flex: 1.2）
- [ ] **占位符检查**：无 TBD/TODO
- [ ] **类型一致性**：`RightPanel` 移除 `panelLeft` prop 后，所有调用处（page.tsx）均已更新
- [ ] **无破坏性改动**：ForceGraph、graphStore API 均未改动
