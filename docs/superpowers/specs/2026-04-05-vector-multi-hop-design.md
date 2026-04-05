# 向量持久化 + 多跳搜索设计规范

> 版本：v1.0 · 2026-04-05
> 状态：起草中

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
- 已有生产验证：OpenClaw 在用 `memory-lancedb` 插件
- 轻量：665 篇笔记 × 768 维 float32 ≈ 2MB 存储

**参考**：OpenClaw 的 `extensions/memory-lancedb/` 实现

**安装**：
```bash
cd web && npm install @lancedb/lancedb
```

**存储路径**：`data/lancedb/`（项目根目录下的 data 文件夹内）

**⚠️ 安全约束**：项目根 `.gitignore` 已全局排除 `data/` 目录，LanceDB 数据（`data/lancedb/`）不会推送到 Git。

---

## 3. 数据架构

### 3.1 LanceDB 数据表设计

表名：`notes`

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 笔记 UUID（全库唯一） |
| `title` | string | 笔记标题 |
| `type` | string | 笔记类型（录音笔记/AI链接笔记 等） |
| `text` | string | 嵌入用文本：`{title}\n{body snippet}` |
| `vector` | float32[] | 768 维嵌入向量 |
| `createdAt` | int64 | 创建时间戳（毫秒） |

**schema**（LanceDB 初始化时）：
```typescript
{
  id: string,       // 主键
  title: string,    // 用于展示
  type: string,     // 用于过滤
  text: string,     // embed 输入
  vector: Float32Array, // 向量（固定 768 维）
  createdAt: number,
}
```

### 3.2 新增文件位置

```
my-getnote-kg/
├── data/
│   └── lancedb/              # ⚠️ 已加入 .gitignore
│       └── notes.lancedb/     # LanceDB 数据目录（自动生成）
│
├── web/
│   ├── app/
│   │   └── api/
│   │       └── vector/        # 新增 API 路由
│   │           ├── store/route.ts    # POST: 存储笔记向量
│   │           ├── search/route.ts   # POST: 多跳向量检索
│   │           └── stats/route.ts    # GET: 获取已存储笔记数量
│   │
│   └── lib/
│       ├── lancedb.ts        # LanceDB 客户端封装（lazy init）
│       └── embedding.ts       # 复用现有 dist/linker/semantic.js 的 embedBatch
│
└── tools/
    └── convert.ts             # 修改：convert 时追加写入 LanceDB
```

---

## 4. 实现方案

### 4.1 LanceDB 客户端封装（`web/lib/lancedb.ts`）

```typescript
// 核心思路：lazy init，API route 冷启动后常驻内存
// 参考 openclaw 的 createLanceDbRuntimeLoader 模式

import { connect, type Connection, type Table } from '@lancedb/lancedb';

const DB_PATH = path.join(process.cwd(), '..', 'data', 'lancedb', 'notes.lancedb');
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
      { id: '__init__', title: '', type: '', text: '', vector: new Float32Array(768), createdAt: 0 }
    ]);
    await table.delete('id = "__init__"');
    // 创建向量索引
    await table.createIndex('vector', { type: 'vector', metric: 'cosine' });
  }
  return table;
}

export async function storeNote(note: {
  id: string;
  title: string;
  type: string;
  text: string;
  vector: number[];
}): Promise<void> {
  const t = await getTable();
  await t.add([{
    id: note.id,
    title: note.title,
    type: note.type,
    text: note.text,
    vector: new Float32Array(note.vector),
    createdAt: Date.now(),
  }]);
}

export async function searchVectors(
  queryVector: number[],
  limit: number = 10,
  excludeIds?: string[]
): Promise<Array<{ id: string; title: string; type: string; text: string; score: number }>> {
  const t = await getTable();
  const results = await t.vectorSearch(new Float32Array(queryVector)).limit(limit + (excludeIds?.length ?? 0)).toArray();

  // 过滤掉 excludeIds
  const filtered = excludeIds?.length
    ? results.filter(r => !excludeIds.includes(r.id as string))
    : results;

  return filtered.slice(0, limit).map(row => ({
    id: row.id as string,
    title: row.title as string,
    type: row.type as string,
    text: row.text as string,
    score: 1 / (1 + ((row._distance as number) ?? 0)), // L2 距离转 cosine 相似度
  }));
}

export async function noteCount(): Promise<number> {
  const t = await getTable();
  return t.countRows();
}
```

### 4.2 Embedding 接口复用（`web/lib/embedding.ts`）

复用现有的 `dist/linker/semantic.js` 中的 `embedBatch`：

```typescript
// 由于 dist 是编译后产物，直接 import 使用
// 但为了类型安全，封装一个 embedText 函数
import { embedBatch } from '../../dist/linker/semantic.js';

export async function embedText(text: string): Promise<number[]> {
  const results = await embedBatch([text]);
  return results[0];
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  return embedBatch(texts);
}
```

### 4.3 API Routes

**POST `/api/vector/store`** — 存储笔记向量
- Body: `{ id, title, type, text, vector }`
- 幂等：已存在则静默跳过（LanceDB upsert 语义）

**POST `/api/vector/search`** — 多跳向量检索
- Body: `{ noteIds: string[], texts: string[], limit?: number }`
- 逻辑：
  1. 拼接 `texts` → embed → query vector
  2. LanceDB vector search
  3. 过滤掉 `noteIds` 中的笔记
  4. 返回 top-K 结果
- Response: `{ results: [{ id, title, type, score }] }`

**GET `/api/vector/stats`** — 返回已存储笔记数量

### 4.4 convert.ts 修改

在 convert 阶段**追加**写入 LanceDB，不影响现有的 Markdown + graph-index.json 生成逻辑：

```typescript
// 在 convert.ts 中新增
import { storeNote } from '../web/lib/lancedb.js';
import { embedText } from '../web/lib/embedding.js';

// 3. 追加写入 LanceDB（幂等：跳过已存在的笔记）
console.log('📚 写入 LanceDB 向量存储...');
for (const note of notes) {
  const existing = await noteExistsInDb(note.id); // 快速查重
  if (existing) continue;

  const text = `${note.title} ${note.contentSnippet || ''}`.trim();
  const vector = await embedText(text);
  await storeNote({
    id: note.id,
    title: note.title,
    type: note.tags[0] || '其他',
    text,
    vector,
  });
}
console.log(`   LanceDB 写入完成`);
```

---

## 5. 前端交互设计

### 5.1 多跳搜索入口

在 Toolbar 中增加「🔮 多跳搜索」按钮，点击后打开多跳搜索面板。

### 5.2 多跳搜索面板（RightPanel 内或独立抽屉）

```
┌──────────────────────────────────┐
│  🔮 多跳搜索                       │
│                                  │
│  当前组合（可拖拽排序）：           │
│  ┌──────────────────────────────┐ │
│  │ 🔗 A: LLM应用实战              │ │
│  │ 🔗 B: 知识图谱构建方法论        │ │
│  └──────────────────────────────┘ │
│                                  │
│  [从图谱选择笔记] [清空组合]       │
│                                  │
│  [🔍 基于组合搜索下一跳]          │
│                                  │
│  ── 推荐结果 ──                   │
│  ┌──────────────────────────────┐ │
│  │ 📄 企业数字化转型路径 (0.91)  │ │
│  │ 📄 RAG 系统设计指南 (0.87)   │ │
│  │ 📄 LLM Fine-tuning 入门 (0.84)│ │
│  └──────────────────────────────┘ │
└──────────────────────────────────┘
```

**交互流程**：
1. 用户从左侧笔记列表或图谱选中多条笔记 → 加入组合
2. 点击「🔍 基于组合搜索下一跳」
3. 调用 `POST /api/vector/search` → 返回 top-K 结果
4. 结果卡片可点击 → 跳转到对应节点
5. 结果可继续加入组合 → 继续扩展探索

---

## 6. .gitignore 约束

在项目根 `.gitignore` 中确保包含：

```gitignore
# LanceDB 向量数据库（包含笔记向量数据，禁止推送到 Git）
data/lancedb/
```

---

## 7. 实施计划

| 阶段 | 内容 | 关键产出 |
|------|------|----------|
| **Phase A** | LanceDB 客户端封装 + API Routes | `web/lib/lancedb.ts`, `/api/vector/*` |
| **Phase B** | embedding 复用封装 | `web/lib/embedding.ts` |
| **Phase C** | convert.ts 增量写入改造 | 已有笔记跳过，新笔记写入 LanceDB |
| **Phase D** | 前端多跳搜索面板 | Toolbar 按钮 + 搜索面板 |
| **Phase E** | 全量回填已有笔记向量 | 一次性的迁移脚本 |

---

## 8. 约束与约定

- 向量数据库路径：`data/lancedb/`（在项目根 `data/` 目录内）
- `.gitignore` 已全局排除 `data/`，LanceDB 数据不会泄漏
- embed 模型复用现有的 `google/gemini-embedding-001` + OpenRouter
- LanceDB 初始化采用 lazy 模式（API route 冷启动后常驻）
- 搜索结果排除当前 path 中的笔记 ID
- convert 阶段的向量写入是幂等的，已存在的笔记跳过

---

*起草日期：2026-04-05*
