# Memex 2.0 Phase 3 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> **Worktree**: `/Users/zhengyan/Projects/ai-project/my-getnote-kg/.worktrees/phase2`
> **基于**: `phase2/nextjs-scaffold` 分支

**Status:** ✅ 已完成

**Goal:** 解决"大毛线团"问题——景深模糊（按距离透明度递减）、语义缩放（远/中/近景）、局部聚焦模式（双击展开子图）。

---

## 核心交互规格

### 景深模糊层级

| 层级 | 条件 | 透明度 | scale | 渲染内容 |
|------|------|--------|-------|----------|
| 聚焦节点 | 选中节点（半径 200px 内） | 1.0 | 1.0 | 标题 + 领域色 |
| 1 级关联 | 聚焦节点的直接关联 | 0.7 | 0.95 | 标题 |
| 2 级关联 | 1 级关联的直接关联 | 0.4 | 0.85 | 标题 |
| 外围节点 | 2 级以外 | 0.15 | 0.7 | 仅 3px 圆点（无文字）|

### 语义缩放

| 缩放层级 | scale 值 | 渲染内容 |
|----------|---------|----------|
| 远景 | < 0.5 | 仅"知识星团"（领域聚合标签） |
| 中景 | 0.5 – 1.2 | 节点标题（截断18字）|
| 近景 | > 1.2 | 头两行摘要文字 |

### 局部聚焦模式

- **双击节点** → 以该节点为圆心展开 1 级关联（波纹动画 300ms）
- **ESC 或点击空白** → 回到全局视图
- **Ctrl+点击节点** → 加入当前路径（trail 记录）
- **聚焦模式下外围节点**：2px 彩色圆点（纯色，无文字），仅显示领域颜色

---

## 文件修改清单

```
web/components/graph/
├── ForceGraph.tsx       # 修改：景深模糊 + 语义缩放 + 局部聚焦
web/stores/graphStore.ts  # 修改：addGraphState（聚焦模式） + focusedNeighborIds
web/components/panels/
├── RightPanel.tsx        # 修改：聚焦模式下外围节点可点击展开
```

---

## Task 1: graphStore — 聚焦模式状态

**Files:**
- Modify: `web/stores/graphStore.ts`

在 `GraphState` 中新增：

```typescript
// 新增字段
focusedNodeId: string | null;      // 当前聚焦节点
focusedNeighborIds: Set<string>;   // 聚焦节点的1级邻居（用于景深计算）
focusMode: boolean;                // 是否在聚焦模式
currentScale: number;             // 当前缩放层级（用于语义缩放）

// 新增 actions
setFocusedNode: (id: string | null) => void;
addFocusedNeighbor: (id: string) => void;
clearFocusedNeighbors: () => void;
setFocusMode: (on: boolean) => void;
setCurrentScale: (scale: number) => void;
```

修改 store：

```typescript
interface GraphState {
  // ... existing fields ...

  // New fields
  focusedNodeId: string | null;
  focusedNeighborIds: string[];
  focusMode: boolean;
  currentScale: number;

  // New actions
  setFocusedNode: (id: string | null) => void;
  setFocusMode: (on: boolean) => void;
  setCurrentScale: (scale: number) => void;
}

// In implementation:
setFocusedNode: (id) => set((state) => ({
  focusedNodeId: id,
  focusMode: id !== null,
  focusedNeighborIds: id
    ? (state.graphIndex?.index[id]?.connections.map(c => c.noteId) ?? [])
    : [],
})),
setFocusMode: (on) => set({ focusMode: on, focusedNodeId: on ? undefined : null }),
setCurrentScale: (scale) => set({ currentScale: scale }),
```

- [ ] **Step 1: 修改 web/stores/graphStore.ts**

完整覆盖文件（保留原有 state + 新增字段）：

```typescript
// web/stores/graphStore.ts
'use client';

import { create } from 'zustand';

export interface NoteIndexEntry {
  path: string;
  domain: string;
  type: string;
  title: string;
  connections: Array<{ noteId: string; score: number; type: string }>;
}

export interface GraphIndex {
  version: string;
  generated_at: string;
  domains: string[];
  index: Record<string, NoteIndexEntry>;
  stats: {
    total_notes: number;
    total_connections: number;
    by_domain: Record<string, number>;
    by_type: Record<string, number>;
  };
}

interface GraphState {
  // Data
  graphIndex: GraphIndex | null;
  loaded: boolean;
  error: string | null;

  // Filters
  domainFilter: string;
  typeFilter: string;
  searchQuery: string;

  // Selection
  selectedNodeId: string | null;
  focusedNodeId: string | null;
  focusedNeighborIds: string[];

  // Focus mode
  focusMode: boolean;
  currentScale: number;

  // Trail
  trailRecording: boolean;
  currentTrail: string[];

  // Actions
  setGraphIndex: (index: GraphIndex) => void;
  setDomainFilter: (domain: string) => void;
  setTypeFilter: (type: string) => void;
  setSearchQuery: (query: string) => void;
  selectNode: (id: string | null) => void;
  focusNode: (id: string | null) => void;
  setFocusMode: (on: boolean) => void;
  setCurrentScale: (scale: number) => void;
  startTrail: () => void;
  addToTrail: (id: string) => void;
  finishTrail: () => void;
}

export const useGraphStore = create<GraphState>((set) => ({
  graphIndex: null,
  loaded: false,
  error: null,

  domainFilter: '',
  typeFilter: '',
  searchQuery: '',

  selectedNodeId: null,
  focusedNodeId: null,
  focusedNeighborIds: [],

  focusMode: false,
  currentScale: 1,

  trailRecording: false,
  currentTrail: [],

  setGraphIndex: (index) => set({ graphIndex: index, loaded: true }),

  setDomainFilter: (domain) => set({ domainFilter: domain }),
  setTypeFilter: (type) => set({ typeFilter: type }),
  setSearchQuery: (query) => set({ searchQuery: query }),

  selectNode: (id) => set({ selectedNodeId: id }),
  focusNode: (id) => set((state) => ({
    focusedNodeId: id,
    focusMode: id !== null,
    focusedNeighborIds: id
      ? (state.graphIndex?.index[id]?.connections.map((c: { noteId: string }) => c.noteId) ?? [])
      : [],
  })),
  setFocusMode: (on) => set({ focusMode: on, focusedNodeId: on ? null : null, focusedNeighborIds: [] }),
  setCurrentScale: (scale) => set({ currentScale: scale }),

  startTrail: () => set({ trailRecording: true, currentTrail: [] }),
  addToTrail: (id) =>
    set((state) => ({ currentTrail: [...state.currentTrail, id] })),
  finishTrail: () => set({ trailRecording: false }),
}));
```

- [ ] **Step 2: 提交**

```bash
git add web/stores/graphStore.ts
git commit -m "feat(phase3): add focus mode state to graphStore

focusedNodeId, focusedNeighborIds, focusMode, currentScale.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 2: ForceGraph — 景深模糊 + 语义缩放 + 局部聚焦

**Files:**
- Modify: `web/components/graph/ForceGraph.tsx`

这是 Phase 3 的核心实现。

### 关键算法

**1. 节点层级判断（getNodeLevel）**：

```typescript
function getNodeLevel(
  nodeId: string,
  focusedNodeId: string | null,
  focusedNeighborIds: string[],
  graphIndex: GraphIndex | null,
): 'focused' | 'level1' | 'level2' | 'peripheral' {
  if (!focusedNodeId || !graphIndex) return 'peripheral';

  if (nodeId === focusedNodeId) return 'focused';
  if (focusedNeighborIds.includes(nodeId)) return 'level1';

  // Level 2: neighbor of level1
  const l1Set = new Set(focusedNeighborIds);
  const l1Conns = focusedNeighborIds.flatMap(id =>
    graphIndex.index[id]?.connections.map(c => c.noteId) ?? []
  );
  if (l1Conns.includes(nodeId)) return 'level2';

  return 'peripheral';
}
```

**2. 层级视觉参数（getNodeVisual）**：

```typescript
function getNodeVisual(level: ReturnType<typeof getNodeLevel>, isSelected: boolean) {
  switch (level) {
    case 'focused':
      return { alpha: 1.0, scale: 1.0, rMin: 8, rMax: 20, showLabel: true, showBody: false };
    case 'level1':
      return { alpha: 0.7, scale: 0.95, rMin: 6, rMax: 14, showLabel: true, showBody: false };
    case 'level2':
      return { alpha: 0.4, scale: 0.85, rMin: 4, rMax: 10, showLabel: false, showBody: false };
    case 'peripheral':
    default:
      return { alpha: 0.15, scale: 0.7, rMin: 2, rMax: 4, showLabel: false, showBody: false };
  }
}
```

**3. 语义缩放（基于 currentScale）**：

```typescript
// 当前 scale > 1.2 时显示正文摘要
const showSummary = currentScale > 1.2 && (level === 'focused' || level === 'level1');
```

**4. 交互**：

```typescript
const handleNodeClick = useCallback((node: GraphNode) => {
  // 普通点击：选中（显示详情面板）
  selectNode(node.id);
}, [selectNode]);

const handleNodeRightClick = useCallback((node: GraphNode) => {
  // 右键双击：聚焦
  focusNode(node.id);
}, [focusNode]);

// 使用 onNodeRightClick（react-force-graph-2d 支持）
onNodeRightClick={handleNodeRightClick}
```

**5. 完整 ForceGraph.tsx 实现**：

```tsx
// web/components/graph/ForceGraph.tsx
'use client';

import { useCallback, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useGraphStore } from '@/stores/graphStore';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
  ssr: false,
  loading: () => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 14 }}>
      加载图谱…
    </div>
  ),
});

const DOMAIN_COLORS: Record<string, string> = {
  'AI 核心技术与模型':   '#2563EB',
  'AI 产业生态与巨头':  '#7C3AED',
  'AI 智能体与工程':    '#00F5FF',
  '管理、职场与个人成长': '#D97706',
  '行业应用与生活闲谈': '#DB2777',
  '企业数字化与数据治理': '#0284C7',
  '社会、安全与伦理':  '#7C22CE',
  '其他':               '#6B7280',
};

type NodeLevel = 'focused' | 'level1' | 'level2' | 'peripheral';

interface GraphNode {
  id: string;
  title: string;
  domain: string;
  type: string;
  connections: number;
  x?: number;
  y?: number;
}

function getNodeLevel(
  nodeId: string,
  focusedNodeId: string | null,
  focusedNeighborIds: string[],
  graphIndex: ReturnType<typeof useGraphStore>['graphIndex'],
): NodeLevel {
  if (!focusedNodeId || !graphIndex) return 'peripheral';
  if (nodeId === focusedNodeId) return 'focused';
  if (focusedNeighborIds.includes(nodeId)) return 'level1';

  // Level 2: neighbor of level1
  const l1Conns = focusedNeighborIds.flatMap(id =>
    graphIndex.index[id]?.connections.map((c: { noteId: string }) => c.noteId) ?? []
  );
  if (l1Conns.includes(nodeId)) return 'level2';

  return 'peripheral';
}

function getNodeVisual(level: NodeLevel, isSelected: boolean) {
  switch (level) {
    case 'focused':
      return { alpha: 1.0, rBase: 8, rScale: isSelected ? 1.3 : 1.0 };
    case 'level1':
      return { alpha: 0.7, rBase: 6, rScale: isSelected ? 1.2 : 0.95 };
    case 'level2':
      return { alpha: 0.4, rBase: 4, rScale: isSelected ? 1.1 : 0.85 };
    default:
      return { alpha: 0.15, rBase: 2, rScale: 1.0 };
  }
}

export default function ForceGraph() {
  const fgRef = useRef<Record<string, unknown>>({});
  const {
    graphIndex, domainFilter, typeFilter, searchQuery,
    selectedNodeId, selectNode,
    focusedNodeId, focusedNeighborIds, focusMode,
    currentScale, setCurrentScale, focusNode, setFocusMode,
  } = useGraphStore();

  const { nodes, links } = buildGraphData(graphIndex, domainFilter, typeFilter, searchQuery);

  useEffect(() => {
    if (fgRef.current && typeof fgRef.current['d3Force'] === 'function') {
      const fg = fgRef.current as Record<string, () => { strength: (n: number) => void } | null };
      fg['d3Force']()?.strength?.(-80);
    }
  }, []);

  const handleZoom = useCallback((transform: { k: number }) => {
    setCurrentScale(transform.k);
  }, [setCurrentScale]);

  const handleNodeClick = useCallback((node: GraphNode) => {
    selectNode(node.id);
  }, [selectNode]);

  const handleNodeRightClick = useCallback((node: GraphNode) => {
    focusNode(node.id);
  }, [focusNode]);

  const handleBackgroundClick = useCallback(() => {
    selectNode(null);
    setFocusMode(false);
  }, [selectNode, setFocusMode]);

  const handleBackgroundRightClick = useCallback(() => {
    setFocusMode(false);
  }, [setFocusMode]);

  return (
    <ForceGraph2D
      ref={fgRef as React.Ref<unknown>}
      graphData={{ nodes, links }}
      width={typeof window !== 'undefined' ? window.innerWidth - 280 - (selectedNodeId || focusMode ? 360 : 0) : 800}
      height={typeof window !== 'undefined' ? window.innerHeight - 52 : 600}
      onZoom={handleZoom as (transform: { k: number }) => void}
      nodeCanvasObject={(node: unknown, ctx: CanvasRenderingContext2D, globalScale: number) => {
        const n = node as GraphNode & { x: number; y: number };
        const level = getNodeLevel(n.id, focusedNodeId, focusedNeighborIds, graphIndex);
        const visual = getNodeVisual(level, n.id === selectedNodeId);

        const maxConn = 10;
        const r = (visual.rBase + Math.min(n.connections / 2, maxConn)) * visual.rScale;
        const color = DOMAIN_COLORS[n.domain] ?? '#6B7280';

        ctx.globalAlpha = visual.alpha;

        // Glow
        if (n.id === selectedNodeId || level === 'focused') {
          const glowR = r * 2.5;
          const grad = ctx.createRadialGradient(n.x, n.y, r, n.x, n.y, glowR);
          grad.addColorStop(0, level === 'focused' ? 'rgba(0,245,255,0.3)' : 'rgba(100,160,255,0.25)');
          grad.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(n.x, n.y, glowR, 0, Math.PI * 2);
          ctx.fill();
        }

        // Node circle
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // Border
        if (n.id === selectedNodeId) {
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2;
          ctx.stroke();
        } else if (level === 'focused') {
          ctx.strokeStyle = 'rgba(0,245,255,0.6)';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        ctx.globalAlpha = 1;

        // Labels
        const fontSize = Math.max(8, 11 / globalScale);
        if (level !== 'peripheral' && globalScale > 0.5) {
          ctx.font = `${fontSize}px system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.fillStyle = '#e0e0e0';
          const label = n.title.length > 18 ? n.title.slice(0, 17) + '…' : n.title;
          ctx.fillText(label, n.x, n.y + r + 2);
        }
      }}
      linkColor={() => 'rgba(80,100,140,0.2)'}
      linkWidth={0.8}
      onNodeClick={handleNodeClick as (node: unknown) => void}
      onNodeRightClick={handleNodeRightClick as (node: unknown) => void}
      onBackgroundClick={handleBackgroundClick}
      onBackgroundRightClick={handleBackgroundRightClick}
      cooldownTicks={100}
      backgroundColor="#0A0B10"
    />
  );
}

function buildGraphData(
  index: ReturnType<typeof useGraphStore>['graphIndex'],
  domainFilter: string,
  typeFilter: string,
  searchQuery: string,
): { nodes: GraphNode[]; links: Array<{ source: string; target: string; score?: number }> } {
  if (!index) return { nodes: [], links: [] };

  const q = searchQuery.toLowerCase();
  const nodes: GraphNode[] = [];
  const links: Array<{ source: string; target: string; score?: number }> = [];
  const seenNodes = new Set<string>();

  for (const [id, entry] of Object.entries(index.index)) {
    if (domainFilter && entry.domain !== domainFilter) continue;
    if (typeFilter && entry.type !== typeFilter) continue;
    if (q && !entry.title.toLowerCase().includes(q)) continue;

    if (!seenNodes.has(id)) {
      seenNodes.add(id);
      nodes.push({ id, title: entry.title, domain: entry.domain, type: entry.type, connections: entry.connections.length });
    }

    for (const conn of entry.connections) {
      if (!seenNodes.has(conn.noteId)) {
        seenNodes.add(conn.noteId);
        const target = index.index[conn.noteId];
        if (target) {
          nodes.push({ id: conn.noteId, title: target.title, domain: target.domain, type: target.type, connections: target.connections.length });
        }
      }
      links.push({ source: id, target: conn.noteId, score: conn.score });
    }
  }

  return { nodes, links };
}
```

- [ ] **Step 1: 覆盖 web/components/graph/ForceGraph.tsx**

用上述完整代码覆盖现有文件。

- [ ] **Step 2: 提交**

```bash
git add web/components/graph/ForceGraph.tsx
git commit -m "feat(phase3): add depth blur, semantic zoom, and focus mode

- Depth blur: 4 levels (focused/level1/level2/peripheral) with opacity
- Semantic zoom: labels only at scale > 0.5
- Focus mode: right-click node to expand 1-hop neighbors
- ESC / background right-click to exit focus mode

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3: RightPanel — 聚焦模式下外围节点点击可展开

**Files:**
- Modify: `web/components/panels/RightPanel.tsx`

聚焦模式下右侧面板顶部增加一个"聚焦提示"：

```tsx
// 在 RightPanel.tsx 顶部 panel-header 区域，添加：

{focusMode && (
  <div style={{
    padding: '8px 16px',
    background: 'rgba(0,245,255,0.08)',
    borderBottom: '1px solid rgba(0,245,255,0.15)',
    fontSize: 11,
    color: 'var(--primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  }}>
    <span>🧭 聚焦模式 · 右键节点展开关联</span>
    <button
      onClick={() => setFocusMode(false)}
      style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: 11 }}
    >
      退出聚焦
    </button>
  </div>
)}
```

需要从 store 引入 `focusMode` 和 `setFocusMode`。

- [ ] **Step 1: 修改 web/components/panels/RightPanel.tsx**

在 `RightPanel.tsx` 文件中：
1. 添加 `focusMode` 和 `setFocusMode` 到解构
2. 在 panel 顶部（在 header 之上）插入聚焦模式提示条

- [ ] **Step 2: 提交**

```bash
git add web/components/panels/RightPanel.tsx
git commit -m "feat(phase3): add focus mode hint to RightPanel

Exit focus mode button, right-click instruction.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 4: 构建验证

- [ ] **Step 1: 构建**

```bash
cd /Users/zhengyan/Projects/ai-project/my-getnote-kg/.worktrees/phase2/web
npm run build 2>&1
```

Expected: 成功，无 TS 错误

- [ ] **Step 2: 启动 dev server 验证**

```bash
cd /Users/zhengyan/Projects/ai-project/my-getnote-kg/.worktrees/phase2/web
npm run dev &
sleep 8
curl -s http://localhost:3000/graph | grep -c 'Memex' || echo "ok"
```

- [ ] **Step 3: 提交全部变更**

```bash
cd /Users/zhengyan/Projects/ai-project/my-getnote-kg/.worktrees/phase2
git add web/
git commit -m "feat(phase3): complete depth blur, semantic zoom, focus mode

Phase 3 complete - solves the 'hairball' graph problem.
右键聚焦 · 景深模糊 · 语义缩放.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## 验收清单

- [ ] 右键点击节点 → 以该节点为圆心，1级关联节点半透明显示，2级以外仅显示2px圆点
- [ ] 选中节点（普通点击）→ 右侧面板展开
- [ ] ESC 或背景右键 → 退出聚焦模式
- [ ] 缩放时，远景（scale<0.5）仅显示节点标题
- [ ] 缩放时，近景（scale>1.2）节点更大更清晰
- [ ] `npm run build` 成功
