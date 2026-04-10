# oh-my-getnote 设计规范

> 版本：v1.0 · 2026-04-02
> 状态：已批准，待实施

## 1. 核心理念

**目标**：将个人知识库从"数据可视化"升级为"思维加速器"。

**Harness 原则**：
- 文件系统即数据源（Single Source of Truth）
- Markdown + frontmatter 作为笔记的持久化格式
- AI 摘要结果写回 frontmatter，而非瞬时状态
- 渐进式披露：索引 → 图谱骨架 → 按需加载正文

---

## 2. 数据架构

### 2.1 目录结构

```
oh-my-getnote/
├── source/                          # 原始数据（Get笔记导出的 HTML）
│   └── voicenotes-xxx/
│       ├── notes/                   # HTML 文件 + 图片 + 音频
│       └── metadata.json
│
├── notes/                           # 转换后的 Markdown 笔记（新建）
│   ├── 录音笔记/
│   │   └── {uuid}.md
│   ├── AI链接笔记/
│   ├── 图片笔记/
│   └── 录音卡笔记/
│
├── images/                          # 统一图片存储（新建）
│   └── {uuid}/
│       ├── img1.jpeg
│       └── img2.jpeg
│
├── graph-index.json                 # 图谱轻量索引（新建）
│
├── kg-site/                         # 现有静态图谱（保留，迁移时参考）
│
└── web/                             # Next.js 前端（新建）
    └── ...
```

### 2.2 Markdown 文件格式

每篇笔记对应一个 `.md` 文件：

```markdown
---
id: "uuid-xxx"
title: "笔记标题"
type: "录音笔记"                # tags[0]，笔记类型
tags: ["录音笔记", "AI智能体", "管理心理学"]  # tags[1:]，内容标签
domain: "AI 智能体与工程"        # 所属领域
date: "2026-03-28"              # 创建日期，YYYY-MM-DD
connections:                    # 关联关系（从 graph-index.json 同步引用）
  - noteId: "uuid-yyy"
    score: 0.92
    type: "semantic"            # "explicit" | "semantic"（用户显式 | AI推理）
  - noteId: "uuid-zzz"
    score: 0.78
    type: "explicit"
x: 0.234                         # 图谱2D坐标（PCA投影）
y: -0.187
ai_summary: |                   # AI 摘要（首次调用后写入）
  这篇笔记探讨了 AI 智能体在企业知识管理中的应用。
  核心观点：工具调用是 Agent 连接外部知识的关键能力。
  关联领域：知识图谱、企业数字化、LLM应用。
---

## 笔记正文

这里是笔记的原始内容或 AI 提取的摘要文字。
支持多段落、图片引用（`![](images/uuid/img1.jpeg)`）等标准 Markdown 格式。
```

**Frontmatter 字段说明**：

| 字段 | 必填 | 说明 |
|------|------|------|
| `id` | ✅ | 全局唯一 UUID |
| `title` | ✅ | 笔记标题 |
| `type` | ✅ | 笔记类型（来自 `tags[0]`） |
| `tags` | ✅ | 标签数组（包含 type + 内容标签） |
| `domain` | ✅ | 所属领域 |
| `date` | | 创建日期 |
| `connections` | | 关联列表（引用 graph-index.json 中的数据） |
| `x` / `y` | | 图谱坐标 |
| `ai_summary` | | AI 摘要结果，首次生成后写入 |

### 2.3 graph-index.json 格式

```json
{
  "version": "1.0",
  "generated_at": "2026-04-02T10:00:00Z",
  "domains": ["AI 核心技术与模型", "AI 产业生态与巨头", ...],
  "index": {
    "uuid-xxx": {
      "path": "notes/录音笔记/uuid-xxx.md",
      "domain": "AI 智能体与工程",
      "type": "录音笔记",
      "title": "笔记标题",
      "connections": [
        { "noteId": "uuid-yyy", "score": 0.92, "type": "semantic" },
        { "noteId": "uuid-zzz", "score": 0.78, "type": "explicit" }
      ]
    }
  },
  "stats": {
    "total_notes": 665,
    "total_connections": 5320,
    "by_domain": { "AI 核心技术与模型": 142, ... },
    "by_type": { "录音笔记": 380, "AI链接笔记": 200, ... }
  }
}
```

### 2.4 HTML → Markdown 转换器

**CLI 工具**：`tools/convert.ts`

```bash
# 转换命令
npx tsx tools/convert.ts ./source/voicenotes-xxx/ --out ./notes/
```

**转换逻辑**：
1. 解析每个 HTML 文件，提取标题、内容（innerText）、日期、标签
2. 下载或复制图片到 `images/{uuid}/` 目录
3. 生成 Markdown 文件，写入 frontmatter + 正文
4. 转换完成后，运行语义关联计算（复用 `src/linker/semantic.ts`），生成 `graph-index.json`
5. PCA 降维计算坐标，写入 frontmatter 的 `x` / `y` 字段

**幂等性**：重复转换时跳过已存在的 `.md` 文件（按 `id` 对比），支持增量更新。

---

## 3. 前端架构

### 3.1 技术栈

| 模块 | 技术选型 |
|------|----------|
| 框架 | Next.js 15 (App Router) |
| 图谱引擎 | react-force-graph-2d |
| 状态管理 | Zustand |
| 样式 | Tailwind CSS + CSS Variables |
| 图标 | Lucide React |
| 动画 | Framer Motion |
| LLM 调用 | OpenAI SDK / Anthropic SDK（云端 API） |

### 3.2 目录结构

```
web/
├── app/
│   ├── layout.tsx              # 根布局：全局 CSS Variables、字体、 Providers
│   ├── page.tsx                # 根页面 → 重定向 /graph
│   └── graph/
│       └── page.tsx            # 主页面：三栏布局
│
├── components/
│   ├── graph/
│   │   ├── ForceGraph.tsx      # react-force-graph 封装层
│   │   ├── NodeCard.tsx        # 自定义节点：圆角矩形 + 呼吸灯边框
│   │   └── ConnectionLine.tsx  # 自定义连线：实线（显式）/ 虚线（推理）+ 流动粒子
│   ├── panels/
│   │   ├── LeftNav.tsx         # 左侧导航栏：目录树 + 轨迹历史
│   │   └── RightPanel.tsx      # 右侧毛玻璃详情面板
│   ├── toolbar/
│   │   └── Toolbar.tsx         # 顶部工具栏
│   └── ui/
│       ├── SearchInput.tsx
│       ├── FilterSelect.tsx
│       └── AISummaryButton.tsx
│
├── stores/
│   └── graphStore.ts           # Zustand store
│                               #   - selectedNodeId
│                               #   - domainFilter / typeFilter
│                               #   - searchQuery
│                               #   - trailRecording / currentTrail
│                               #   - graphIndex (轻量)
│
├── lib/
│   ├── api.ts                  # 图谱索引 API（读 graph-index.json）
│   ├── note.ts                 # 笔记 API（读 .md 文件，解析 frontmatter）
│   ├── ai.ts                   # LLM 调用封装（生成摘要，写入 frontmatter）
│   └── graph-utils.ts          # 景深计算、语义缩放辅助函数
│
├── styles/
│   └── globals.css             # CSS Variables（Design Tokens）
│
└── public/
    ├── notes/                  # 软链接到项目根 notes/ 目录
    ├── images/                 # 软链接到项目根 images/ 目录
    └── graph-index.json        # 软链接到项目根
```

---

## 4. 视觉设计（Strategic Dark Tech）

### 4.1 Design Tokens

```css
:root {
  /* 背景 */
  --bg-base:     #0A0B10;
  --bg-surface:  #161B22;
  --bg-glass:    rgba(22, 27, 34, 0.85);
  --bg-elevated: #1C2330;

  /* 主色调 */
  --primary:     #00F5FF;   /* 霓虹青 - 主连接线、选中态 */
  --secondary:   #7000FF;   /* 极光紫 - AI 推理关联 */
  --accent-warn: #FF3B3B;
  --accent-ok:   #00FF85;

  /* 文字 */
  --text-primary:   #E0E0E0;
  --text-secondary: #888888;
  --text-muted:     #444444;

  /* 边框 */
  --border-dim:  rgba(255, 255, 255, 0.07);
  --border-glow: rgba(0, 245, 255, 0.4);

  /* 阴影 */
  --shadow-glass: 0 8px 40px rgba(0, 0, 0, 0.5);

  /* 圆角 */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;

  /* 字体 */
  --font-ui:   system-ui, -apple-system, "SF Pro Display", sans-serif;
  --font-mono: "JetBrains Mono", "Fira Code", monospace;
}
```

### 4.2 领域节点色

| 领域 | 色值 |
|------|------|
| AI 核心技术与模型 | `#2563EB` |
| AI 产业生态与巨头 | `#7C3AED` |
| AI 智能体与工程 | `#00F5FF` ← 升级为主色 |
| 管理、职场与个人成长 | `#D97706` |
| 行业应用与生活闲谈 | `#DB2777` |
| 企业数字化与数据治理 | `#0284C7` |
| 社会、安全与伦理 | `#7C22CE` |
| 其他 | `#6B7280` |

### 4.3 节点视觉规范

**形态**：圆角矩形（`border-radius: 8px`），非圆形
- 默认：半透明填充 + 1px 边框（`rgba(255,255,255,0.1)`）
- 悬停：边框变为 `var(--primary)`，外发光径向渐亡（呼吸灯，2s 循环）
- 选中：2px solid `var(--primary)`，内发光

**节点内容**：
```
┌──────────────────┐
│ [类型图标]  标题  │  ← 12px，系统图标
│           N 条关联 │  ← 徽章，右下角
└──────────────────┘
```

**景深模糊层级**：
- 聚焦节点（半径 200px 内）：100% 清晰
- 1 级关联：透明度 0.7，scale 0.95
- 2 级关联：透明度 0.4，scale 0.85
- 2 级以外：2px 圆点（纯色，无文字）

### 4.4 连线规范

| 类型 | 样式 | 颜色 | 粗细 |
|------|------|------|------|
| 显式关联（用户创建） | 实线 + 贝塞尔曲线 | `var(--primary)` | 1.5px |
| AI 推理关联 | 虚线（4,4） | `var(--secondary)` | 0.8px |
| 高亮路径 | 实线 + 流动粒子动画 | `var(--primary)` | 2px |

---

## 5. 交互设计

### 5.1 三栏布局

```
┌──────────────────────────────────────────────────────────────────┐
│                    Toolbar (52px, 毛玻璃)                        │
│  [📚 Memex] [🔍 搜索框...] [领域▾] [类型▾]  [🛤️轨迹] [⚙️]     │
├─────────────┬──────────────────────────────┬─────────────────────┤
│  LeftNav    │        ForceGraph Canvas      │    RightPanel       │
│  (280px)    │         (flex-1)             │    (360px, 毛玻璃)   │
│             │                              │                     │
│  📂 目录树    │   react-force-graph-2d       │   笔记标题           │
│   - 按领域折叠│   局部聚焦 · 景深模糊         │   日期 · 领域        │
│   - 笔记数量  │   语义缩放                   │   ─────────         │
│             │                              │   AI 摘要（可展开）   │
│  🛤️ 轨迹历史  │                              │   ─────────         │
│   - 最近10条 │                              │   笔记正文           │
│             │                              │   （Markdown渲染）    │
│  ⭐ 收藏标签  │                              │                     │
│             │                              │   ─────────         │
│             │                              │   关联笔记网格        │
│             │                              │                     │
└─────────────┴──────────────────────────────┴─────────────────────┘
```

### 5.2 核心交互

**语义缩放**（Semantic Zooming）：
- 远景（scale < 0.5）：仅显示"知识星团"标签（领域聚合节点）
- 中景（scale 0.5–1.2）：显示节点标题
- 近景（scale > 1.2）：显示头两行摘要文字

**局部聚焦**（Focused View）：
- 双击节点 → 以该节点为圆心，半径 200px 内显示 1 级关联
- 1 级关联外围：以微弱星点显示 2 级节点
- 点击空白处 → 回到全局视图

**路径轨迹**：
- 点击「🛤️ 记录轨迹」开始记录
- 连续点击 A → B → C，形成路径
- 路径高亮保存，可命名并持久化
- 轨迹文件存储为 `trails/{trail-id}.json`

### 5.3 右侧面板

- 从右侧滑入（Framer Motion，`x: 360 → 0`，300ms ease-out）
- Markdown 正文由 `react-markdown` + `remark-gfm` 渲染
- 图片点击放大（lightbox）
- 底部「✨ AI 摘要」按钮，生成后写入笔记 frontmatter 并持久化

---

## 6. AI 摘要功能

### 6.1 交互流程

1. 用户点击笔记节点 → 右侧面板展开
2. 检查 frontmatter 是否有 `ai_summary` 字段
   - 有：直接显示
   - 无：显示「✨ AI 摘要」按钮
3. 点击按钮 → loading 态（旋转图标）→ 调用 LLM
4. 返回摘要 → 写入 frontmatter → 显示结果

### 6.2 API 设计

```typescript
// POST /api/ai/summarize
// Body: { noteId: string; content: string }
// Response: { summary: string }

interface SummarizeRequest {
  noteId: string;
  content: string;
}

interface SummarizeResponse {
  summary: string;
  cached: boolean;  // 是否命中缓存
}
```

### 6.3 Prompt 模板

```
你是一个专业的知识管理助手。请用3句话简洁总结以下笔记的核心内容，保留关键术语和洞见。

笔记标题：{title}
笔记内容：
{content}

要求：
- 每句不超过25字
- 用中文回答
- 提取1-2个核心关键词
```

### 6.4 API Key 配置

```bash
# .env.local
OPENAI_API_KEY=sk-...
# 或
ANTHROPIC_API_KEY=sk-ant-...
```

---

## 7. 实施阶段

| 阶段 | 内容 | 关键产出 |
|------|------|----------|
| **Phase 1** | HTML→MD 转换器 + graph-index.json 生成 | `tools/convert.ts`，可运行完整转换 |
| **Phase 2** | Next.js 脚手架 + Design Tokens + 基础布局骨架 | 可运行的空白三栏页面 |
| **Phase 3** | react-force-graph 集成 + 节点/连线渲染 | 图谱可交互，节点点击响应 |
| **Phase 4** | 景深模糊 + 语义缩放 + 局部聚焦模式 | 解决"大毛线团"问题 |
| **Phase 5** | 左侧导航 + 右侧毛玻璃面板 + 搜索筛选 | 完整交互体验 |
| **Phase 6** | 轨迹记录 + AI 摘要 + 细节动画 | 高级功能收尾 |

---

## 8. 约束与约定

### 8.1 禁止事项
- frontmatter 字段不能删除，只能新增（向后兼容）
- `id` 字段全局唯一，禁止重复
- 不得在 frontmatter 之外存储笔记元数据

### 8.2 必守约定
- Markdown 正文使用标准 CommonMark
- 图片路径使用相对于 `images/` 的相对路径
- 所有日期格式为 `YYYY-MM-DD`
- LLM 调用结果必须写回 frontmatter，不存 localStorage

---

*设计批准日期：2026-04-02*
