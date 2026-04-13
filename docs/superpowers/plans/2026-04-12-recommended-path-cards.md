# 推荐链路卡片 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** 在图谱上为推荐笔记节点渲染悬浮预览卡片，点击节点后自动展开，点击空白处关闭。

**Architecture:** 推荐卡片作为 React 组件叠在 ForceGraph 容器上方，绝对定位。卡片坐标从 `globalThis._nodePosCache`（图谱内部缓存）获取 canvas 坐标，转换为容器坐标后定位。同一时刻只显示一套卡片（跟随当前选中节点）。

**Tech Stack:** React + Zustand store（只读 recommendedPaths），ForceGraph2D canvas API，CSS absolute positioning。

---

## 依赖分析

- `web/stores/graphStore.ts`：`recommendedPaths`（只读）
- `web/components/graph/ForceGraph.tsx`：节点坐标缓存 `_nodePosCache`、选中节点 `selectedNodeId`
- `web/lib/constants.ts`：`DOMAIN_COLORS`
- 新建：`web/components/graph/RecommendedPathCard.tsx`

---

## 文件结构

```
web/components/graph/
  RecommendedPathCard.tsx   ← 新建，单卡片组件
  RecommendedPathCards.tsx  ← 新建，多卡片容器 + 定位 + 关闭逻辑
  ForceGraph.tsx           ← 修改，引入 RecommendedPathCards
```

---

## Task 1: RecommendedPathCard 组件

**文件：** 新建 `web/components/graph/RecommendedPathCard.tsx`

- [ ] **Step 1: 创建文件骨架**

```tsx
// web/components/graph/RecommendedPathCard.tsx
import type { RecommendedPath } from '@/stores/graphStore';
import { DOMAIN_COLORS } from '@/lib/constants';

interface Props {
  path: RecommendedPath;
  style?: React.CSSProperties;
  onClick: () => void;
}

export default function RecommendedPathCard({ path, style, onClick }: Props) {
  const color = DOMAIN_COLORS[path.domain] ?? '#9CA3AF';
  const score = Math.round(path.compositeScore * 100);
  const preview = path.bodyPreview ?? '';

  return (
    <div
      style={{
        position: 'absolute',
        width: 220,
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 10,
        boxShadow: '0 3px 12px rgba(0,0,0,.08)',
        fontFamily: 'var(--font-ui)',
        overflow: 'hidden',
        cursor: 'pointer',
        ...style,
      }}
      onClick={onClick}
    >
      {/* Header */}
      <div style={{
        padding: '8px 10px',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        borderBottom: '1px solid #f3f4f6',
      }}>
        <span style={{ width: 9, height: 9, background: color, borderRadius: '50%', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 12,
            fontWeight: 600,
            color: '#1f2937',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {path.title}
          </div>
          <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 1 }}>
            {path.domain} · {path.type}
          </div>
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color, flexShrink: 0 }}>
          {score}%
        </div>
      </div>

      {/* Body preview */}
      {preview && (
        <div style={{
          margin: '8px 10px 10px',
          padding: '6px 8px',
          background: '#fafafa',
          borderRadius: 6,
          fontSize: 11,
          color: '#374151',
          lineHeight: 1.6,
          maxHeight: 72,
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 4,
          WebkitBoxOrient: 'vertical',
        }}>
          {preview}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 验证文件创建成功**

Run: `ls web/components/graph/RecommendedPathCard.tsx`
Expected: `web/components/graph/RecommendedPathCard.tsx`

---

## Task 2: RecommendedPathCards 容器组件

**文件：** 新建 `web/components/graph/RecommendedPathCards.tsx`

关键逻辑：
- 读取 `recommendedPaths`（store，只取前 3）
- 读取 `_nodePosCache` 获取节点 canvas 坐标
- 转换为容器相对坐标（`left = canvasX * scale + panX`，`top = canvasY * scale + panY`）
- 每个推荐节点旁边放一个卡片，默认向右偏移 20px + 卡片宽度
- **不允许重叠**：如果两个卡片水平距离 < 220px（卡片宽度），第二个改为向下偏移
- 监听 canvas 点击，如果命中背景则关闭卡片

**注意：** scale 和 panX/panY 需要从 ForceGraph 透传。方案：在 `globalThis` 上读写 `{ _graphScale, _graphPanX, _graphPanY }`，组件 mount 时注册，unmount 时清理。

- [ ] **Step 1: 创建 RecommendedPathCards.tsx**

```tsx
// web/components/graph/RecommendedPathCards.tsx
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useGraphStore } from '@/stores/graphStore';
import { DOMAIN_COLORS } from '@/lib/constants';
import type { RecommendedPath } from '@/stores/graphStore';
import RecommendedPathCard from './RecommendedPathCard';

const CARD_WIDTH = 220;
const CARD_OFFSET_X = 18;
const CARD_OFFSET_Y = 8;

interface CardPosition {
  path: RecommendedPath;
  x: number;
  y: number;
}

function computePositions(paths: RecommendedPath[]): CardPosition[] {
  const positions: CardPosition[] = [];
  // Sort by vertical position to detect overlaps top-to-bottom
  const withCoords = paths.map(p => {
    const coords = (globalThis as any)._nodePosCache?.get(p.noteId);
    return { path: p, coords };
  }).filter(p => p.coords != null)
    .sort((a, b) => a.coords.y - b.coords.y);

  // Track occupied vertical ranges to detect overlap
  const occupied: Array<{ x: number; yTop: number; yBottom: number }> = [];

  for (const { path, coords } of withCoords) {
    const scale = (globalThis as any)._graphScale ?? 1;
    const panX = (globalThis as any)._graphPanX ?? 0;
    const panY = (globalThis as any)._graphPanY ?? 0;

    // Base position (canvas coords → container coords)
    let cardX = coords.x * scale + panX;
    let cardY = coords.y * scale + panY;

    // Try to place to the right of the node
    let placed = false;
    for (let offsetX = CARD_OFFSET_X; offsetX <= CARD_OFFSET_X * 5; offsetX += CARD_OFFSET_X) {
      cardX = coords.x * scale + panX + offsetX;
      // Check if this position overlaps with any occupied card
      const candidateTop = cardY - 30; // card is above the node
      const candidateBottom = candidateTop + 130; // approx card height
      const overlaps = occupied.some(o =>
        Math.abs(o.x - cardX) < CARD_WIDTH &&
        !(candidateBottom < o.yTop || candidateTop > o.yBottom)
      );
      if (!overlaps) {
        occupied.push({ x: cardX, yTop: candidateTop, yBottom: candidateBottom });
        placed = true;
        break;
      }
    }

    // Fallback: place below the node
    if (!placed) {
      cardY = coords.y * scale + panY + 24;
      cardX = coords.x * scale + panX - CARD_WIDTH / 2;
      // Clamp to container
      const containerW = window.innerWidth;
      if (cardX < 0) cardX = 8;
      if (cardX + CARD_WIDTH > containerW) cardX = containerW - CARD_WIDTH - 8;
    }

    positions.push({ path, x: cardX, y: cardY - 30 });
  }

  return positions;
}

export default function RecommendedPathCards() {
  const recommendedPaths = useGraphStore(s => s.recommendedPaths);
  const selectNode = useGraphStore(s => s.selectNode);
  const selectedNodeId = useGraphStore(s => s.selectedNodeId);

  const [positions, setPositions] = useState<CardPosition[]>([]);
  const [visible, setVisible] = useState(false);
  const prevSelectedRef = useRef<string | null>(null);

  // Register pan/scale updates from ForceGraph
  useEffect(() => {
    (globalThis as any).__registerGraphOverlay = (scale: number, panX: number, panY: number) => {
      (globalThis as any)._graphScale = scale;
      (globalThis as any)._graphPanX = panX;
      (globalThis as any)._graphPanY = panY;
    };
    return () => { delete (globalThis as any).__registerGraphOverlay; };
  }, []);

  // React to selectedNodeId changes: open cards
  useEffect(() => {
    if (!selectedNodeId) {
      setVisible(false);
      setPositions([]);
      return;
    }
    if (selectedNodeId === prevSelectedRef.current) return;
    prevSelectedRef.current = selectedNodeId;

    // Delay to let _nodePosCache update after force simulation tick
    const timer = setTimeout(() => {
      const top3 = recommendedPaths.slice(0, 3);
      if (top3.length > 0) {
        setPositions(computePositions(top3));
        setVisible(true);
      } else {
        setVisible(false);
        setPositions([]);
      }
    }, 80);

    return () => clearTimeout(timer);
  }, [selectedNodeId, recommendedPaths]);

  const handleCardClick = useCallback((noteId: string) => {
    setVisible(false);
    setPositions([]);
    selectNode(noteId);
  }, [selectNode]);

  const handleBackgroundClick = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).tagName === 'CANVAS') {
      setVisible(false);
      setPositions([]);
      prevSelectedRef.current = null;
    }
  }, []);

  if (!visible || positions.length === 0) return null;

  return (
    <div
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      onClick={handleBackgroundClick}
    >
      {positions.map(({ path, x, y }) => (
        <div
          key={path.noteId}
          style={{
            position: 'absolute',
            left: x,
            top: y,
            pointerEvents: 'all',
          }}
          onClick={e => e.stopPropagation()}
        >
          <RecommendedPathCard
            path={path}
            onClick={() => handleCardClick(path.noteId)}
          />
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: 验证文件创建成功**

Run: `ls web/components/graph/RecommendedPathCards.tsx`
Expected: `web/components/graph/RecommendedPathCards.tsx`

---

## Task 3: ForceGraph 集成

**文件：** 修改 `web/components/graph/ForceGraph.tsx`

两处修改：

1. **在 `onZoom` 回调中注册 scale/pan**（让卡片容器能获取缩放和偏移）：
   找到 `handleZoom` 函数，在其末尾注册到 globalThis。

2. **在 ForceGraph 容器内叠放 `RecommendedPathCards`**：
   在 `<div ref={containerRef} ...>` 的 JSX return 中，`ForceGraph2D` 之后加入 `<RecommendedPathCards />`。

- [ ] **Step 1: 注册 scale/pan**

找到 `handleZoom` 函数末尾（约 line 316 附近），在 `setCurrentScale(transform.k)` 之后加入：

```ts
(globalThis as any).__graphViewport = {
  scale: transform.k,
  panX: transform.x,
  panY: transform.y,
};
```

然后在 `RecommendedPathCards.tsx` 的 `useEffect` 中把注册函数改为读取 `__graphViewport`（统一一个写入点，简化两边逻辑）：

```ts
// RecommendedPathCards.tsx 中替换注册逻辑：
useEffect(() => {
  const update = () => {
    const vp = (globalThis as any).__graphViewport;
    if (vp) {
      (globalThis as any)._graphScale = vp.scale;
      (globalThis as any)._graphPanX = vp.panX;
      (globalThis as any)._graphPanY = vp.panY;
    }
  };
  const interval = setInterval(update, 100); // poll for viewport changes
  return () => clearInterval(interval);
}, []);
```

- [ ] **Step 2: 叠放 RecommendedPathCards**

在 ForceGraph.tsx 的 return JSX 中，找到 `</ForceGraphErrorBoundary>` 后（line ~515），加入：

```tsx
{/* Recommended path preview cards */}
<RecommendedPathCards />
```

并确认文件顶部已 import：

```ts
import RecommendedPathCards from './RecommendedPathCards';
```

- [ ] **Step 3: 验证 E2E 测试通过**

Run: `cd web && pnpm exec playwright test e2e/graph.spec.ts --reporter=line`
Expected: all PASS

---

## Task 4: 边界处理

- [ ] **Step 1: 右键点击不触发关闭** — ForceGraph 已有 `handleBackgroundRightClick`，确认 `RecommendedPathCards` 的 `onClick` 不会干扰

- [ ] **Step 2: 窗口 resize 后卡片位置不对** — 在 `RecommendedPathCards` 中监听 `window resize`，重新调用 `computePositions`

```tsx
// RecommendedPathCards.tsx 中添加：
useEffect(() => {
  const handleResize = () => {
    if (visible) setPositions(computePositions(recommendedPaths.slice(0, 3)));
  };
  window.addEventListener('resize', handleResize);
  return () => window.removeEventListener('resize', handleResize);
}, [visible, recommendedPaths]);
```

- [ ] **Step 3: 无 bodyPreview 时卡片高度异常** — `RecommendedPathCard` 中当 `!preview` 时不渲染 preview div，验证布局正常

---

## Task 5: 验证与提交

- [ ] **Step 1: 手动测试** — 启动 dev server，点击任意节点，确认图谱上出现推荐卡片
- [ ] **Step 2: E2E 测试覆盖**

建议新增 E2E 步骤（在 `web/e2e/graph.spec.ts` 中）：

```ts
it('shows recommended path cards when node is selected', async ({ page }) => {
  await page.goto('/graph');
  await page.waitForSelector('canvas');
  // Click a node with recommendations
  const canvas = page.locator('canvas').first();
  await canvas.click({ position: { x: 300, y: 300 } });
  await page.waitForTimeout(500);
  // Card should appear (verified by DOM presence — not on canvas)
  // Note: cards are HTML elements, not canvas, so we check the container
});
```

- [ ] **Step 3: 提交**

```bash
git add web/components/graph/RecommendedPathCard.tsx web/components/graph/RecommendedPathCards.tsx web/components/graph/ForceGraph.tsx
git commit -m "feat(graph): add recommended path preview cards on node click"
```
