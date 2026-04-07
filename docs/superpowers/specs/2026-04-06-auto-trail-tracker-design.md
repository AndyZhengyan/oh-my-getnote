# 自动轨迹追踪 + 链路感知推荐 设计文档

> **Issue:** #16 推荐增强 + 替代现有录制功能

**日期:** 2026-04-06
**状态:** 已批准

---

## 1. 核心行为（3 条规则）

| 动作 | 结果 |
|------|------|
| 点图谱任意节点 | 自动追加到轨迹末尾，与上一个节点连线 |
| 再点轨迹中已有节点 | 从轨迹移除，它的连线删除，后面节点自动重连到前一个 |
| LeftNav 底部轨迹区 | 展示完整路径，可点击跳转某步，可单删某步，可清空全部 |

### 推荐行为

| 条件 | 结果 |
|------|------|
| browsePath 有节点 | 链路感知推荐：指数衰减加权，排除已访问节点 |
| browsePath 为空 | 退化为当前选中节点的邻居推荐（现有行为） |

---

## 2. 数据模型

### 新增 / 修改的 store 字段

```typescript
// graphStore 新增
browsePath: string[]           // 自动追踪的路径（内存，无限长）
browsePathShow: boolean         // 轨迹区展开/折叠状态

// 复用已有字段
highlightedTrailNodeIds          // 复用，改为展示 browsePath 的连线
savedTrails                     // 保留，用于历史轨迹持久化
```

### 移除的字段和方法

```typescript
// 移除
trailRecording: boolean
startTrail: () => void
addToTrail: (id: string) => void
finishTrail: () => void
```

### browsePath 更新逻辑

```typescript
selectNode: (id) => {
  if (browsePath.includes(id)) {
    // 再点：移除该节点及其后面的所有节点
    const idx = browsePath.indexOf(id);
    set({ browsePath: browsePath.slice(0, idx) });
  } else {
    // 新点：追加到末尾
    set({ browsePath: [...browsePath, id] });
  }
  set({ selectedNodeId: id });
}
```

---

## 3. 链路感知推荐算法

### 输入

- `browsePath: string[]` — 用户的完整浏览路径
- `selectedNodeId: string` — 当前选中节点

### 算法

1. 收集 `browsePath` 中所有节点的邻居（来自 `graphIndex.index`）
2. 指数衰减加权：路径末尾节点权重最高，公式 `weight = decay^(positionFromEnd)`
   - `decay = 0.5`（可调整）
   - 末尾节点 weight = 0.5⁰ = 1.0
   - 倒数第二 weight = 0.5¹ = 0.5
   - 倒数第三 weight = 0.5² = 0.25
3. 合并相同邻居节点的分数（加权求和）
4. 排除 `browsePath` 中已有的节点
5. 排除 `selectedNodeId` 自身
6. 按分数降序，取前 10

### 降级

`browsePath.length === 0` 时，直接返回 `graphIndex.index[selectedNodeId]?.connections ?? []`

---

## 4. 界面变化

### 图谱画布（ForceGraph）

- 轨迹连线始终显示（紫色），不受 `domainFilter`/`typeFilter` 影响
- 连线路径：`browsePath.slice(0, -1).map((id, i) => `${id}→${browsePath[i+1]}`)`

### RightPanel 底部（推荐区）

- 移除现有的「相似笔记」静态推荐
- 替换为链路感知推荐列表
- 每项显示：节点标题、相似度分数（百分比）、领域标签
- 点击跳转到该节点

### LeftNav 底部轨迹区

位置：`borderTop` 分隔，固定在底部。

**标题栏：**
- 图标：Bookmark
- 文字：`探索路径 ({browsePath.length})`
- 右侧：清空按钮（X 图标，hover 显示）

**轨迹列表：**
- 每项：序号、节点标题、领域色标
- 点击：跳转到该节点
- 右侧 Trash2 按钮：单删该步及其后续所有步
- 无轨迹时：显示「点击图谱节点开始追踪」

### Toolbar

- 移除录制按钮（startTrail 相关）

---

## 5. 组件变更

| 文件 | 变更 |
|------|------|
| `web/stores/graphStore.ts` | 新增 browsePath，移除 trailRecording/startTrail/addToTrail/finishTrail |
| `web/components/graph/ForceGraph.tsx` | handleNodeClick 改为 toggle browsePath；trailLinkSet 改为基于 browsePath |
| `web/components/panels/RightPanel.tsx` | 推荐列表改为链路感知推荐算法 |
| `web/components/panels/LeftNav.tsx` | 轨迹区改为 browsePath 展示，支持单删、清空 |
| `web/components/toolbar/Toolbar.tsx` | 移除录制按钮 |

---

## 6. 移除的录制功能

以下代码全部删除：

```typescript
// graphStore
trailRecording: boolean
startTrail: () => void
addToTrail: (id: string) => void
finishTrail: () => void

// LeftNav
录制按钮、录制状态 Banner

// Toolbar
录制相关按钮
```

`savedTrails`、`playTrail`、`stopTrailPlayback`、`deleteTrail` 保留（用于历史轨迹管理）。

---

## 7. 边界情况

| 情况 | 处理 |
|------|------|
| browsePath 为空时点节点 | 直接追加，无连线 |
| browsePath 只有一个节点时点另一个 | 追加，连线 A→B |
| 再点 browsePath 中间节点 | 截断，保留该节点之前的所有节点 |
| 再点 browsePath 末尾节点 | 从轨迹移除，不连线到后续 |
| 过滤器激活时浏览 | browsePath 仍正常记录，图谱连线不受过滤器影响 |
| 无选中节点时 | 推荐区隐藏 |

---

## 8. 不在此版本的范围

- Issue #21（完整链路浏览历史查看器）— 单独设计
- 轨迹持久化（localStorage）— browsePath 是会话级内存，savedTrails 已支持持久化
