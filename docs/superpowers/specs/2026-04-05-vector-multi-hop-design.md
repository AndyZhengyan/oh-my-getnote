# 向量持久化 + 多跳搜索设计规范

> 版本：v1.1 · 2026-04-05
> 状态：起草中

## 0. 架构修正说明

### 现有架构问题

当前项目存在以下架构问题，本设计一并修正：

**问题 1：`dist/` 是唯一源码，无 TypeScript 源文件**
```
dist/linker/semantic.js       ← 只有编译后的 .js
dist/linker/projector.js
dist/parser/index.js
```
`convert.ts` 直接 import `../dist/linker/semantic.js`，不规范。`src/` 目录不存在。

**问题 2：`markdown.ts` 存在两个副本（违反单源原则）**
```
tools/markdown.ts             ← convert.ts 用
web/tools/markdown.ts         ← 有测试文件
```
需要统一为一个。

**问题 3：LanceDB 若放 `web/lib/`，`tools/` 无法 import**
```
tools/convert.ts  ──?──→  web/lib/lancedb.ts   ← 跨 tsconfig，import 不通
```

**问题 4：`dist/` 未加入 `.gitignore`**
已编译产物被 Git 追踪，不应在 `dist/` 内放新增代码。

### 修正方案

```
my-getnote-kg/
├── lib/                        ← 新增：共享模块（CLI 和 Web 都能 import）
│   ├── lancedb.ts              # LanceDB 客户端封装（lazy init）
│   └── embedding.ts             # embedding 接口封装（复用 dist/linker/semantic.js）
│
├── dist/                       # 编译产物（已有，保持不变）
│   └── linker/semantic.js      # embedding 实现（继续复用）
│
├── tools/
│   ├── convert.ts              # import from ../lib/lancedb.ts, ../lib/embedding.ts
│   └── markdown.ts             # 统一：保留 tools/markdown.ts，删除 web/tools/markdown.ts
│
└── web/
    ├── app/api/
    │   └── vector/
    │       ├── store/route.ts   # import from ../../lib/lancedb.ts
    │       ├── search/route.ts
    │       └── stats/route.ts
    └── lib/
        └── ...                 # 现有文件不变
```

**核心变化**：
- `lib/` 是共享层，`tools/` 和 `web/` 都能 import
- LanceDB 数据目录：`lib/lancedb/`（在 `data/` 下，已被全局 .gitignore 排除）
- `markdown.ts` 统一为 `tools/markdown.ts`，删除 `web/tools/markdown.ts`

---

## 1. 背景与目标

### 现状

当前 `tools/convert.ts` 的语义关联流程：
1. 调用 OpenRouter API (`google/gemini-embedding-001`) 为每篇笔记生成 768 维向量
2. O(n²) 全量余弦相似度计算
3. 结果写入 `.md` frontmatter 的 `connections` 字段和 `graph-index.json`
4. **向量本身不持久化**——每次 convert 都要重新调用 API

### 痛点

- 新增笔记时，无法增量找到关联（必须全量重算）
- 多跳探索（用户选中 A+B → 查第三跳）没有实现基础
- embedding API 调用量大，每次 convert 都重新算

### 目标

1. **向量持久化**：将笔记向量存储到本地向量数据库，避免重复计算
2. **多跳搜索**：支持用户选中多条笔记（路径），查询与之最相关的"下一跳"候选
3. **增量更新**：convert 新笔记时只处理增量部分，已有笔记跳过

---

## 2. 技术选型

### 向量数据库：LanceDB

**选择理由**：
- 嵌入式（文件级存储），零运维，不需要单独服务进程
- Node.js 原生支持，可直接运行在 Next.js API Routes
- 内置 ANN 索引（DiskANN），查询效率远优于 O(n²) 暴力搜索
- 已有生产验证：OpenClaw 在用 `memory-lancedb` 插件（`extensions/memory-lancedb/`）
- 轻量：665 篇笔记 × 768 维 float32 ≈ 2MB 存储

**安装**：
```bash
npm install @lancedb/lancedb
```

**存储路径**：`data/lancedb/`（项目根 `data/` 目录，已全局在 .gitignore 排除）

---

## 3. 数据架构

### 3.1 LanceDB 数据表设计

表名：`notes`

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 笔记 UUID（全库唯一） |
| `title` | string | 笔记标题（用于展示） |
| `type` | string | 笔记类型（录音笔记/AI链接笔记 等） |
| `text` | string | 嵌入用文本：`{title}\n{body snippet}` |
| `vector` | Float32Array | 768 维嵌入向量 |
| `createdAt` | number | 创建时间戳（毫秒） |

### 3.2 文件位置

```
my-getnote-kg/
├── lib/                        # 新增：共享层
│   ├── lancedb.ts              # LanceDB 客户端封装
│   └── embedding.ts            # embedding 接口封装
│
├── dist/                       # 编译产物（已有）
│   └── linker/semantic.js      # embedBatch 实现（复用）
│
├── tools/
│   ├── convert.ts             # 修改：import lib/lancedb.ts, lib/embedding.ts
│   └── markdown.ts             # 统一：唯一 markdown 处理代码
│
└── web/
    ├── app/api/
    │   └── vector/
    │       ├── store/route.ts   # POST: 存储笔记向量
    │       ├── search/route.ts  # POST: 多跳向量检索
    │       └── stats/route.ts   # GET: 已存储数量
    └── lib/                    # 现有文件不变
```

---

## 4. 实现方案

### 4.1 LanceDB 客户端（`lib/lancedb.ts`）

```typescript
// lib/lancedb.ts
import { connect, type Connection, type Table } from '@lancedb/lancedb';
import * as path from 'path';

// LanceDB 数据放在 data/ 目录下，已被 .gitignore 排除
const DB_PATH = path.resolve(process.cwd(), 'data', 'lancedb', 'notes.lancedb');
const TABLE_NAME = 'notes';

let db: Connection | null = null;
let table: Table | null = null;

async function getTable(): Promise<Table> {
  if (table) return table;
  db = await connect(DB_PATH);
  const tables = await db.tableNames();
  if (tables.includes(TABLE_NAME)) {
    table = await db.openTable(TABLE_NAME);
  } else {
    table = await db.createTable(TABLE_NAME, [
      {
        id: '__init__',
        title: '',
        type: '',
        text: '',
        vector: new Float32Array(768),
        createdAt: 0,
      },
    ]);
    await table.delete('id = "__init__"');
    await table.createIndex('vector', { type: 'vector', metric: 'cosine' });
  }
  return table;
}

export interface NoteVector {
  id: string;
  title: string;
  type: string;
  text: string;
  vector: number[];
  createdAt?: number;
}

export async function storeNote(note: NoteVector): Promise<void> {
  const t = await getTable();
  await t.add([{
    ...note,
    vector: new Float32Array(note.vector),
    createdAt: note.createdAt ?? Date.now(),
  }]);
}

export async function searchVectors(
  queryVector: number[],
  limit: number = 10,
  excludeIds?: string[],
): Promise<Array<{ id: string; title: string; type: string; text: string; score: number }>> {
  const t = await getTable();
  const maxResults = limit + (excludeIds?.length ?? 0);
  const results = await t.vectorSearch(new Float32Array(queryVector)).limit(maxResults).toArray();

  const filtered = excludeIds?.length
    ? results.filter(r => !excludeIds.includes(r.id as string))
    : results;

  return filtered.slice(0, limit).map(row => ({
    id: row.id as string,
    title: row.title as string,
    type: row.type as string,
    text: row.text as string,
    // LanceDB 默认 L2 距离，转为 cosine 相似度近似
    score: 1 / (1 + ((row._distance as number) ?? 0)),
  }));
}

export async function noteCount(): Promise<number> {
  const t = await getTable();
  return t.countRows();
}

export async function noteExists(id: string): Promise<boolean> {
  const t = await getTable();
  const results = await t.search([id]).limit(1).toArray();
  return results.length > 0;
}
```

### 4.2 Embedding 封装（`lib/embedding.ts`）

复用 `dist/linker/semantic.js` 中的 `embedBatch`：

```typescript
// lib/embedding.ts
// 复用 dist/linker/semantic.js 的 embedBatch（唯一的 embedding 实现）

// @ts-ignore — dist 是编译产物，无类型定义
import { embedBatch } from '../dist/linker/semantic.js';

export async function embedText(text: string): Promise<number[]> {
  const results = await embedBatch([text]);
  return results[0];
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  return embedBatch(texts);
}
```

> **说明**：`dist/linker/semantic.js` 是当前唯一的 embedding 实现来源，TypeScript 源文件不存在于此。随着项目演进，未来可以将 embedding 逻辑迁移到 `lib/embedding.ts` 并添加类型定义。

### 4.3 API Routes

**POST `/api/vector/store`** — 存储笔记向量
- Body: `{ id, title, type, text, vector }`
- LanceDB add 操作幂等（同一 id 可重复写入，后续可升级为 upsert）

**POST `/api/vector/search`** — 多跳向量检索
- Body: `{ texts: string[], limit?: number, excludeIds?: string[] }`
- 逻辑：
  1. 拼接 `texts` → `embedText()` → query vector
  2. `searchVectors(queryVector, limit + excludeIds.length)`
  3. 过滤 `excludeIds`
  4. 返回 top-K 结果
- Response: `{ results: [{ id, title, type, score }] }`

**GET `/api/vector/stats`** — 返回已存储笔记数量

### 4.4 convert.ts 改造

修改 `tools/convert.ts`，在语义关联计算后追加写入 LanceDB：

```typescript
// tools/convert.ts 新增 import
import { storeNote, noteExists } from '../lib/lancedb.js';
import { embedText } from '../lib/embedding.js';

// 在已有 Markdown + graph-index.json 生成流程之后，新增：
// 3b. 追加写入 LanceDB（幂等：跳过已存在的笔记）
if (notes.length > 1) {
  console.log('📚 写入 LanceDB 向量存储...');
  let stored = 0;
  for (const note of notes) {
    const exists = await noteExists(note.id);
    if (exists) continue;

    const text = `${note.title} ${note.contentSnippet || ''}`.trim();
    const vector = await embedText(text);
    await storeNote({
      id: note.id,
      title: note.title,
      type: note.tags[0] || '其他',
      text,
      vector,
    });
    stored++;
  }
  console.log(`   LanceDB 新写入：${stored} 篇`);
}
```

### 4.5 markdown.ts 统一

删除 `web/tools/markdown.ts`，确认 `tools/markdown.ts` 是唯一来源：
- `convert.ts` → `tools/markdown.ts`（保持不变）
- `web/tools/markdown.ts` → **删除**，相关测试文件同步清理

---

## 5. 前端交互设计

### 5.1 多跳搜索入口

Toolbar 中增加「🔮 多跳搜索」按钮，点击展开多跳搜索面板。

### 5.2 多跳搜索面板

```
┌──────────────────────────────────┐
│  🔮 多跳搜索                       │
│                                  │
│  当前组合：                        │
│  ┌──────────────────────────────┐ │
│  │ 🔗 LLM应用实战                 │ │
│  │ 🔗 知识图谱构建方法论           │ │
│  └──────────────────────────────┘ │
│                                  │
│  [从图谱选择] [清空]              │
│  [🔍 搜索下一跳]                 │
│                                  │
│  ── 推荐结果 ──                   │
│  ┌──────────────────────────────┐ │
│  │ 📄 企业数字化转型 (0.91)     │ │
│  │ 📄 RAG 系统设计 (0.87)       │ │
│  │ 📄 LLM Fine-tuning (0.84)   │ │
│  └──────────────────────────────┘ │
└──────────────────────────────────┘
```

**交互流程**：
1. 用户从图谱或笔记列表选中多条笔记 → 加入组合
2. 点击「🔍 搜索下一跳」
3. 调用 `POST /api/vector/search`
4. 结果可点击跳转，可继续加入组合扩展探索

---

## 6. 实施计划

| 阶段 | 内容 | 关键产出 |
|------|------|----------|
| **Phase A** | `lib/lancedb.ts` + `lib/embedding.ts` 创建 | 共享层代码 |
| **Phase B** | API Routes: `/api/vector/store`, `/api/vector/search`, `/api/vector/stats` | API 可用 |
| **Phase C** | `tools/convert.ts` 增量写入改造 | convert 时自动追加 LanceDB |
| **Phase D** | 删除 `web/tools/markdown.ts`，清理重复代码 | 单一来源原则 |
| **Phase E** | 前端多跳搜索面板 | Toolbar + 搜索面板 |
| **Phase F** | 全量回填脚本（一次性） | 将现有 665 篇笔记向量写入 LanceDB |

---

## 7. 约束与约定

- 向量数据库路径：`data/lancedb/`（在 `data/` 下，已全局 .gitignore 排除）
- embed 模型继续使用 `google/gemini-embedding-001` + OpenRouter
- LanceDB 初始化采用 lazy 模式（API route 冷启动后常驻）
- 搜索结果排除当前组合中的笔记 ID
- `markdown.ts` 统一为 `tools/markdown.ts`，删除重复副本
- convert 阶段向量写入幂等，已存在笔记跳过
- `dist/linker/semantic.js` 作为 embedding 实现来源不变（无 TypeScript 源文件）

---

*起草日期：2026-04-05*
