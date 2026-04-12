# 三栏布局重构 v2 — 参考 Manus 风格

## 概述

将图谱页面三栏布局升级为类 Manus 风格：左侧栏图标化 + Logo 内置，右侧面板弹性宽度（占视口 55%），三栏同时展开时自动压缩中间画布。

## 目标效果

```
┌──────┬────────────────────────────────┬────────────────────────────┐
│ Left │         中间画布 (flex: 1)       │    RightPanel (flex: 1.2)  │
│ 48px │                                 │                            │
│      │   ForceGraph 图谱 + 状态栏      │  笔记详情 / AI摘要 / 推荐    │
│      │                                 │                            │
└──────┴────────────────────────────────┴────────────────────────────┘

展开顺序（左栏内）:
[Logo] → [搜索] → [笔记类型] → [Tags] → [探索路径] → [历史轨迹]
```

## 整体布局

### 三栏结构

| 栏 | 收起宽度 | 展开宽度 | 定位方式 | flex |
|---|---|---|---|---|
| LeftNav | 48px | 280px | relative | `flexShrink: 0`（不压缩，始终保持 width 值） |
| 中间画布 | flex: 1 | flex: 1 (被压缩) | relative | 1 |
| RightPanel | 0 | flex: 1.2 | relative | 1.2 |

### RightPanel 定位改动

- **现状**：`position: absolute`，覆盖在画布上，不影响中间宽度
- **目标**：`position: relative`，`flex: 1.2`，真正参与 flex 布局，三栏同时存在时三栏按比例分配剩余空间

### 三栏联动行为

| LeftNav | RightPanel | 中间画布 |
|---|---|---|
| 收起 (48px) | 收起 (0) | flex: 1，最大化 |
| 展开 (280px) | 收起 (0) | flex: 1，压缩 |
| 收起 (48px) | 展开 (55vw) | flex: 1，压缩 |
| 展开 (280px) | 展开 (55vw) | flex: 1，最小压缩 |

---

## LeftNav

### 收起态（48px 宽）

- **Logo**：顶部居中，图标展示（可用现有 emoji 或替换为 SVG）
- **垂直排列图标**：搜索、笔记类型、Tags、展开箭头（引导用户展开）
- 整体居中，无文字标签

### 展开态（280px 宽）

**所有 section 紧密排列，无空白，每个 section 高度自适应内容，可独立收起。**

从上到下顺序：

1. **Logo 行**：Logo 图标 + "Oh My Getnote" 文字
2. **搜索触发**：点击弹出 SearchModal
3. **笔记类型**（可收起）：按数量倒序排列，其余行为不变
4. **Tags / 知识领域**（可收起）：按数量倒序排列，其余行为不变
5. **探索路径**（可收起）：browsePath 列表，展开/收起切换
6. **历史轨迹**（可收起）：savedTrails 列表，展开/收起切换

**收起行为**：
- 每个 section 右上角有 chevron-up 收起按钮
- 收起时：section header 保留，内容区域高度塌陷为 0
- 展开时：内容区域展开到实际高度

### 动画

- 宽度 48px ↔ 280px，0.25s ease-out
- 内部内容 fade in/out 切换

---

## 中间画布

- `flex: 1`，占满中央剩余空间
- 自动响应左右栏宽度变化（被压缩时画布缩小）
- ForceGraph 保持现有逻辑不变

---

## RightPanel

### 定位改动

- `position: relative`（从 absolute 改为 relative）
- 三栏 flex 布局：`flex: 1.5`，展开时占视口 ~55%

### 展开态

- `flex: 1.2`，相对中间画布（flex: 1）更宽，始终占更多空间
- `maxWidth: 800px`（绝对上限，避免过宽）
- 笔记详情 + AI 摘要 + 推荐链路

### 收起态

- `width: 0`（完全隐藏）
- `overflow: hidden`

### 动画

- 宽度 0 ↔ 55vw，0.25s ease-out
- 独立于 LeftNav，不联动

---

## 实现顺序

1. **LeftNav 收起态改 48px**：调整 COLLAPSED_WIDTH，常驻 Logo + 垂直图标
2. **LeftNav 展开态内容重排**：Logo 行 + 搜索 + 笔记类型 + Tags + 探索路径 + 历史轨迹，紧密排列
3. **笔记类型 / Tags / 探索路径 / 历史轨迹均可收起**：chevron-up 按钮控制高度塌陷
4. **LeftNav 整体收起/展开**：仍由右上角按钮控制
5. **RightPanel 改为 relative + flex**：移除 absolute 定位，`flex: 1.2`，`maxWidth: 800px`
6. **三栏布局联调**：确保同时展开/收起时行为正确
7. **动画微调**：确保无跳跃

---

## 改动文件清单

| 文件 | 改动 |
|---|---|
| `app/graph/page.tsx` | LeftNav 移除 Logo（移入 LeftNav），RightPanel 改为 relative + flex |
| `components/panels/LeftNav.tsx` | 收起 48px，Logo 内置，内容重排 |
| `components/panels/RightPanel.tsx` | position: relative，width: 55vw，flex: 1.5 |
