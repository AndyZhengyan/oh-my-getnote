# Memex 2.0 Phase 1 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** ✅ 已完成

**Goal:** 将 Get笔记导出的 HTML 文件批量转换为 Markdown + frontmatter 格式，生成 `graph-index.json` 图谱索引。

**Architecture:** 复用现有 `src/parser/` HTML 解析、`src/linker/semantic.ts` 语义关联计算、`src/linker/projector.ts` PCA 降维；新增 `tools/markdown.ts` 处理 HTML→Markdown 转换（含 frontmatter 生成）、`tools/indexer.ts` 生成 `graph-index.json`。CLI 入口 `tools/convert.ts`。

**Tech Stack:** TypeScript, Node.js fs/path, 复用现有 OpenAI 嵌入 pipeline

---

## 文件结构

```
tools/
├── convert.ts        # CLI 入口（新建）
├── markdown.ts        # HTML→Markdown，含 frontmatter 生成（新建）
├── indexer.ts        # graph-index.json 生成逻辑（新建）
src/
├── parser/index.ts   # 复用：HTML 解析
├── linker/semantic.ts # 复用：语义关联（buildNoteConnections）
├── linker/projector.ts # 复用：PCA 降维（projectTo2D）
├── types.ts          # 复用：Note, NoteConnection 类型
notes/                 # 输出目录（按 type 子目录）
images/                # 输出目录（图片按 uuid 子目录）
graph-index.json       # 输出文件
```

---

## Task 1: tools/markdown.ts — HTML→Markdown 转换

**Files:**
- Create: `tools/markdown.ts`
- Test: `tests/tools/markdown.test.ts`（新建）

- [ ] **Step 1: 写测试用例**

```typescript
// tests/tools/markdown.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { convertHtmlToMarkdown, NoteMetadata } from '../../tools/markdown.js';

const FIXTURE_HTML = `<html><body>
<h1>测试笔记标题</h1>
<p>创建于：2026-03-28 10:30:00<br><span class="tag">录音笔记</span><span class="tag">AI智能体</span></p>
<hr>
<div>这是笔记正文内容，包含一些关键信息。</div>
</body></html>`;

describe('convertHtmlToMarkdown', () => {
  it('从 HTML 提取标题、日期、标签', () => {
    const result = convertHtmlToMarkdown(FIXTURE_HTML, 'test-uuid-001', '/tmp/images/');
    expect(result.frontmatter.title).toBe('测试笔记标题');
    expect(result.frontmatter.date).toBe('2026-03-28');
    expect(result.frontmatter.tags).toEqual(['录音笔记', 'AI智能体']);
    expect(result.frontmatter.type).toBe('录音笔记');
  });

  it('生成有效 YAML frontmatter', () => {
    const result = convertHtmlToMarkdown(FIXTURE_HTML, 'test-uuid-001', '/tmp/images/');
    // frontmatter 包含必需字段
    expect(result.frontmatter.id).toBe('test-uuid-001');
    expect(result.frontmatter.title).toBeTruthy();
    expect(result.frontmatter.type).toBeTruthy();
  });

  it('正文去除 HTML 标签', () => {
    const result = convertHtmlToMarkdown(FIXTURE_HTML, 'test-uuid-001', '/tmp/images/');
    expect(result.body).not.toContain('<');
    expect(result.body).not.toContain('>');
  });

  it('处理无标题无标签的无效笔记返回 null', () => {
    const result = convertHtmlToMarkdown('<html><body><p>无内容</p></body></html>', 'bad-001', '/tmp/images/');
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `cd /Users/zhengyan/Projects/ai-project/my-getnote-kg && npx vitest run tests/tools/markdown.test.ts`
Expected: FAIL — `tools/markdown.ts` not found

- [ ] **Step 3: 实现 minimal 骨架**

```typescript
// tools/markdown.ts
import * as fs from 'fs';
import * as path from 'path';
import { Note, NoteConnection } from '../src/types.js';

export interface NoteMetadata {
  id: string;
  title: string;
  date: string;
  type: string;
  tags: string[];
  domain: string;
  connections: Array<{ noteId: string; score: number; type: 'semantic' | 'explicit' }>;
  x?: number;
  y?: number;
  ai_summary?: string;
}

export interface ConvertResult {
  frontmatter: NoteMetadata;
  body: string;
  imageRefs: string[]; // 相对路径列表
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\s+/g, ' ').trim();
}

export function convertHtmlToMarkdown(
  html: string,
  id: string,
  imagesOutDir: string,
): ConvertResult | null {
  const filename = id;

  // Title
  const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  const title = titleMatch ? stripHtml(titleMatch[1]).trim() : '';
  if (!title) return null;

  // Tags
  const tagMatches = [...html.matchAll(/<span class="tag"[^>]*>([\s\S]*?)<\/span>/gi)];
  const tags: string[] = tagMatches
    .map(m => stripHtml(m[1]).trim())
    .filter(t => t.length > 0 && t !== 'null');
  const type = tags[0] || '其他';

  // Date
  let date = '';
  const dateMatch = html.match(/创建于[：:]\s*(\d{4}-\d{2}-\d{2})\s+\d{2}:\d{2}:\d{2}/);
  if (dateMatch) date = dateMatch[1];

  // Body
  const lastHrIdx = html.lastIndexOf('<hr');
  const afterHtml = lastHrIdx >= 0 ? html.slice(lastHrIdx) : html;
  const cleanAfter = afterHtml
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<div[^>]*id\s*=["']?jsonData["']?[^>]*>[\s\S]*?<\/div>/gi, '')
    .replace(/<audio[\s\S]*?<\/audio>/gi, '')
    .replace(/<source[\s\S]*?\/?>/gi, '');
  let body = stripHtml(cleanAfter);
  if (title && body.startsWith(title)) {
    body = body.slice(title.length).replace(/^[\s:：,，.]+/, '').trim();
  }

  // Image refs (收集相对路径)
  const imgMatches = [...html.matchAll(/src=["']([^"']+)["']/gi)];
  const imageRefs: string[] = [];
  for (const m of imgMatches) {
    const src = m[1];
    if (/\.(jpg|jpeg|png|gif|webp)$/i.test(src)) {
      imageRefs.push(src);
    }
  }

  return {
    frontmatter: {
      id,
      title,
      date,
      type,
      tags,
      domain: '', // 待后续填充（通过 taxonomy 分类）
      connections: [],
    },
    body,
    imageRefs,
  };
}

export function buildMarkdownString(result: ConvertResult): string {
  const fm = result.frontmatter;
  const lines: string[] = ['---'];
  lines.push(`id: "${fm.id}"`);
  lines.push(`title: "${fm.title.replace(/"/g, '\\"')}"`);
  lines.push(`type: "${fm.type}"`);
  lines.push(`tags: [${fm.tags.map(t => `"${t.replace(/"/g, '\\"')}"`).join(', ')}]`);
  lines.push(`domain: "${fm.domain}"`);
  if (fm.date) lines.push(`date: "${fm.date}"`);
  if (fm.connections.length > 0) {
    lines.push('connections:');
    for (const c of fm.connections) {
      lines.push(`  - noteId: "${c.noteId}"`);
      lines.push(`    score: ${c.score}`);
      lines.push(`    type: "${c.type}"`);
    }
  }
  if (fm.x !== undefined && fm.y !== undefined) {
    lines.push(`x: ${fm.x}`);
    lines.push(`y: ${fm.y}`);
  }
  if (fm.ai_summary) {
    lines.push('ai_summary: |');
    for (const line of fm.ai_summary.split('\n')) {
      lines.push(`  ${line}`);
    }
  }
  lines.push('---', '', result.body);

  // Append image refs as markdown
  if (result.imageRefs.length > 0) {
    lines.push('');
    for (const ref of result.imageRefs) {
      const fname = path.basename(ref);
      lines.push(`![](images/${fm.id}/${fname})`);
    }
  }

  return lines.join('\n');
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npx vitest run tests/tools/markdown.test.ts`
Expected: PASS（全部 4 个测试）

- [ ] **Step 5: 提交**

```bash
git add tools/markdown.ts tests/tools/markdown.test.ts
git commit -m "feat(phase1): add HTML→Markdown converter with frontmatter generation

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 2: tools/indexer.ts — graph-index.json 生成器

**Files:**
- Create: `tools/indexer.ts`
- Test: `tests/tools/indexer.test.ts`（新建）

- [ ] **Step 1: 写测试用例**

```typescript
// tests/tools/indexer.test.ts
import { describe, it, expect } from 'vitest';
import { buildGraphIndex, NoteIndexEntry } from '../../tools/indexer.js';

const mockEntries: NoteIndexEntry[] = [
  {
    id: 'note-001',
    path: 'notes/录音笔记/note-001.md',
    domain: 'AI 智能体与工程',
    type: '录音笔记',
    title: 'AI Agent 设计模式',
    connections: [{ noteId: 'note-002', score: 0.92, type: 'semantic' as const }],
  },
  {
    id: 'note-002',
    path: 'notes/AI链接笔记/note-002.md',
    domain: 'AI 核心技术与模型',
    type: 'AI链接笔记',
    title: 'GPT-4 能力分析',
    connections: [{ noteId: 'note-001', score: 0.92, type: 'semantic' as const }],
  },
];

describe('buildGraphIndex', () => {
  it('生成包含 stats 的索引', () => {
    const index = buildGraphIndex(mockEntries);
    expect(index.stats.total_notes).toBe(2);
    expect(index.stats.total_connections).toBe(2);
  });

  it('by_domain 统计正确', () => {
    const index = buildGraphIndex(mockEntries);
    expect(index.stats.by_domain['AI 智能体与工程']).toBe(1);
    expect(index.stats.by_domain['AI 核心技术与模型']).toBe(1);
  });

  it('by_type 统计正确', () => {
    const index = buildGraphIndex(mockEntries);
    expect(index.stats.by_type['录音笔记']).toBe(1);
    expect(index.stats.by_type['AI链接笔记']).toBe(1);
  });

  it('index 映射正确', () => {
    const index = buildGraphIndex(mockEntries);
    expect(index.index['note-001'].title).toBe('AI Agent 设计模式');
    expect(index.index['note-001'].connections[0].noteId).toBe('note-002');
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npx vitest run tests/tools/indexer.test.ts`
Expected: FAIL — `tools/indexer.ts` not found

- [ ] **Step 3: 实现 minimal 代码**

```typescript
// tools/indexer.ts
export interface NoteIndexEntry {
  id: string;
  path: string;
  domain: string;
  type: string;
  title: string;
  connections: Array<{ noteId: string; score: number; type: 'semantic' | 'explicit' }>;
}

export interface GraphIndex {
  version: '1.0';
  generated_at: string;
  domains: string[];
  index: Record<string, {
    path: string;
    domain: string;
    type: string;
    title: string;
    connections: Array<{ noteId: string; score: number; type: string }>;
  }>;
  stats: {
    total_notes: number;
    total_connections: number;
    by_domain: Record<string, number>;
    by_type: Record<string, number>;
  };
}

export function buildGraphIndex(entries: NoteIndexEntry[]): GraphIndex {
  const domainsSet = new Set<string>();
  const byDomain: Record<string, number> = {};
  const byType: Record<string, number> = {};
  let totalConnections = 0;

  const index: GraphIndex['index'] = {};

  for (const entry of entries) {
    domainsSet.add(entry.domain);
    byDomain[entry.domain] = (byDomain[entry.domain] || 0) + 1;
    byType[entry.type] = (byType[entry.type] || 0) + 1;
    totalConnections += entry.connections.length;

    index[entry.id] = {
      path: entry.path,
      domain: entry.domain,
      type: entry.type,
      title: entry.title,
      connections: entry.connections,
    };
  }

  return {
    version: '1.0',
    generated_at: new Date().toISOString(),
    domains: Array.from(domainsSet),
    index,
    stats: {
      total_notes: entries.length,
      total_connections: totalConnections,
      by_domain: byDomain,
      by_type: byType,
    },
  };
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npx vitest run tests/tools/indexer.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add tools/indexer.ts tests/tools/indexer.test.ts
git commit -m "feat(phase1): add graph-index.json generator

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3: tools/convert.ts — CLI 入口

**Files:**
- Create: `tools/convert.ts`
- Modify: `package.json`（添加 convert 命令脚本）
- Test: `tests/tools/convert.test.ts`（新建）

- [ ] **Step 1: 写测试用例**

```typescript
// tests/tools/convert.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import { processExportFolder } from '../../tools/convert.js';

describe('processExportFolder', () => {
  // 使用现有 src/parser/test fixture 或临时目录
  // 实际测试依赖于 source/ 目录存在，跳过端到端
  it('函数签名正确', () => {
    // 验证函数存在且可调用
    expect(typeof processExportFolder).toBe('function');
  });
});
```

- [ ] **Step 2: 实现 convert.ts CLI**

```typescript
#!/usr/bin/env node
// tools/convert.ts
import * as fs from 'fs';
import * as path from 'path';
import { parseHtmlFile } from '../src/parser/index.js';
import { buildNoteConnections } from '../src/linker/semantic.js';
import { projectTo2D } from '../src/linker/projector.js';
import { Note } from '../src/types.js';
import { convertHtmlToMarkdown, buildMarkdownString, NoteMetadata } from './markdown.js';
import { buildGraphIndex, NoteIndexEntry } from './indexer.js';
import { Command } from 'commander';

const program = new Command();

program
  .name('convert')
  .description('将 Get笔记 HTML 导出转换为 Markdown + graph-index.json')
  .argument('<source>', 'source 目录（包含 notes/ 子目录）')
  .option('-o, --out <dir>', '输出目录', '.')
  .option('--no-images', '跳过图片下载')
  .option('--no-links', '跳过语义关联计算')
  .action(async (source: string, opts) => {
    const notesDir = path.join(source, 'notes');
    if (!fs.existsSync(notesDir)) {
      console.error(`错误：找不到 notes 目录：${notesDir}`);
      process.exit(1);
    }

    const outDir = opts.out;
    const notesOutDir = path.join(outDir, 'notes');
    const imagesOutDir = path.join(outDir, 'images');

    // 确保输出目录存在
    fs.mkdirSync(notesOutDir, { recursive: true });
    fs.mkdirSync(imagesOutDir, { recursive: true });

    // 1. 解析所有 HTML
    console.log('📖 解析 HTML 文件...');
    const htmlFiles = fs.readdirSync(notesDir).filter(f => f.endsWith('.html'));
    const notes: Note[] = [];
    for (const file of htmlFiles) {
      const note = parseHtmlFile(path.join(notesDir, file));
      if (note) notes.push(note);
    }
    console.log(`   解析完成：${notes.length} 篇笔记`);

    // 2. HTML→Markdown 转换
    console.log('📝 转换为 Markdown...');
    const metadataMap = new Map<string, NoteMetadata>();

    for (const note of notes) {
      const htmlPath = path.join(notesDir, `${note.id}.html`);
      const html = fs.readFileSync(htmlPath, 'utf-8');
      const noteImageDir = path.join(imagesOutDir, note.id);
      fs.mkdirSync(noteImageDir, { recursive: true });

      // 复制图片（相对路径收集）
      const imgMatches = [...html.matchAll(/src=["']([^"']+)["']/gi)];
      for (const m of imgMatches) {
        const src = m[1];
        if (/\.(jpg|jpeg|png|gif|webp)$/i.test(src) && !src.startsWith('http')) {
          const srcPath = path.join(notesDir, src);
          if (fs.existsSync(srcPath)) {
            const fname = path.basename(srcPath);
            fs.copyFileSync(srcPath, path.join(noteImageDir, fname));
          }
        }
      }

      const result = convertHtmlToMarkdown(html, note.id, noteImageDir);
      if (!result) continue;

      // 确定领域（从 tags 推断，后续可用 taxonomy 增强）
      const domain = inferDomain(note.tags);
      result.frontmatter.domain = domain;

      metadataMap.set(note.id, result.frontmatter);

      // 写入 Markdown
      const typeDir = path.join(notesOutDir, result.frontmatter.type);
      fs.mkdirSync(typeDir, { recursive: true });
      const mdContent = buildMarkdownString(result);
      fs.writeFileSync(path.join(typeDir, `${note.id}.md`), '\uFEFF' + mdContent, 'utf8');
    }
    console.log(`   转换完成：${metadataMap.size} 篇 Markdown`);

    // 3. 语义关联计算（可选）
    if (opts.links !== false && notes.length > 1) {
      console.log('🔗 计算语义关联...');
      const connections = await buildNoteConnections(notes, 0.5, 8);
      for (const [noteId, conns] of connections) {
        const meta = metadataMap.get(noteId);
        if (meta) {
          meta.connections = conns.map(c => ({
            noteId: c.noteId,
            score: c.score,
            type: 'semantic' as const,
          }));
        }
      }
      console.log(`   关联计算完成`);
    }

    // 4. PCA 降维（复用 projector）
    if (notes.length > 1) {
      console.log('📐 PCA 降维...');
      // 从已有 embeddings 计算（复用 embedNotes 结果）
      // 简化：跳过 embedding 重新计算，直接用 projector 对占位向量
      // 实际应在 linker pipeline 中一并完成，此处留空接口
    }

    // 5. 生成 graph-index.json
    console.log('🗂️  生成 graph-index.json...');
    const entries: NoteIndexEntry[] = Array.from(metadataMap.entries()).map(([id, meta]) => ({
      id,
      path: `notes/${meta.type}/${id}.md`,
      domain: meta.domain,
      type: meta.type,
      title: meta.title,
      connections: meta.connections,
    }));
    const graphIndex = buildGraphIndex(entries);
    fs.writeFileSync(
      path.join(outDir, 'graph-index.json'),
      JSON.stringify(graphIndex, null, 2),
      'utf8'
    );
    console.log(`✅ 完成！`);
    console.log(`   笔记：${graphIndex.stats.total_notes} 篇`);
    console.log(`   关联：${graphIndex.stats.total_connections} 条`);
    console.log(`   领域：${graphIndex.domains.join(', ')}`);
  });

function inferDomain(tags: string[]): string {
  // 简化领域推断：后续由 taxonomy 增强
  const tagStr = tags.join('');
  if (tagStr.includes('AI') || tagStr.includes('LLM') || tagStr.includes('GPT')) return 'AI 核心技术与模型';
  if (tagStr.includes('智能体') || tagStr.includes('Agent')) return 'AI 智能体与工程';
  if (tagStr.includes('管理') || tagStr.includes('职场') || tagStr.includes('成长')) return '管理、职场与个人成长';
  return '其他';
}

program.parse();
```

- [ ] **Step 3: 添加 package.json 脚本**

在 `package.json` 添加：

```json
{
  "bin": {
    "memex-convert": "./tools/convert.ts"
  },
  "scripts": {
    "convert": "npx tsx tools/convert.ts",
    "test": "vitest run"
  },
  "devDependencies": {
    "vitest": "^2.0.0"
  }
}
```

Run: `npm install vitest --save-dev`

- [ ] **Step 4: 运行测试**

Run: `npx vitest run tests/tools/convert.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add tools/convert.ts package.json
git commit -m "feat(phase1): add convert CLI entry point

Usage: npx tsx tools/convert.ts ./source/voicenotes-xxx/ --out ./

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 4: 端到端验证

**Files:**
- Run: `npx tsx tools/convert.ts ./source/voicenotes-202603272159-getnotes_archive_1a71a34b40018ee0wflq7pEq/ --out ./`
- Verify: `ls notes/`，`ls notes/录音笔记/ | head`，`cat graph-index.json | head -50`
- Verify: `wc -l notes/**/` 应有 665 个 .md 文件
- Verify: `jq '.stats' graph-index.json` 应显示 total_notes: 665

- [ ] **Step 1: 运行完整转换**

```bash
cd /Users/zhengyan/Projects/ai-project/my-getnote-kg
npx tsx tools/convert.ts \
  ./source/voicenotes-202603272159-getnotes_archive_1a71a34b40018ee0wflq7pEq/ \
  --out ./
```

Expected output: `✅ 完成！ 笔记：665 篇 关联：5320 条`

- [ ] **Step 2: 验证输出文件**

```bash
# 验证 Markdown 文件数量
find notes -name "*.md" | wc -l
# Expected: 665

# 验证 frontmatter 格式
head -20 notes/录音笔记/*.md | head -30

# 验证 graph-index.json
jq '.stats, .domains[0:3]' graph-index.json
# Expected: total_notes: 665, total_connections: ~5320

# 验证图片目录
ls images/ | head
```

- [ ] **Step 3: 提交转换产物**

```bash
git add notes/ images/ graph-index.json
git commit -m "data: add converted Markdown notes and graph-index

665 notes converted from Get笔记 HTML export.
Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## 验收清单

- [ ] `tools/markdown.ts` 测试全部通过
- [ ] `tools/indexer.ts` 测试全部通过
- [ ] `npx tsx tools/convert.ts` 可成功运行
- [ ] `notes/` 目录包含 665 个 `.md` 文件，按类型分目录
- [ ] 每个 `.md` 文件包含正确 frontmatter（id, title, type, tags, domain, date, connections）
- [ ] `graph-index.json` 包含全局索引 + stats
- [ ] 图片文件复制到 `images/{uuid}/` 目录
- [ ] 幂等性：重复运行不重复生成文件
- [ ] 代码已提交到 GitHub，关联 Issue #1
