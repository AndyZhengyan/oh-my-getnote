# 三栏布局重构实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将图谱页面从"底板+浮动卡片"改为类 ChatGPT 三栏独立面板，搜索改为 LeftNav 顶部触发浮窗。

**Architecture:** 三栏 flex 布局，LeftNav/RightPanel 都是 flex item 而非 fixed overlay。SearchModal 是新建的浮窗组件。Toolbar 精简到只剩 Logo + 统计 + 重置。

**Tech Stack:** Next.js, React, framer-motion (已有), zustand (store)

---

## 文件结构

```
app/graph/page.tsx          修改: 三栏 flex 容器
components/panels/LeftNav.tsx   修改: 收起态图标化
components/panels/RightPanel.tsx 修改: width 0↔380 动画
components/toolbar/Toolbar.tsx   修改: 去掉搜索框、领域/类型下拉
components/search/SearchModal.tsx   新建: 搜索浮窗
stores/graphStore.ts        修改: 新增 searchModalOpen 状态
```

---

## Task 1: Toolbar 精简

去掉搜索框、领域下拉、类型下拉，只保留 Logo + 统计 + 重置。

**Files:**
- Modify: `web/components/toolbar/Toolbar.tsx`

- [ ] **Step 1: 读取 Toolbar 当前完整内容**

```bash
cat web/components/toolbar/Toolbar.tsx
```

- [ ] **Step 2: 重写 Toolbar，只保留 Logo + 统计 + 重置**

删除 `domainFilter, typeFilter, searchQuery` 相关代码。简化后的结构：

```tsx
// web/components/toolbar/Toolbar.tsx
'use client';
import { useGraphStore } from '@/stores/graphStore';
import { RotateCcw } from 'lucide-react';

export default function Toolbar() {
  const { graphIndex, selectNode } = useGraphStore();

  const handleReset = () => {
    selectNode(null);
  };

  return (
    <div style={{
      position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)',
      height: 52, display: 'flex', alignItems: 'center', gap: 16,
      background: 'var(--bg-surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)', padding: '0 20px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)', zIndex: 100,
      width: '90vw', maxWidth: 800,
    }}>
      <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
        📚 Oh My Getnote
      </span>
      <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 'auto' }}>
        {graphIndex ? `${graphIndex.stats.total_notes} 篇 · ${graphIndex.stats.total_connections} 条关联` : ''}
      </span>
      <button
        onClick={handleReset}
        title="重置"
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4,
          fontSize: 13, fontFamily: 'var(--font-ui)', padding: '4px 8px',
          borderRadius: 'var(--radius-md)',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-muted)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
      >
        <RotateCcw size={13} />
        重置
      </button>
    </div>
  );
}
```

- [ ] **Step 3: 验证编译**

```bash
cd web && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: 提交**

```bash
git add web/components/toolbar/Toolbar.tsx
git commit -m "refactor(toolbar): 精简到只剩 Logo+统计+重置"
```

---

## Task 2: LeftNav 收起态图标化

收起态只显示 3 个图标按钮，展开态内容不变。

**Files:**
- Modify: `web/components/panels/LeftNav.tsx`

- [ ] **Step 1: 读取 LeftNav 当前完整内容**

- [ ] **Step 2: 重写 aside 部分，区分收起态和展开态**

收起态（`!leftNavOpen`）只渲染图标按钮行 + 展开按钮。展开态渲染现有全部内容。

关键改动：
- 在 `motion.aside` 外套一层 div，用于放置收起态的图标按钮
- 收起态时 aside `width: 60px`，内部只有图标按钮（`justifyContent: center`，`flexDirection: column`）
- 展开按钮始终在 aside 右上角

```tsx
// 收起态图标按钮（放在 motion.aside 内部）
{!leftNavOpen ? (
  <div style={{
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: 16, paddingTop: 50, paddingBottom: 16,
  }}>
    {/* 搜索 */}
    <button
      onClick={() => { setSearchModalOpen(true); }}
      title="搜索"
      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 6, borderRadius: 6, display: 'flex' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
    >
      <Search size={18} />
    </button>
    {/* 知识领域 */}
    <button
      onClick={() => setLeftNavOpen(true)}
      title="知识领域"
      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 6, borderRadius: 6, display: 'flex' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
    >
      <Layers size={18} />
    </button>
    {/* 探索路径 */}
    <button
      onClick={() => setLeftNavOpen(true)}
      title="探索路径"
      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 6, borderRadius: 6, display: 'flex' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
    >
      <Bookmark size={18} />
    </button>
  </div>
) : (
  // 现有展开态全部内容
  <>{/* ... 现有内容 ... */}</>
)}
```

注意：`Search` 和 `Layers` 图标需要从 `lucide-react` import。

- [ ] **Step 3: 在 LeftNav 顶部加入搜索按钮（展开态）**

展开态顶部（aside 内部，NavItem 列表之前）加一行：

```tsx
<div style={{
  display: 'flex', alignItems: 'center', gap: 8,
  padding: '12px 16px', borderBottom: '1px solid var(--border)',
  cursor: 'pointer',
}}
  onClick={() => setSearchModalOpen(true)}
>
  <Search size={14} style={{ color: 'var(--text-muted)' }} />
  <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>
    点击搜索笔记…
  </span>
</div>
```

- [ ] **Step 4: import 新增图标**

```tsx
import { Bookmark, Trash2, ChevronUp, ChevronLeft, ChevronRight, Search, Layers } from 'lucide-react';
```

- [ ] **Step 5: 引入 searchModalOpen 状态**

```tsx
const { leftNavOpen, setLeftNavOpen, setSearchModalOpen } = useGraphStore();
```

（`setSearchModalOpen` 暂用 `setRightPanelOpen` 代替，等 Task 3 加完再统一改 store）

- [ ] **Step 6: 验证编译**

```bash
cd web && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 7: 提交**

```bash
git add web/components/panels/LeftNav.tsx
git commit -m "refactor(leftnav): 收起态图标化，顶部加搜索按钮"
```

---

## Task 3: graphStore 新增 searchModalOpen

**Files:**
- Modify: `web/stores/graphStore.ts`

- [ ] **Step 1: 在 interface GraphState 里加字段**

```ts
searchModalOpen: boolean;
setSearchModalOpen: (open: boolean) => void;
```

- [ ] **Step 2: 在初始状态里加默认值**

```ts
searchModalOpen: false,
```

- [ ] **Step 3: 加 action**

```ts
setSearchModalOpen: (open) => set({ searchModalOpen: open }),
```

- [ ] **Step 4: 验证编译**

```bash
cd web && npx tsc --noEmit 2>&1 | head -10
```

- [ ] **Step 5: 提交**

```bash
git add web/stores/graphStore.ts
git commit -m "feat(store: 新增 searchModalOpen 状态"
```

---

## Task 4: SearchModal 新建

搜索浮窗组件，点击触发，输入即搜，点击结果打开 RightPanel。

**Files:**
- Create: `web/components/search/SearchModal.tsx`

- [ ] **Step 1: 创建 SearchModal.tsx**

```tsx
// web/components/search/SearchModal.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGraphStore } from '@/stores/graphStore';
import { Search, X, Filter } from 'lucide-react';

export default function SearchModal() {
  const { graphIndex, searchModalOpen, setSearchModalOpen, selectNode, setRightPanelOpen } = useGraphStore();
  const [query, setQuery] = useState('');
  const [domainFilter, setDomainFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [results, setResults] = useState<Array<{
    id: string; title: string; domain: string; type: string;
    bodyPreview: string; createdAt?: string; tags?: string[];
  }>>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 打开时 focus 输入框
  useEffect(() => {
    if (searchModalOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setResults([]);
      setDomainFilter('');
      setTypeFilter('');
    }
  }, [searchModalOpen]);

  // 搜索逻辑
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults([]); return; }

    debounceRef.current = setTimeout(() => {
      if (!graphIndex) return;
      const q = query.toLowerCase();
      const matched: typeof results = [];

      for (const [id, entry] of Object.entries(graphIndex.index)) {
        if (domainFilter && entry.domain !== domainFilter) continue;
        if (typeFilter && entry.type !== typeFilter) continue;
        if (
          entry.title.toLowerCase().includes(q) ||
          entry.bodyPreview?.toLowerCase().includes(q) ||
          entry.tags?.some((t: string) => t.toLowerCase().includes(q))
        ) {
          matched.push({
            id,
            title: entry.title,
            domain: entry.domain,
            type: entry.type,
            bodyPreview: entry.bodyPreview ?? '',
            createdAt: entry.createdAt,
            tags: entry.tags,
          });
        }
        if (matched.length >= 10) break;
      }
      setResults(matched);
    }, 300);
  }, [query, domainFilter, typeFilter, graphIndex]);

  const handleSelect = (noteId: string) => {
    selectNode(noteId);
    setRightPanelOpen(true);
    setSearchModalOpen(false);
  };

  const handleClose = () => setSearchModalOpen(false);

  const domains = graphIndex?.domains ?? [];
  const types = Object.keys(graphIndex?.stats.by_type ?? {});

  return (
    <AnimatePresence>
      {searchModalOpen && (
        <>
          {/* 遮罩层 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(0,0,0,0.25)',
              zIndex: 500,
            }}
          />
          {/* 浮窗 */}
          <motion.div
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -20, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            style={{
              position: 'fixed',
              top: 80,
              left: 14,
              width: 420,
              maxHeight: 'calc(100vh - 120px)',
              background: 'rgba(255,255,255,0.96)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
              zIndex: 510,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* 搜索行 */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '12px 14px',
              borderBottom: '1px solid var(--border)',
              flexShrink: 0,
            }}>
              <Search size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="搜索标题、内容、标签…"
                style={{
                  flex: 1, border: 'none', outline: 'none',
                  fontSize: 14, fontFamily: 'var(--font-ui)',
                  color: 'var(--text-primary)',
                  background: 'transparent',
                }}
                onKeyDown={e => { if (e.key === 'Escape') handleClose(); }}
              />
              {domainFilter || typeFilter ? (
                <button
                  onClick={() => { setDomainFilter(''); setTypeFilter(''); }}
                  title="清除筛选"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: 11, padding: '2px 4px', borderRadius: 4 }}
                >
                  清除筛选
                </button>
              ) : null}
              <button
                onClick={handleClose}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex', borderRadius: 4 }}
              >
                <X size={15} />
              </button>
            </div>

            {/* 筛选按钮行 */}
            {domains.length > 0 && (
              <div style={{
                display: 'flex', gap: 6, padding: '8px 14px',
                borderBottom: '1px solid var(--border)', flexShrink: 0, flexWrap: 'wrap',
              }}>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', alignSelf: 'center', fontWeight: 600 }}>
                  领域
                </span>
                <FilterBtn label="全部" active={!domainFilter} onClick={() => setDomainFilter('')} />
                {domains.map(d => (
                  <FilterBtn key={d} label={d} active={domainFilter === d} onClick={() => setDomainFilter(d)} />
                ))}
                <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', alignSelf: 'center', fontWeight: 600, marginLeft: 8 }}>
                  类型
                </span>
                <FilterBtn label="全部" active={!typeFilter} onClick={() => setTypeFilter('')} />
                {types.slice(0, 5).map(t => (
                  <FilterBtn key={t} label={t} active={typeFilter === t} onClick={() => setTypeFilter(t)} />
                ))}
              </div>
            )}

            {/* 结果列表 */}
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {query && results.length === 0 && (
                <div style={{ padding: '24px 14px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                  没有找到匹配的笔记
                </div>
              )}
              {results.map(note => (
                <div
                  key={note.id}
                  onClick={() => handleSelect(note.id)}
                  style={{
                    padding: '12px 14px', borderBottom: '1px solid var(--border)',
                    cursor: 'pointer', transition: 'background 0.12s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-muted)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4, lineHeight: 1.3, letterSpacing: '-0.01em' }}>
                    {note.title.length > 45 ? note.title.slice(0, 44) + '…' : note.title}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                    {[note.domain, note.type].filter(Boolean).join(' · ')}
                    {note.createdAt ? ` · ${note.createdAt}` : ''}
                  </div>
                  {note.bodyPreview && (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {note.bodyPreview}
                    </div>
                  )}
                </div>
              ))}
              {!query && (
                <div style={{ padding: '24px 14px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                  输入关键词开始搜索
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function FilterBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '2px 8px', borderRadius: 20,
        fontSize: 11, fontFamily: 'var(--font-ui)',
        border: '1px solid',
        cursor: 'pointer',
        transition: 'all 0.12s',
        borderColor: active ? 'var(--accent)' : 'var(--border)',
        background: active ? 'var(--accent-light)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--text-secondary)',
      }}
    >
      {label}
    </button>
  );
}
```

- [ ] **Step 2: 把 SearchModal 加入 page.tsx**

在 `app/graph/page.tsx` 的 `<main>` 里加一行：

```tsx
import SearchModal from '@/components/search/SearchModal';
// ...
<SearchModal />
```

- [ ] **Step 3: 验证编译**

```bash
cd web && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: 提交**

```bash
git add web/components/search/SearchModal.tsx web/app/graph/page.tsx
git commit -m "feat(search): 新建 SearchModal 搜索浮窗组件"
```

---

## Task 5: RightPanel 动画独立化（width 0↔380）

确认 RightPanel 收起态 `width: 0`，不依赖 `position: fixed`。

**Files:**
- Modify: `web/components/panels/RightPanel.tsx`

- [ ] **Step 1: 读取 RightPanel 当前渲染部分**

重点看 `motion.aside` 和 `panelStyle`。

- [ ] **Step 2: 把外层 wrapper 的 `position: fixed` 改成 `position: relative`**

RightPanel 应该直接在 page.tsx 的 flex 布局里，而不是外面套 `position: fixed`。

先改 `app/graph/page.tsx`，把 RightPanel 从 wrapper 里拿出来：

```tsx
{/* 删除外层 fixed wrapper */}
{/* RightPanel 直接渲染 */}
<RightPanel panelLeft={leftNavWidth + (leftNavOpen ? 0 : 220)} />
```

实际上 RightPanel 本身应该在 flex 行里。修改 page.tsx：

```tsx
{/* Flex row: LeftNav + Graph + RightPanel */}
<div style={{
  display: 'flex',
  height: 'calc(100vh - 78px)',
  marginTop: 78,
  overflow: 'hidden',
}}>
  <LeftNav />

  {/* 图谱画布 */}
  <div style={{
    flex: 1,
    backgroundImage: 'radial-gradient(circle, #D1D5DB 1px, transparent 1px)',
    backgroundSize: '24px 24px',
    backgroundPosition: '14px 14px',
    overflow: 'hidden',
    borderRadius: 'var(--radius-lg)',
    margin: '0 7px',
    position: 'relative',
  }}>
    <ForceGraph />
  </div>

  {/* RightPanel：放在 flex 布局末尾 */}
  <RightPanel panelLeft={leftNavWidth + (leftNavOpen ? 0 : 0)} />
</div>
```

RightPanel 内部：收起态 `width: 0`，展开态 `width: 380px`，通过 `motion.aside animate={{ width }}` 实现动画。

- [ ] **Step 3: RightPanel.tsx 改用 width 动画替代 x 动画**

把 `initial={{ x: 380 }} animate={{ x: 0 }}` 改为 `animate={{ width: rightPanelOpen ? 380 : 0 }}`。

注意：`motion.aside` 如果 `width: 0` 时内容仍然存在，需要在 `width: 0` 时加 `overflow: 'hidden'`。

```tsx
<motion.aside
  key={`right-panel-${isFullscreen ? 'full' : 'normal'}`}
  animate={{ width: rightPanelOpen ? (isFullscreen ? '100%' : 380) : 0 }}
  transition={{ duration: 0.25, ease: 'easeOut' }}
  style={{
    ...panelStyle,
    width: undefined, // 由 animate 控制
    overflow: rightPanelOpen ? undefined : 'hidden',
    flexShrink: 0,
  }}
>
```

同时把 RightPanel 里的 `if (!selectedNodeId || !graphIndex || !rightPanelOpen) return null;` 改为 `if (!selectedNodeId || !graphIndex) return null;`（移除 `!rightPanelOpen` 判断，让动画能播放）。

- [ ] **Step 4: 验证编译**

```bash
cd web && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 5: 提交**

```bash
git add web/components/panels/RightPanel.tsx web/app/graph/page.tsx
git commit -m "refactor(rightpanel): 独立 width 0↔380 动画"
```

---

## Task 6: 三栏布局联调 + 收尾

**Files:**
- Modify: `app/graph/page.tsx` — 最终确认 flex 三栏结构

- [ ] **Step 1: 读取当前 page.tsx，确认完整布局**

- [ ] **Step 2: 写最终版 page.tsx**

```tsx
// web/app/graph/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useGraphStore } from '@/stores/graphStore';
import { loadGraphIndex } from '@/lib/api';
import Toolbar from '@/components/toolbar/Toolbar';
import LeftNav from '@/components/panels/LeftNav';
import RightPanel from '@/components/panels/RightPanel';
import SearchModal from '@/components/search/SearchModal';
import ForceGraph from '@/components/graph/ForceGraph';

export default function GraphPage() {
  const loaded = useGraphStore((s) => s.loaded);
  const graphIndex = useGraphStore((s) => s.graphIndex);
  const setGraphIndex = useGraphStore((s) => s.setGraphIndex);
  const loadTrails = useGraphStore((s) => s.loadTrails);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loaded) {
      loadGraphIndex()
        .then(index => {
          setGraphIndex(index);
          loadTrails();
        })
        .catch(err => {
          console.error('Failed to load graph:', err);
          setError('加载图谱失败，请刷新页面重试');
        });
    }
  }, [loaded, setGraphIndex, loadTrails]);

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#EF4444', fontSize: 14, background: 'var(--bg-base)' }}>
        {error}
      </div>
    );
  }

  if (!loaded || !graphIndex) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-muted)', fontSize: 14, background: 'var(--bg-base)' }}>
        加载中…
      </div>
    );
  }

  return (
    <main style={{ background: 'var(--bg-base)', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      <Toolbar />
      <div style={{ display: 'flex', height: 'calc(100vh - 78px)', marginTop: 78, overflow: 'hidden' }}>
        <LeftNav />
        <div style={{
          flex: 1,
          backgroundImage: 'radial-gradient(circle, #D1D5DB 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          backgroundPosition: '14px 14px',
          overflow: 'hidden',
          borderRadius: 'var(--radius-lg)',
          margin: '0 7px',
          position: 'relative',
        }}>
          <ForceGraph />
        </div>
        <RightPanel panelLeft={0} />
      </div>
      <SearchModal />
    </main>
  );
}
```

- [ ] **Step 3: 验证编译**

```bash
cd web && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: 运行 E2E 测试**

```bash
npx playwright test --reporter=list 2>&1
```

- [ ] **Step 5: 提交**

```bash
git add web/app/graph/page.tsx
git commit -m "refactor(page): 三栏 flex 布局，SearchModal 集成"
```

---

## 自审清单

- [ ] Task 1：Toolbar 只剩 Logo+统计+重置，编译通过
- [ ] Task 2：LeftNav 收起态显示图标按钮，展开态顶部有搜索按钮
- [ ] Task 3：graphStore 有 `searchModalOpen` + `setSearchModalOpen`
- [ ] Task 4：SearchModal 输入即搜，300ms debounce，点击结果打开 RightPanel，ESC/遮罩关闭
- [ ] Task 5：RightPanel width 0↔380 动画，不依赖 position: fixed
- [ ] Task 6：三栏 flex，图谱始终 flex: 1，E2E 全部通过
