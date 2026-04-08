# 自动轨迹追踪实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** ✅ 已完成（2026-04-06）

**Goal:** 实现自动轨迹追踪（点即加、再点即移除）和链路感知推荐，移除录制模式。

**Architecture:** 所有改动集中在 graphStore + ForceGraph + LeftNav + RightPanel + Toolbar。browsePath 是会话级内存，savedTrails 保留用于历史轨迹持久化。

**Tech Stack:** TypeScript, Vitest, Zustand

---

## 文件结构

- 修改: `web/stores/graphStore.ts` — 新增 browsePath，移除录制相关
- 修改: `web/components/graph/ForceGraph.tsx` — handleNodeClick 改为 toggle browsePath
- 修改: `web/components/panels/LeftNav.tsx` — 轨迹区改为 browsePath 展示
- 修改: `web/components/panels/RightPanel.tsx` — 改为链路感知推荐
- 修改: `web/components/toolbar/Toolbar.tsx` — 移除录制按钮
- 修改: `web/stores/graphStore.test.ts` — 新增 browsePath 测试

---

## Task 1: graphStore — 新增 browsePath，移除录制相关

**Files:**
- Modify: `web/stores/graphStore.ts`
- Modify: `web/stores/graphStore.test.ts`

- [ ] **Step 1: 添加测试**

打开 `web/stores/graphStore.test.ts`，在 describe block 中新增：

```typescript
describe('browsePath — auto-trace behavior', () => {
  beforeEach(() => {
    // 清理 browsePath 状态
    useGraphStore.setState({ browsePath: [], selectedNodeId: null });
  });

  it('clicking a node adds it to browsePath', () => {
    const store = useGraphStore.getState();
    store.selectNode('node-a');
    expect(useGraphStore.getState().browsePath).toEqual(['node-a']);
    expect(useGraphStore.getState().selectedNodeId).toBe('node-a');
  });

  it('clicking a second node appends to browsePath', () => {
    const store = useGraphStore.getState();
    store.selectNode('node-a');
    store.selectNode('node-b');
    expect(useGraphStore.getState().browsePath).toEqual(['node-a', 'node-b']);
  });

  it('clicking the same node again removes it from browsePath', () => {
    const store = useGraphStore.getState();
    store.selectNode('node-a');
    store.selectNode('node-b');
    store.selectNode('node-a'); // 再点 node-a → 移除 node-a 及其后续
    expect(useGraphStore.getState().browsePath).toEqual([]);
  });

  it('clicking middle node truncates path after it', () => {
    const store = useGraphStore.getState();
    store.selectNode('node-a');
    store.selectNode('node-b');
    store.selectNode('node-c');
    store.selectNode('node-b'); // 再点 node-b → 截断，保留 node-a, node-b
    expect(useGraphStore.getState().browsePath).toEqual(['node-a', 'node-b']);
  });

  it('last node is always the selected node', () => {
    const store = useGraphStore.getState();
    store.selectNode('node-a');
    store.selectNode('node-b');
    expect(useGraphStore.getState().selectedNodeId).toBe('node-b');
  });

  it('clearBrowsePath resets browsePath to empty', () => {
    const store = useGraphStore.getState();
    store.selectNode('node-a');
    store.selectNode('node-b');
    useGraphStore.getState().clearBrowsePath();
    expect(useGraphStore.getState().browsePath).toEqual([]);
  });

  it('browsePath is isolated from savedTrails', () => {
    const store = useGraphStore.getState();
    store.selectNode('node-a');
    store.selectNode('node-b');
    // savedTrails should be independent
    expect(useGraphStore.getState().savedTrails).toEqual([]);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npx vitest run web/stores/graphStore.test.ts -t "browsePath"`

Expected: FAIL — `browsePath` not defined, `clearBrowsePath` not defined

- [ ] **Step 3: 修改 graphStore — 新增 browsePath 相关**

打开 `web/stores/graphStore.ts`：

**A. 添加接口和状态（找到 `interface GraphState`）:**

```typescript
interface GraphState {
  // ... 现有字段 ...
  browsePath: string[];           // 新增：自动追踪的路径
  browsePathShow: boolean;        // 新增：轨迹区展开/折叠
  clearBrowsePath: () => void;    // 新增：清空轨迹
  removeFromBrowsePath: (id: string) => void; // 新增：移除指定节点及其后续
  // 移除:
  // trailRecording: boolean;        // 删除
  // addToTrail: (id: string) => void; // 删除
  // startTrail: () => void;          // 删除
  // finishTrail: () => void;         // 删除
}
```

**B. 找到 `selectNode` 方法，替换为：**

```typescript
selectNode: (id) => {
  const state = get();
  if (state.browsePath.includes(id)) {
    // 再点：移除该节点及其后续
    const idx = state.browsePath.indexOf(id);
    set({ selectedNodeId: id, browsePath: state.browsePath.slice(0, idx) });
  } else {
    // 新点：追加到末尾
    set({ selectedNodeId: id, browsePath: [...state.browsePath, id] });
  }
},
```

**C. 添加新方法（在 finishTrail 附近）：**

```typescript
clearBrowsePath: () => set({ browsePath: [] }),
removeFromBrowsePath: (id) => set(state => {
  const idx = state.browsePath.indexOf(id);
  if (idx === -1) return {};
  return { browsePath: state.browsePath.slice(0, idx) };
}),
```

**D. 添加到初始状态（在 `multiHopIds` 附近）：**

```typescript
browsePath: [],
browsePathShow: false,
```

**E. 找到并删除以下内容：**

```typescript
// 删除这些字段和初始值：
trailRecording: false,
currentTrail: [],
// 删除这些方法：
startTrail: () => set({ trailRecording: true, currentTrail: [] }),
addToTrail: (id) => set(state => {
  const newTrail = [...state.currentTrail];
  if (newTrail[newTrail.length - 1] !== id) newTrail.push(id);
  return { currentTrail: newTrail };
}),
finishTrail: () => set({ trailRecording: false, currentTrail: [] }),
```

**F. 保留：savedTrails、playTrail、stopTrailPlayback、deleteTrail、saveTrail、loadTrails（历史轨迹管理）**

**G. `saveTrail` 仍写入 localStorage，但 `currentTrail` 相关逻辑简化：**

`saveTrail` 中的 `steps` 改为从 `browsePath` 构建：

```typescript
saveTrail: (name) => {
  const state = get();
  if (!name.trim()) return;
  const trail: Trail = {
    id: `trail_${Date.now()}`,
    name: name.trim(),
    createdAt: new Date().toISOString(),
    steps: state.browsePath.map(noteId => ({ noteId, timestamp: new Date().toISOString() })),
  };
  const trails = [trail, ...state.savedTrails].slice(0, 20);
  saveToStorage(trails);
  set({ savedTrails: trails });
},
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npx vitest run web/stores/graphStore.test.ts -t "browsePath"`

Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add web/stores/graphStore.ts web/stores/graphStore.test.ts
git commit -m "feat(trail): add browsePath auto-trace, remove recording mode"
git push origin main
```

---

## Task 2: ForceGraph — handleNodeClick 改为 toggle browsePath

**Files:**
- Modify: `web/components/graph/ForceGraph.tsx`

- [ ] **Step 1: 更新 destructuring**

找到 `useGraphStore` 的 destructuring，添加 browsePath 相关：

```typescript
const {
  // ... 保留 ...
  selectedNodeId, selectNode,
  // ... 移除: trailRecording, currentTrail ...
  // 新增:
  browsePath,
} = useGraphStore();
```

同时移除：
```typescript
// 删除这些:
trailRecording: boolean,
currentTrail: string[],
startTrail: () => void,
addToTrail: (id: string) => void,
finishTrail: () => void,
// 保留:
highlightedTrailNodeIds,
```

- [ ] **Step 2: 更新 handleNodeClick**

找到 `handleNodeClick`（约第281行），替换为：

```typescript
const handleNodeClick = useCallback((node: GraphNode) => {
  // Prevent selecting ghost (peripheral dimmed) nodes
  const level = levelMap.get(node.id) ?? 'peripheral';
  if (level === 'ghost') return;
  fgRef.current?.resumeAnimation();
  // Toggle node in/out of browsePath (auto-trace)
  if (browsePath.includes(node.id)) {
    // 再点：从 browsePath 移除该节点及其后续（store 处理）
    selectNode(node.id);
  } else {
    // 新点：追加到 browsePath（store 处理）
    selectNode(node.id);
  }
}, [browsePath, selectNode, levelMap]);
```

注意：`selectNode` 已在 Task 1 中修改为自动更新 browsePath，所以这里只需要调用 `selectNode` 即可。

- [ ] **Step 3: 更新 trailLinkSet — 基于 browsePath 而非 highlightedTrailNodeIds**

找到 `trailLinkSet` useMemo（约第211行），替换为：

```typescript
const trailLinkSet = useMemo(() => new Set(
  browsePath.slice(0, -1).map((id, i) => `${id}→${browsePath[i + 1]}`)
), [browsePath]);
```

同时可以删除 `highlightedTrailNodeIds` 相关的 useMemo。

- [ ] **Step 4: 运行 TypeScript 检查**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: 无错误

- [ ] **Step 5: 提交**

```bash
git add web/components/graph/ForceGraph.tsx
git commit -m "feat(ForceGraph): toggle browsePath on node click, remove recording"
git push origin main
```

---

## Task 3: LeftNav — 轨迹区改为 browsePath 展示

**Files:**
- Modify: `web/components/panels/LeftNav.tsx`

- [ ] **Step 1: 更新 destructuring**

```typescript
const {
  graphIndex,
  domainFilter, setDomainFilter,
  typeFilter, setTypeFilter,
  browsePath, clearBrowsePath, removeFromBrowsePath,
  highlightedTrailId,
  savedTrails,
  playTrail, stopTrailPlayback, deleteTrail,
  browsePathShow, setBrowsePathShow,
} = useGraphStore();
```

删除：
```typescript
// 删除:
trailRecording: boolean,
currentTrail: string[],
startTrail: () => void,
addToTrail: (id: string) => void,
finishTrail: () => void,
```

**注意：** `playTrail`、`stopTrailPlayback`、`deleteTrail`、`savedTrails` 保留用于历史轨迹管理。

- [ ] **Step 2: 替换轨迹区渲染逻辑**

找到轨迹区（`{/* Trail history */}` 开始的 div，约第126-233行），替换为 browsePath 展示：

```tsx
{/* Trail section — now shows browsePath */}
<div style={{ borderTop: '1px solid var(--border)', padding: '8px 0', flexShrink: 0 }}>
  <button
    onClick={() => setBrowsePathShow(!browsePathShow)}
    style={{
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '8px 16px',
      background: 'none',
      border: 'none',
      color: browsePathShow ? 'var(--accent)' : 'var(--text-secondary)',
      fontSize: 13,
      fontFamily: 'var(--font-ui)',
      cursor: 'pointer',
      textAlign: 'left',
      transition: 'color 0.12s',
    }}
  >
    <Bookmark size={13} />
    探索路径 ({browsePath.length})
    {browsePath.length > 0 && (
      <button
        onClick={e => { e.stopPropagation(); clearBrowsePath(); }}
        title="清空轨迹"
        style={{
          marginLeft: 'auto',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-muted)',
          padding: 2,
          display: 'flex',
          borderRadius: 3,
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
      >
        <X size={12} />
      </button>
    )}
  </button>

  {browsePathShow && (
    <div>
      {browsePath.length === 0 && (
        <div style={{ padding: '8px 16px', fontSize: 12, color: 'var(--text-muted)' }}>
          点击图谱节点开始追踪
        </div>
      )}
      {browsePath.map((nodeId, i) => {
        const entry = graphIndex?.index[nodeId];
        const isLast = i === browsePath.length - 1;
        return (
          <div key={nodeId} style={{
            display: 'flex',
            alignItems: 'center',
            padding: '6px 16px 6px 32px',
            fontSize: 12,
            color: isLast ? 'var(--accent)' : 'var(--text-secondary)',
            cursor: 'pointer',
            overflow: 'hidden',
            borderLeft: `2px solid ${isLast ? 'var(--accent)' : 'transparent'}`,
            background: isLast ? 'var(--accent-light)' : 'transparent',
            fontFamily: 'var(--font-ui)',
            transition: 'background 0.15s, color 0.15s',
          }}
          onClick={() => useGraphStore.getState().selectNode(nodeId)}
          onMouseEnter={e => { if (!isLast) { const el = e.currentTarget as HTMLElement; el.style.borderLeftColor = 'var(--accent)'; el.style.color = 'var(--accent)'; } }}
          onMouseLeave={e => { if (!isLast) { const el = e.currentTarget as HTMLElement; el.style.borderLeftColor = 'transparent'; el.style.color = 'var(--text-secondary)'; } }}
          >
            <span style={{ color: 'var(--text-muted)', marginRight: 6, flexShrink: 0 }}>{i + 1}.</span>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {entry?.title ?? nodeId}
            </span>
            <button
              title="移除此步及后续"
              onClick={e => { e.stopPropagation(); removeFromBrowsePath(nodeId); }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                padding: 2,
                display: 'flex',
                borderRadius: 3,
                flexShrink: 0,
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
            >
              <Trash2 size={12} />
            </button>
          </div>
        );
      })}
    </div>
  )}

  {/* 历史轨迹管理（保留 savedTrails 部分） */}
  <div style={{ padding: '4px 16px 0', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
    历史轨迹
  </div>
  <div style={{ padding: '4px 0' }}>
    {savedTrails.slice(0, 5).map(trail => (
      <div key={trail.id} style={{
        display: 'flex',
        alignItems: 'center',
        padding: '4px 16px',
        fontSize: 11,
        color: 'var(--text-secondary)',
        cursor: 'pointer',
        fontFamily: 'var(--font-ui)',
      }}
      onClick={() => { useGraphStore.getState().browsePath = [...trail.steps.map((s: { noteId: string }) => s.noteId)]; useGraphStore.setState({ browsePath: trail.steps.map((s: { noteId: string }) => s.noteId) }); }}
      >
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{trail.name}</span>
        <button onClick={e => { e.stopPropagation(); deleteTrail(trail.id); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}>
          <Trash2 size={10} />
        </button>
      </div>
    ))}
  </div>
</div>
```

- [ ] **Step 3: 导入 X 图标**

在 lucide-react 导入中添加 `X`：

```typescript
import { Bookmark, Square, Trash2, X } from 'lucide-react';
```

- [ ] **Step 4: 运行 TypeScript 检查**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: 无错误

- [ ] **Step 5: 提交**

```bash
git add web/components/panels/LeftNav.tsx
git commit -m "feat(LeftNav): show browsePath, single-step delete, clear all"
git push origin main
```

---

## Task 4: RightPanel — 链路感知推荐

**Files:**
- Modify: `web/components/panels/RightPanel.tsx`

- [ ] **Step 1: 添加推荐算法函数**

在 RightPanel.tsx 顶部（在组件定义之前）添加：

```typescript
/**
 * 链路感知推荐算法
 * - 输入: browsePath, selectedNodeId, graphIndex
 * - 加权: 指数衰减 (decay=0.5), 越近权重越高
 * - 排除: browsePath 中已有节点 + selectedNodeId
 * - 返回: 前 10 条推荐
 */
function getPathAwareRecommendations(
  browsePath: string[],
  selectedNodeId: string | null,
  graphIndex: import('@/stores/graphStore').GraphIndex | null,
): Array<{ noteId: string; score: number; title: string; domain: string }> {
  if (!graphIndex) return [];

  if (browsePath.length === 0 && selectedNodeId) {
    // 降级: 单节点推荐
    const conns = graphIndex.index[selectedNodeId]?.connections ?? [];
    return conns.slice(0, 10).map(c => {
      const entry = graphIndex.index[c.noteId];
      return { noteId: c.noteId, score: c.score, title: entry?.title ?? '', domain: entry?.domain ?? '' };
    });
  }

  // 指数衰减加权
  const DECAY = 0.5;
  const DECAY_WINDOW = 10; // 只看最近 10 跳

  const recent = browsePath.slice(-DECAY_WINDOW);
  const scores: Record<string, number> = {};

  recent.forEach((nodeId, i) => {
    const weight = Math.pow(DECAY, DECAY_WINDOW - 1 - i);
    const conns = graphIndex.index[nodeId]?.connections ?? [];
    conns.forEach(conn => {
      scores[conn.noteId] = (scores[conn.noteId] ?? 0) + conn.score * weight;
    });
  });

  // 排除已访问节点
  const exclude = new Set(browsePath);
  if (selectedNodeId) exclude.add(selectedNodeId);

  return Object.entries(scores)
    .filter(([noteId]) => !exclude.has(noteId))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([noteId, score]) => {
      const entry = graphIndex.index[noteId];
      return {
        noteId,
        score: score / recent.length, // 归一化
        title: entry?.title ?? '',
        domain: entry?.domain ?? '',
      };
    });
}
```

- [ ] **Step 2: 更新组件内推荐逻辑**

在组件中用 `browsePath` 替换现有的 `entry.connections`：

```typescript
// 在组件内, 找到推荐列表的渲染部分（约第228行开始）：
// 删除:
{entry.connections.length > 0 && (
  <>
    <div ...>相似笔记 ({entry.connections.length})</div>
    {entry.connections.slice(0, 10).map(conn => {
      const target = graphIndex.index[conn.noteId];
      // ...
    })}
  </>
)}

// 替换为链路感知推荐:
const recommendations = getPathAwareRecommendations(browsePath ?? [], selectedNodeId, graphIndex);

{recommendations.length > 0 && (
  <>
    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, fontWeight: 600 }}>
      {browsePath?.length ? '链路推荐' : '相似笔记'} ({recommendations.length})
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {recommendations.map(rec => (
        <div key={rec.noteId} onClick={() => selectNode(rec.noteId)} style={{
          padding: '7px 10px',
          background: 'rgba(0,0,0,0.03)',
          borderRadius: 6,
          fontSize: 12,
          color: 'var(--text-primary)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          borderLeft: `2px solid ${DOMAIN_COLORS[rec.domain] ?? '#9CA3AF'}`,
          fontFamily: 'var(--font-ui)',
          transition: 'background 0.12s',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--accent-light)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.03)'; }}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
            {rec.title}
          </span>
          <span style={{ color: 'var(--text-muted)', fontSize: 11, flexShrink: 0 }}>
            {Math.round(rec.score * 100)}%
          </span>
        </div>
      ))}
    </div>
  </>
)}
```

- [ ] **Step 3: 从 store 获取 browsePath**

在组件的 useGraphStore destructuring 中添加：

```typescript
const { selectedNodeId, graphIndex, selectNode, browsePath } = useGraphStore();
```

- [ ] **Step 4: 运行 TypeScript 检查**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: 无错误

- [ ] **Step 5: 提交**

```bash
git add web/components/panels/RightPanel.tsx
git commit -m "feat(RightPanel): path-aware recommendations with exponential decay"
git push origin main
```

---

## Task 5: Toolbar — 移除录制按钮

**Files:**
- Modify: `web/components/toolbar/Toolbar.tsx`

- [ ] **Step 1: 找到并删除录制相关代码**

找到 `startTrail`、`trailRecording` 相关引用，整段删除（通常在 Toolbar 的按钮区域）。

运行 grep 定位：
Run: `grep -n "startTrail\|trailRecording\|Recording" web/components/toolbar/Toolbar.tsx`

删除相关的按钮、状态、import。

- [ ] **Step 2: 运行 TypeScript 检查**

Run: `npx tsc --noEmit 2>&1 | head -10`
Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add web/components/toolbar/Toolbar.tsx
git commit -m "feat(Toolbar): remove recording button"
git push origin main
```

---

## 自检清单

1. **Spec coverage:** 所有设计点均有对应 Task ✓
2. **Placeholder scan:** 无 TBD/TODO ✓
3. **Type consistency:** browsePath 为 string[]，clearBrowsePath 和 removeFromBrowsePath 签名一致 ✓

---

## 执行方式

计划完成，保存至 `docs/superpowers/plans/2026-04-06-auto-trail-tracker.md`。

**两种执行方式：**

**1. Subagent-Driven（推荐）** — 按 Task 逐个 dispatch subagent，每完成一个审查后再继续

**2. Inline Execution** — 在本 session 中批量执行

选择哪种方式？
