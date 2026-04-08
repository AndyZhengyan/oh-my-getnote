# Memex 2.0 Phase 2 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> **Worktree**: `/Users/zhengyan/Projects/ai-project/my-getnote-kg/.worktrees/phase2`

**Status:** ✅ 已完成

**Goal:** Next.js App Router 脚手架完成，Strategic Dark Tech Design Tokens 就位，三栏布局骨架可运行。

**Architecture:** Next.js 15 (App Router) + react-force-graph-2d + Zustand + Tailwind CSS + CSS Variables

---

## 文件结构（Phase 2 结束时）

```
web/                              # Next.js 项目根
├── app/
│   ├── globals.css              # Design Tokens（CSS Variables）
│   ├── layout.tsx               # 根布局：三个 Providers
│   ├── page.tsx                 # 根页面 → 重定向 /graph
│   └── graph/
│       └── page.tsx             # 主页面：三栏布局
│
├── components/
│   ├── graph/
│   │   └── ForceGraph.tsx      # react-force-graph-2d 封装
│   ├── panels/
│   │   ├── LeftNav.tsx         # 左侧导航栏（空壳）
│   │   └── RightPanel.tsx      # 右侧毛玻璃面板（空壳）
│   └── toolbar/
│       └── Toolbar.tsx          # 顶部工具栏
│
├── stores/
│   └── graphStore.ts            # Zustand store
│
├── lib/
│   ├── api.ts                  # 读 graph-index.json
│   └── note.ts                 # 读 .md 文件
│
└── public/
    ├── notes/                  # 软链接 → ../../notes
    ├── images/                 # 软链接 → ../../images
    └── graph-index.json         # 软链接 → ../../graph-index.json
```

---

## Task 1: Design Tokens + globals.css

**Files:**
- Modify: `web/app/globals.css`

- [ ] **Step 1: 替换 globals.css 内容**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  /* 背景 */
  --bg-base:     #0A0B10;
  --bg-surface:  #161B22;
  --bg-glass:    rgba(22, 27, 34, 0.85);
  --bg-elevated: #1C2330;

  /* 主色调 */
  --primary:     #00F5FF;
  --secondary:   #7000FF;
  --accent-warn: #FF3B3B;
  --accent-ok:   #00FF85;

  /* 文字 */
  --text-primary:   #E0E0E0;
  --text-secondary: #888888;
  --text-muted:     #444444;

  /* 边框 */
  --border-dim:  rgba(255, 255, 255, 0.07);
  --border-glow: rgba(0, 245, 255, 0.4);

  /* 圆角 */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;

  /* 字体 */
  --font-ui:   system-ui, -apple-system, "SF Pro Display", sans-serif;
  --font-mono: "JetBrains Mono", "Fira Code", monospace;
}

body {
  background: var(--bg-base);
  color: var(--text-primary);
  font-family: var(--font-ui);
}

/* 滚动条 */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
```

- [ ] **Step 2: 提交**

```bash
cd /Users/zhengyan/Projects/ai-project/my-getnote-kg/.worktrees/phase2
git add web/app/globals.css
git commit -m "feat(phase2): add Strategic Dark Tech Design Tokens

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 2: 创建软链接 + 验证数据可访问

**Files:**
- Create: `web/public/notes/`（软链接）
- Create: `web/public/images/`（软链接）
- Create: `web/public/graph-index.json`（软链接）

- [ ] **Step 1: 创建软链接**

```bash
cd /Users/zhengyan/Projects/ai-project/my-getnote-kg/.worktrees/phase2/web/public

# 软链接到项目根目录的 notes/images/graph-index.json
ln -sf ../../notes notes
ln -sf ../../images images
ln -sf ../../graph-index.json graph-index.json

# 验证
ls -la notes/ | head -3
ls -la graph-index.json
```

- [ ] **Step 2: 验证 JSON 可读**

```bash
node -e "const d=require('./public/graph-index.json'); console.log('notes:', d.stats.total_notes, 'connections:', d.stats.total_connections)"
```

Expected: `notes: 655 connections: 5240`

- [ ] **Step 3: 提交**

```bash
git add web/public/notes web/public/images web/public/graph-index.json
git commit -m "feat(phase2): symlink data files into public/

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Zustand Store

**Files:**
- Create: `web/stores/graphStore.ts`

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

  trailRecording: false,
  currentTrail: [],

  setGraphIndex: (index) => set({ graphIndex: index, loaded: true }),

  setDomainFilter: (domain) => set({ domainFilter: domain }),
  setTypeFilter: (type) => set({ typeFilter: type }),
  setSearchQuery: (query) => set({ searchQuery: query }),

  selectNode: (id) => set({ selectedNodeId: id }),
  focusNode: (id) => set({ focusedNodeId: id }),

  startTrail: () => set({ trailRecording: true, currentTrail: [] }),
  addToTrail: (id) =>
    set((state) => ({ currentTrail: [...state.currentTrail, id] })),
  finishTrail: () => set({ trailRecording: false }),
}));
```

- [ ] **提交**

```bash
git add web/stores/graphStore.ts
git commit -m "feat(phase2): add Zustand graph store

State: filters, selection, trail recording, graphIndex data.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 4: lib/api.ts — 加载 graph-index.json

**Files:**
- Create: `web/lib/api.ts`

```typescript
// web/lib/api.ts

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

export async function loadGraphIndex(): Promise<GraphIndex> {
  const res = await fetch('/graph-index.json');
  if (!res.ok) throw new Error(`Failed to load graph-index.json: ${res.status}`);
  return res.json();
}
```

- [ ] **提交**

```bash
git add web/lib/api.ts
git commit -m "feat(phase2): add graph-index.json loader

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 5: lib/note.ts — 按需加载笔记正文

**Files:**
- Create: `web/lib/note.ts`

```typescript
// web/lib/note.ts
import matter from 'gray-matter';

export interface NoteFrontmatter {
  id: string;
  title: string;
  type: string;
  tags: string[];
  domain: string;
  date?: string;
  connections?: Array<{ noteId: string; score: number; type: string }>;
  x?: number;
  y?: number;
  ai_summary?: string;
}

export interface NoteContent {
  frontmatter: NoteFrontmatter;
  body: string;
}

export async function loadNote(path: string): Promise<NoteContent | null> {
  try {
    const res = await fetch(`/${path}`);
    if (!res.ok) return null;
    const text = await res.text();
    const { data, content } = matter(text);
    return {
      frontmatter: data as NoteFrontmatter,
      body: content.trim(),
    };
  } catch {
    return null;
  }
}
```

需要安装 gray-matter 的类型定义：
```bash
cd web && npm install --save-dev @types/gray-matter
```

- [ ] **提交**

```bash
git add web/lib/note.ts
git commit -m "feat(phase2): add note loader with gray-matter frontmatter parsing

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 6: 根布局 + 重定向 + 全局 Providers

**Files:**
- Modify: `web/app/layout.tsx`

```tsx
// web/app/layout.tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Memex 2.0 — 知识图谱',
  description: 'Strategic Dark Tech 知识加速器',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
```

**Files:**
- Modify: `web/app/page.tsx`

```tsx
// web/app/page.tsx
import { redirect } from 'next/navigation';

export default function Home() {
  redirect('/graph');
}
```

- [ ] **提交**

```bash
git add web/app/layout.tsx web/app/page.tsx
git commit -m "feat(phase2): root layout with metadata and redirect to /graph

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 7: Toolbar 组件

**Files:**
- Create: `web/components/toolbar/Toolbar.tsx`

```tsx
// web/components/toolbar/Toolbar.tsx
'use client';

import { useGraphStore } from '@/stores/graphStore';
import { Search, Filter, RotateCcw, Route, Settings } from 'lucide-react';

export default function Toolbar() {
  const { graphIndex, domainFilter, typeFilter, searchQuery,
    setDomainFilter, setTypeFilter, setSearchQuery, startTrail, trailRecording } =
    useGraphStore();

  const domains = graphIndex?.domains ?? [];
  const types = Object.keys(graphIndex?.stats.by_type ?? {});

  return (
    <header
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0,
        height: 52,
        background: 'var(--bg-glass)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border-dim)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '0 16px',
        zIndex: 100,
      }}
    >
      <span style={{ fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap' }}>
        📚 Memex
      </span>

      {/* Search */}
      <div style={{ flex: 1, maxWidth: 360 }}>
        <div style={{ position: 'relative' }}>
          <Search
            size={14}
            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
          />
          <input
            type="search"
            placeholder="搜索笔记标题、内容、标签…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid var(--border-dim)',
              borderRadius: 8,
              color: 'var(--text-primary)',
              padding: '5px 12px 5px 32px',
              fontSize: 13,
              outline: 'none',
            }}
          />
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 6 }}>
        <select
          value={domainFilter}
          onChange={e => setDomainFilter(e.target.value)}
          style={{
            background: 'rgba(255,255,255,0.07)',
            border: '1px solid var(--border-dim)',
            borderRadius: 6,
            color: 'var(--text-secondary)',
            padding: '5px 8px',
            fontSize: 12,
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          <option value="">全部领域</option>
          {domains.map(d => <option key={d} value={d}>{d}</option>)}
        </select>

        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          style={{
            background: 'rgba(255,255,255,0.07)',
            border: '1px solid var(--border-dim)',
            borderRadius: 6,
            color: 'var(--text-secondary)',
            padding: '5px 8px',
            fontSize: 12,
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          <option value="">全部类型</option>
          {types.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* Stats */}
      {graphIndex && (
        <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
          {graphIndex.stats.total_notes} 篇 · {graphIndex.stats.total_connections} 条关联
        </span>
      )}

      {/* Trail button */}
      <button
        onClick={startTrail}
        style={{
          background: trailRecording ? 'rgba(0,245,255,0.15)' : 'rgba(255,255,255,0.05)',
          border: `1px solid ${trailRecording ? 'rgba(0,245,255,0.35)' : 'rgba(255,255,255,0.08)'}`,
          borderRadius: 6,
          color: trailRecording ? 'var(--primary)' : 'var(--text-secondary)',
          padding: '5px 10px',
          fontSize: 12,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <Route size={12} />
        {trailRecording ? '记录中…' : '轨迹'}
      </button>
    </header>
  );
}
```

- [ ] **提交**

```bash
git add web/components/toolbar/Toolbar.tsx
git commit -m "feat(phase2): add Toolbar component with search and filters

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 8: ForceGraph 组件（基础封装）

**Files:**
- Create: `web/components/graph/ForceGraph.tsx`

```tsx
// web/components/graph/ForceGraph.tsx
'use client';

import { useCallback, useEffect, useRef } from 'react';
import ForceGraph2D, { ForceGraphMethods } from 'react-force-graph-2d';
import { useGraphStore } from '@/stores/graphStore';

// 领域颜色映射
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

interface GraphNode {
  id: string;
  title: string;
  domain: string;
  type: string;
  x?: number;
  y?: number;
  connections: number;
}

interface GraphLink {
  source: string;
  target: string;
  score?: number;
}

export default function ForceGraph() {
  const fgRef = useRef<ForceGraphMethods>();
  const {
    graphIndex, domainFilter, typeFilter, searchQuery,
    selectedNodeId, selectNode,
  } = useGraphStore();

  // 构建节点和边
  const { nodes, links } = buildGraphData(graphIndex, domainFilter, typeFilter, searchQuery);

  useEffect(() => {
    if (fgRef.current) {
      fgRef.current.d3Force('charge')?.strength(-80);
      fgRef.current.d3Force('link')?.distance(60);
    }
  }, []);

  const handleNodeClick = useCallback((node: GraphNode) => {
    selectNode(node.id);
  }, [selectNode]);

  const handleBackgroundClick = useCallback(() => {
    selectNode(null);
  }, [selectNode]);

  return (
    <ForceGraph2D
      ref={fgRef}
      graphData={{ nodes, links }}
      width={typeof window !== 'undefined' ? window.innerWidth - 280 - 360 : 800}
      height={typeof window !== 'undefined' ? window.innerHeight - 52 : 600}
      nodeCanvasObject={(node, ctx, globalScale) => {
        const n = node as GraphNode & { x: number; y: number };
        const r = 6 + Math.min(n.connections / 2, 12);
        const color = DOMAIN_COLORS[n.domain] ?? '#6B7280';
        const isSelected = n.id === selectedNodeId;

        // Glow for selected
        if (isSelected) {
          const grad = ctx.createRadialGradient(n.x, n.y, r, n.x, n.y, r * 2.5);
          grad.addColorStop(0, 'rgba(0,245,255,0.25)');
          grad.addColorStop(1, 'rgba(0,245,255,0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(n.x, n.y, r * 2.5, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(n.x, n.y, r * (isSelected ? 1.2 : 1), 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.85;
        ctx.fill();
        ctx.globalAlpha = 1;

        if (isSelected) {
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }}
      linkColor={() => 'rgba(80,100,140,0.2)'}
      linkWidth={0.8}
      onNodeClick={handleNodeClick}
      onBackgroundClick={handleBackgroundClick}
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
): { nodes: GraphNode[]; links: GraphLink[] } {
  if (!index) return { nodes: [], links: [] };

  const q = searchQuery.toLowerCase();
  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];
  const seenNodes = new Set<string>();

  for (const [id, entry] of Object.entries(index.index)) {
    if (domainFilter && entry.domain !== domainFilter) continue;
    if (typeFilter && entry.type !== typeFilter) continue;
    if (q && !entry.title.toLowerCase().includes(q)) continue;

    if (!seenNodes.has(id)) {
      seenNodes.add(id);
      nodes.push({
        id,
        title: entry.title,
        domain: entry.domain,
        type: entry.type,
        connections: entry.connections.length,
      });
    }

    for (const conn of entry.connections) {
      if (!seenNodes.has(conn.noteId)) {
        seenNodes.add(conn.noteId);
        const target = index.index[conn.noteId];
        if (target) {
          nodes.push({
            id: conn.noteId,
            title: target.title,
            domain: target.domain,
            type: target.type,
            connections: target.connections.length,
          });
        }
      }
      links.push({ source: id, target: conn.noteId, score: conn.score });
    }
  }

  return { nodes, links };
}
```

- [ ] **提交**

```bash
git add web/components/graph/ForceGraph.tsx
git commit -m "feat(phase2): add ForceGraph component with react-force-graph-2d

Domain colors, selection glow, filtered view, search/filter support.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 9: LeftNav + RightPanel 空壳组件

**Files:**
- Create: `web/components/panels/LeftNav.tsx`
- Create: `web/components/panels/RightPanel.tsx`

LeftNav.tsx:
```tsx
'use client';
import { useGraphStore } from '@/stores/graphStore';

export default function LeftNav() {
  const { graphIndex } = useGraphStore();

  return (
    <aside style={{
      width: 280,
      height: 'calc(100vh - 52px)',
      position: 'fixed',
      top: 52,
      left: 0,
      background: 'rgba(22,27,34,0.6)',
      borderRight: '1px solid var(--border-dim)',
      overflowY: 'auto',
      padding: '16px 0',
    }}>
      <div style={{ padding: '0 16px 8px', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        知识领域
      </div>
      {graphIndex?.domains.map(domain => (
        <div key={domain} style={{
          padding: '8px 16px',
          fontSize: 13,
          color: 'var(--text-secondary)',
          cursor: 'pointer',
        }}>
          <span style={{ color: 'var(--text-muted)', fontSize: 11, marginRight: 8 }}>
            {graphIndex.stats.by_domain[domain] ?? 0}
          </span>
          {domain}
        </div>
      ))}
    </aside>
  );
}
```

RightPanel.tsx:
```tsx
'use client';
import { useGraphStore } from '@/stores/graphStore';
import { X } from 'lucide-react';

export default function RightPanel() {
  const { selectedNodeId, graphIndex, selectNode } = useGraphStore();

  if (!selectedNodeId || !graphIndex) return null;

  const entry = graphIndex.index[selectedNodeId];
  if (!entry) return null;

  return (
    <aside style={{
      position: 'fixed',
      right: 16,
      top: 64,
      width: 360,
      maxHeight: 'calc(100vh - 80px)',
      background: 'var(--bg-glass)',
      backdropFilter: 'blur(20px)',
      border: '1px solid var(--border-dim)',
      borderRadius: 12,
      boxShadow: 'var(--shadow-glass)',
      overflowY: 'auto',
      zIndex: 200,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 12px', borderBottom: '1px solid var(--border-dim)' }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {entry.title}
        </h3>
        <button onClick={() => selectNode(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: '0 2px' }}>
          <X size={18} />
        </button>
      </div>
      <div style={{ padding: '12px 16px', fontSize: 12 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
          {entry.type} · {entry.domain}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          点击查看笔记正文
        </div>
        {entry.connections.length > 0 && (
          <div style={{ marginTop: 16, fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            相似笔记 ({entry.connections.length})
          </div>
        )}
      </div>
    </aside>
  );
}
```

- [ ] **提交**

```bash
git add web/components/panels/LeftNav.tsx web/components/panels/RightPanel.tsx
git commit -m "feat(phase2): add LeftNav and RightPanel shell components

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 10: 主页面 app/graph/page.tsx

**Files:**
- Create: `web/app/graph/page.tsx`

```tsx
// web/app/graph/page.tsx
'use client';

import { useEffect } from 'react';
import { useGraphStore } from '@/stores/graphStore';
import { loadGraphIndex } from '@/lib/api';
import Toolbar from '@/components/toolbar/Toolbar';
import LeftNav from '@/components/panels/LeftNav';
import RightPanel from '@/components/panels/RightPanel';
import ForceGraph from '@/components/graph/ForceGraph';

export default function GraphPage() {
  const { setGraphIndex, loaded, error, graphIndex } = useGraphStore();

  useEffect(() => {
    if (!loaded) {
      loadGraphIndex()
        .then(setGraphIndex)
        .catch(err => console.error('Failed to load graph:', err));
    }
  }, [loaded, setGraphIndex]);

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-muted)' }}>
        <div>加载失败: {error}</div>
      </div>
    );
  }

  if (!loaded || !graphIndex) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-muted)', fontSize: 14 }}>
        加载中…
      </div>
    );
  }

  return (
    <main>
      <Toolbar />
      <LeftNav />
      <div style={{ marginLeft: 280, marginTop: 52, height: 'calc(100vh - 52px)' }}>
        <ForceGraph />
      </div>
      <RightPanel />
    </main>
  );
}
```

- [ ] **提交**

```bash
git add web/app/graph/page.tsx
git commit -m "feat(phase2): add main graph page with three-column layout

Toolbar + LeftNav + ForceGraph + RightPanel.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 11: 构建验证

- [ ] **Step 1: 构建**

```bash
cd /Users/zhengyan/Projects/ai-project/my-getnote-kg/.worktrees/phase2/web
npm run build 2>&1
```

Expected: 构建成功，无 TypeScript 错误

- [ ] **Step 2: 启动开发服务器（后台）**

```bash
npm run dev 2>&1 &
sleep 5
curl -s http://localhost:3000/graph | head -5
```

Expected: HTML 返回正常

- [ ] **Step 3: 提交**

```bash
cd /Users/zhengyan/Projects/ai-project/my-getnote-kg/.worktrees/phase2
git add web/
git commit -m "feat(phase2): complete Next.js scaffold with three-column layout

Next.js App Router, Strategic Dark Tech Design Tokens, Zustand store,
ForceGraph, Toolbar, LeftNav, RightPanel.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## 验收清单

- [ ] `npm run build` 成功，无 TS 错误
- [ ] 访问 `http://localhost:3000/graph` 显示图谱（数据来自 graph-index.json）
- [ ] 工具栏显示 655 篇笔记、5240 条关联
- [ ] 领域筛选下拉菜单有数据
- [ ] 点击节点右侧面板展开
- [ ] 代码已提交到 GitHub
