# Memex 2.0 Phase 6 实现计划

> **Worktree**: `/Users/zhengyan/Projects/ai-project/my-getnote-kg/.worktrees/phase2`
> **基于**: `phase2/nextjs-scaffold` 分支（Phase 2–5 已完成）

**Goal:** 轨迹记录与回放、Framer Motion 面板动画、细节打磨。

---

## Task 1: 轨迹记录系统

### graphStore 增强

在 `graphStore.ts` 中新增：

```typescript
// 新增 state
savedTrails: Trail[];  // localStorage 持久化

// 新增 actions
saveTrail: (name: string) => void;
loadTrails: () => void;
deleteTrail: (id: string) => void;
```

```typescript
// 新增 actions 实现
saveTrail: (name) => set(state => {
  const trail: Trail = {
    id: `trail_${Date.now()}`,
    name,
    createdAt: new Date().toISOString(),
    steps: state.currentTrail.map(noteId => ({ noteId })),
  };
  const trails = [trail, ...state.savedTrails].slice(0, 20);
  if (typeof window !== 'undefined') {
    localStorage.setItem('memex_trails', JSON.stringify(trails));
  }
  return { savedTrails: trails, trailRecording: false, currentTrail: [] };
}),

loadTrails: () => {
  if (typeof window === 'undefined') return;
  try {
    const stored = localStorage.getItem('memex_trails');
    if (stored) {
      const trails = JSON.parse(stored);
      set({ savedTrails: trails });
    }
  } catch {}
},

deleteTrail: (id) => set(state => {
  const trails = state.savedTrails.filter(t => t.id !== id);
  if (typeof window !== 'undefined') {
    localStorage.setItem('memex_trails', JSON.stringify(trails));
  }
  return { savedTrails: trails };
}),
```

### 轨迹记录交互逻辑

**Toolbar 轨迹按钮**：
- 未记录时：点击开始记录 → 按钮变为红色 "记录中" 状态
- 记录中：点击结束 → 弹出 `prompt` 要求输入轨迹名称 → 保存到 localStorage
- 轨迹名称输入为空 → 不保存

**图谱节点点击时记录步骤**：
- `trailRecording = true` 时，每次 `selectNode(id)` 自动 `addToTrail(id)`

### 保存轨迹流程

```typescript
// Toolbar 中的轨迹按钮
const handleTrailClick = () => {
  if (trailRecording) {
    const name = prompt('轨迹名称：', `探索 ${new Date().toLocaleDateString('zh-CN')}`);
    if (name) saveTrail(name);
    else setTrailRecording(false);
  } else {
    startTrail();
  }
};
```

- [ ] **Step 1: 修改 web/stores/graphStore.ts**
- [ ] **Step 2: 修改 web/components/toolbar/Toolbar.tsx（轨迹按钮逻辑）**
- [ ] **Step 3: 修改 web/components/graph/ForceGraph.tsx（记录节点点击）**
- [ ] **Step 4: 提交**

---

## Task 2: 轨迹回放高亮

**行为**：LeftNav 中点击某条轨迹 → 图谱中高亮这条路径上的所有节点和连线

在 `graphStore` 中新增：

```typescript
highlightedTrailId: string | null;
highlightedTrailNodeIds: string[];

playTrail: (id: string) => {
  const trail = state.savedTrails.find(t => t.id === id);
  if (!trail) return;
  const nodeIds = trail.steps.map(s => s.noteId);
  set({ highlightedTrailId: id, highlightedTrailNodeIds: nodeIds });
};
```

ForceGraph 中高亮：
- `highlightedTrailNodeIds` 包含的节点：透明度 1.0，节点加粗边框
- 路径连线：颜色变为 `--primary`，宽度 2px

- [ ] **Step 1: graphStore 新增 `highlightedTrailId` / `playTrail`**
- [ ] **Step 2: ForceGraph 读取 `highlightedTrailNodeIds` 高亮路径**
- [ ] **Step 3: LeftNav 轨迹点击调用 `playTrail`**
- [ ] **Step 4: 提交**

---

## Task 3: Framer Motion 面板动画

安装 framer-motion：
```bash
cd web && npm install framer-motion
```

**RightPanel 滑入动画**：

```tsx
import { motion, AnimatePresence } from 'framer-motion';

// 替换 <aside> 为
<AnimatePresence>
{visible && (
  <motion.aside
    initial={{ x: 380, opacity: 0 }}
    animate={{ x: 0, opacity: 1 }}
    exit={{ x: 380, opacity: 0 }}
    transition={{ duration: 0.25, ease: 'easeOut' }}
    // ... 其他 style props
  >
    ...
  </motion.aside>
)}
</AnimatePresence>
```

- [ ] **Step 1: 修改 RightPanel.tsx 添加 Framer Motion 动画**
- [ ] **Step 2: 提交**

---

## Task 4: 节点呼吸灯动画

在 `ForceGraph.tsx` 的 `nodeCanvasObject` 中，聚焦节点（`level === 'focused'`）添加脉冲边框效果：

```typescript
// 脉冲动画：基于时间戳计算 alpha
const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 500);
ctx.strokeStyle = `rgba(0,245,255,${pulse * 0.6})`;
ctx.lineWidth = 1.5;
ctx.stroke();
```

- [ ] **Step 1: ForceGraph.tsx 添加脉冲呼吸灯效果**
- [ ] **Step 2: 添加 CSS `@keyframes spin` 到 globals.css（Loader2 旋转）**
- [ ] **Step 3: 提交**

---

## Task 5: 构建验证

- [ ] 构建
- [ ] dev server 验证
- [ ] 推送 GitHub
