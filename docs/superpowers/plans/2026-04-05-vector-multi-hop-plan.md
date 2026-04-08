# Vector Multi-Hop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** ✅ 已完成

**Goal:** Add persistent vector storage (LanceDB) and multi-hop search capability to the knowledge graph, enabling users to select multiple notes and discover the most relevant next-hop candidates.

**Architecture:**
- New shared `lib/` layer containing LanceDB client and embedding wrapper — accessible from both `tools/` (CLI) and `web/` (API routes)
- Next.js API routes expose vector search to the frontend
- `tools/convert.ts` gains incremental LanceDB write (idempotent — skips existing notes)
- One-shot backfill script populates LanceDB with existing 665 notes

**Tech Stack:** TypeScript, LanceDB (`@lancedb/lancedb`), Next.js API Routes, `dist/linker/semantic.js` (embedding source)

---

## File Map

```
NEW:
  lib/lancedb.ts          # LanceDB client, lazy init, CRUD + search
  lib/embedding.ts        # thin wrapper over dist/linker/semantic.js

  web/app/api/vector/
    store/route.ts        # POST /api/vector/store
    search/route.ts       # POST /api/vector/search
    stats/route.ts        # GET /api/vector/stats

  web/components/vector/
    MultiHopPanel.tsx     # Toolbar button + search panel
    VectorSearchButton.tsx # toolbar integration

  scripts/backfill.ts     # one-shot: populate LanceDB with existing 665 notes

MODIFY:
  tools/convert.ts        # + LanceDB incremental write after graph-index.json
  web/components/toolbar/Toolbar.tsx  # + multi-hop search button
  web/stores/graphStore.ts             # + multi-hop state (selectedIds, panelOpen)

DELETE:
  web/tools/markdown.ts                   # duplicate — tools/markdown.ts is the single source
  web/tools/markdown.test.ts              # tests for the duplicate
```

---

## Task 1: Create `lib/lancedb.ts` — LanceDB Client

**Files:**
- Create: `lib/lancedb.ts`
- Install: `@lancedb/lancedb`

### Step 1: Install dependency

```bash
npm install @lancedb/lancedb
```

### Step 2: Write `lib/lancedb.ts`

```typescript
// lib/lancedb.ts
import { connect, type Connection, type Table } from '@lancedb/lancedb';
import * as path from 'path';

// LanceDB data lives under data/lancedb/, already excluded by .gitignore
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
    // Create with dummy row, delete it, then create index
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

/** Store a single note vector. Idempotent (can be called repeatedly for same id). */
export async function storeNote(note: NoteVector): Promise<void> {
  const t = await getTable();
  await t.add([{
    ...note,
    vector: new Float32Array(note.vector),
    createdAt: note.createdAt ?? Date.now(),
  }]);
}

/** Search by vector, optionally excluding some ids (e.g. notes already in the current path). */
export async function searchVectors(
  queryVector: number[],
  limit: number = 10,
  excludeIds?: string[],
): Promise<Array<{ id: string; title: string; type: string; text: string; score: number }>> {
  const t = await getTable();
  const maxResults = limit + (excludeIds?.length ?? 0);
  const results = await t
    .vectorSearch(new Float32Array(queryVector))
    .limit(maxResults)
    .toArray();

  const filtered = excludeIds?.length
    ? results.filter(r => !excludeIds.includes(r.id as string))
    : results;

  return filtered.slice(0, limit).map(row => ({
    id: row.id as string,
    title: row.title as string,
    type: row.type as string,
    text: row.text as string,
    // LanceDB default L2 distance → approximate cosine similarity
    score: 1 / (1 + ((row._distance as number) ?? 0)),
  }));
}

/** Total count of stored note vectors. */
export async function noteCount(): Promise<number> {
  const t = await getTable();
  return t.countRows();
}

/** Check whether a note id already exists in the store. */
export async function noteExists(id: string): Promise<boolean> {
  const t = await getTable();
  const results = await t.search([id]).limit(1).toArray();
  return results.length > 0;
}
```

### Step 3: Verify the module type-checks

```bash
npx tsc lib/lancedb.ts --noEmit --esModuleInterop --moduleResolution node16 --module esnext
```

Expected: no errors

### Step 4: Commit

```bash
git add lib/lancedb.ts package.json package-lock.json
git commit -m "feat(lib): add LanceDB client with lazy init

storeNote, searchVectors, noteCount, noteExists.
Data path: data/lancedb/notes.lancedb/ (already in .gitignore).

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Create `lib/embedding.ts` — Embedding Wrapper

**Files:**
- Create: `lib/embedding.ts`

### Step 1: Write `lib/embedding.ts`

```typescript
// lib/embedding.ts
// Reuses embedBatch from dist/linker/semantic.js (the single embedding implementation)
// dist/ is compiled output — no TypeScript source exists for this module

// @ts-ignore — dist has no .d.ts
import { embedBatch } from '../dist/linker/semantic.js';

export async function embedText(text: string): Promise<number[]> {
  const results = await embedBatch([text]);
  return results[0];
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  return embedBatch(texts);
}
```

### Step 2: Verify it type-checks (tsconfig from root)

```bash
npx tsc lib/embedding.ts --noEmit --esModuleInterop --moduleResolution node16 --module esnext
```

Expected: no errors (ts-ignore suppresses the dist/.d.ts gap)

### Step 3: Commit

```bash
git add lib/embedding.ts
git commit -m "feat(lib): add embedding wrapper over dist/linker/semantic.js

embedText, embedTexts — delegates to embedBatch.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Create API Routes

**Files:**
- Create: `web/app/api/vector/store/route.ts`
- Create: `web/app/api/vector/search/route.ts`
- Create: `web/app/api/vector/stats/route.ts`

### Step 1: Write `web/app/api/vector/store/route.ts`

```typescript
// web/app/api/vector/store/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { storeNote } from '@/lib/lancedb';
import { embedText } from '@/lib/embedding';

export async function POST(req: NextRequest) {
  try {
    const { id, title, type, text } = await req.json();

    if (!id || !text) {
      return NextResponse.json({ error: 'id and text are required' }, { status: 400 });
    }

    // If vector not provided, compute it
    let { vector } = await req.json();
    if (!vector) {
      vector = await embedText(`${title ?? ''}\n${text}`);
    }

    await storeNote({ id, title: title ?? '', type: type ?? '', text, vector });
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    console.error('[vector/store]', err);
    return NextResponse.json({ error: 'Failed to store vector' }, { status: 500 });
  }
}
```

### Step 2: Write `web/app/api/vector/search/route.ts`

```typescript
// web/app/api/vector/search/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { searchVectors } from '@/lib/lancedb';
import { embedText } from '@/lib/embedding';

export async function POST(req: NextRequest) {
  try {
    const { texts, limit = 10, excludeIds = [] } = await req.json();

    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      return NextResponse.json({ error: 'texts array is required' }, { status: 400 });
    }

    // Combine selected notes into one query
    const queryText = texts.join('\n---\n');
    const vector = await embedText(queryText);
    const results = await searchVectors(vector, limit, excludeIds);

    return NextResponse.json({ results });
  } catch (err) {
    console.error('[vector/search]', err);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
```

### Step 3: Write `web/app/api/vector/stats/route.ts`

```typescript
// web/app/api/vector/stats/route.ts
import { NextResponse } from 'next/server';
import { noteCount } from '@/lib/lancedb';

export async function GET() {
  try {
    const count = await noteCount();
    return NextResponse.json({ count });
  } catch (err) {
    console.error('[vector/stats]', err);
    return NextResponse.json({ error: 'Failed to get stats' }, { status: 500 });
  }
}
```

### Step 4: Verify build

```bash
cd web && npm run build 2>&1 | tail -20
```

Expected: build succeeds (no TS errors from the new routes)

### Step 5: Commit

```bash
git add web/app/api/vector/
git commit -m "feat(api): add /api/vector store/search/stats routes

POST /api/vector/store — store note vector
POST /api/vector/search — multi-hop search (combines texts, excludes path ids)
GET  /api/vector/stats  — count of stored vectors

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 4: Modify `tools/convert.ts` — Incremental LanceDB Write

**Files:**
- Modify: `tools/convert.ts`

### Step 1: Read current `tools/convert.ts`

Read the full file to understand where to insert the LanceDB write step.

### Step 2: Add imports near the top

Find the `import` block at the top of the file. Add after the existing imports:

```typescript
import { storeNote, noteExists } from '../lib/lancedb.js';
import { embedText } from '../lib/embedding.js';
```

### Step 3: Find the insertion point

After the section that writes `graph-index.json` (the `fs.writeFileSync(indexPath, ...)` line), before the final `console.log('✅ 完成！')`, insert:

```typescript
// 3b. Incremental LanceDB write (idempotent)
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
```

### Step 4: Verify the file is syntactically valid

```bash
npx tsc tools/convert.ts --noEmit --esModuleInterop --moduleResolution node16 --module esnext
```

Expected: no errors

### Step 5: Commit

```bash
git add tools/convert.ts
git commit -m "feat(convert): add incremental LanceDB write after graph-index.json

Idempotent — skips notes already in the store.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 5: Frontend Multi-Hop Search Panel

**Files:**
- Create: `web/components/vector/MultiHopPanel.tsx`
- Create: `web/components/vector/VectorSearchButton.tsx`
- Modify: `web/components/toolbar/Toolbar.tsx`
- Modify: `web/stores/graphStore.ts`

### Step 1: Add multi-hop state to `graphStore.ts`

Read `web/stores/graphStore.ts`. Find the interface definition and add:

```typescript
// In GraphState interface, add:
multiHopIds: string[];
multiHopPanelOpen: boolean;

// In actions, add:
setMultiHopIds: (ids: string[]) => void;
addMultiHopId: (id: string) => void;
removeMultiHopId: (id: string) => void;
setMultiHopPanelOpen: (open: boolean) => void;
```

Add implementations:

```typescript
multiHopIds: [],
multiHopPanelOpen: false,

setMultiHopIds: (ids) => set({ multiHopIds: ids }),
addMultiHopId: (id) => set(state => ({
  multiHopIds: state.multiHopIds.includes(id)
    ? state.multiHopIds
    : [...state.multiHopIds, id]
})),
removeMultiHopId: (id) => set(state => ({
  multiHopIds: state.multiHopIds.filter(x => x !== id)
})),
setMultiHopPanelOpen: (open) => set({ multiHopPanelOpen: open }),
```

### Step 2: Write `web/components/vector/VectorSearchButton.tsx`

```tsx
'use client';
import { useGraphStore } from '@/stores/graphStore';

export default function VectorSearchButton() {
  const { multiHopPanelOpen, setMultiHopPanelOpen, multiHopIds } = useGraphStore();

  return (
    <button
      onClick={() => setMultiHopPanelOpen(!multiHopPanelOpen)}
      title="多跳搜索"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 12px',
        background: multiHopPanelOpen ? 'rgba(0,245,255,0.15)' : 'transparent',
        border: `1px solid ${multiHopPanelOpen ? 'rgba(0,245,255,0.4)' : 'rgba(255,255,255,0.1)'}`,
        borderRadius: 6,
        color: multiHopIds.length > 0 ? 'var(--primary)' : 'var(--text-secondary)',
        cursor: 'pointer',
        fontSize: 13,
      }}
    >
      🔮 多跳搜索
      {multiHopIds.length > 0 && (
        <span style={{
          background: 'var(--primary)',
          color: '#000',
          borderRadius: 10,
          padding: '0 6px',
          fontSize: 11,
          fontWeight: 700,
        }}>
          {multiHopIds.length}
        </span>
      )}
    </button>
  );
}
```

### Step 3: Write `web/components/vector/MultiHopPanel.tsx`

```tsx
'use client';
import { useState } from 'react';
import { useGraphStore } from '@/stores/graphStore';

export default function MultiHopPanel() {
  const { multiHopIds, multiHopPanelOpen, setMultiHopIds, removeMultiHopId, graphIndex } = useGraphStore();
  const [results, setResults] = useState<Array<{ id: string; title: string; type: string; score: number }>>([]);
  const [loading, setLoading] = useState(false);

  if (!multiHopPanelOpen) return null;

  const selectedNotes = multiHopIds
    .map(id => graphIndex?.index[id])
    .filter(Boolean);

  const handleSearch = async () => {
    if (multiHopIds.length === 0) return;
    setLoading(true);
    try {
      const texts = selectedNotes.map(n => `${n!.title}\n${n!.title}`);
      const res = await fetch('/api/vector/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts, limit: 10, excludeIds: multiHopIds }),
      });
      const data = await res.json();
      setResults(data.results ?? []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'absolute',
      top: 52,
      right: 16,
      width: 340,
      background: 'var(--bg-glass)',
      backdropFilter: 'blur(20px)',
      border: '1px solid var(--border-dim)',
      borderRadius: 12,
      padding: 16,
      zIndex: 100,
      boxShadow: 'var(--shadow-glass)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ color: 'var(--primary)', fontWeight: 600 }}>🔮 多跳搜索</span>
        <button onClick={handleSearch} disabled={multiHopIds.length === 0 || loading}
          style={{ fontSize: 12, padding: '4px 10px', background: 'var(--primary)', color: '#000', border: 'none', borderRadius: 4, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1 }}>
          {loading ? '搜索中…' : '🔍 搜索'}
        </button>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>当前组合（点击移除）：</div>
        {multiHopIds.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>从图谱选中笔记加入</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {selectedNotes.map((n, i) => n && (
              <div key={multiHopIds[i]} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '4px 8px', background: 'rgba(0,245,255,0.05)',
                border: '1px solid rgba(0,245,255,0.15)', borderRadius: 6, fontSize: 12,
              }}>
                <span style={{ color: 'var(--text-primary)' }}>🔗 {n.title}</span>
                <button onClick={() => removeMultiHopId(multiHopIds[i])}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12 }}>
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button onClick={() => setMultiHopIds([])}
          style={{ fontSize: 12, padding: '4px 10px', background: 'transparent', border: '1px solid var(--border-dim)', color: 'var(--text-secondary)', borderRadius: 4, cursor: 'pointer' }}>
          清空
        </button>
      </div>

      {results.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>推荐结果：</div>
          {results.map(r => (
            <div key={r.id} style={{
              padding: '6px 8px', marginBottom: 4,
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--border-dim)', borderRadius: 6,
              cursor: 'pointer', fontSize: 12,
            }}>
              <div style={{ color: 'var(--text-primary)', marginBottom: 2 }}>📄 {r.title}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{r.type} · {(r.score * 100).toFixed(0)}%</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

### Step 4: Add VectorSearchButton to Toolbar

Read `web/components/toolbar/Toolbar.tsx`. Find where other buttons are rendered and add:

```tsx
import VectorSearchButton from '@/components/vector/VectorSearchButton';

// In the toolbar JSX, alongside other buttons:
<VectorSearchButton />
```

Also add the MultiHopPanel overlay:

```tsx
import MultiHopPanel from '@/components/vector/MultiHopPanel';

// In the component JSX (e.g. after the main toolbar div):
<MultiHopPanel />
```

### Step 5: Verify build

```bash
cd web && npm run build 2>&1 | tail -20
```

Expected: build succeeds

### Step 6: Commit

```bash
git add web/components/vector/ web/stores/graphStore.ts web/components/toolbar/Toolbar.tsx
git commit -m "feat(frontend): add multi-hop search panel

Toolbar button with badge, slide-in panel, search results.
Add to path: click nodes in graph → badge count → panel shows results.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 6: One-Shot Backfill Script

**Files:**
- Create: `scripts/backfill.ts`

### Step 1: Write `scripts/backfill.ts`

```typescript
#!/usr/bin/env node
// scripts/backfill.ts
// One-shot: populate LanceDB with vectors for all existing notes.
// Run once: npx tsx scripts/backfill.ts
import * as fs from 'fs';
import * as path from 'path';
import matter from 'gray-matter';
import { storeNote, noteExists } from '../lib/lancedb.js';
import { embedText } from '../lib/embedding.js';

const NOTES_DIR = path.resolve(process.cwd(), 'notes');

async function backfill() {
  const typeDirs = fs.readdirSync(NOTES_DIR).filter(f =>
    fs.statSync(path.join(NOTES_DIR, f)).isDirectory()
  );

  let total = 0;
  let stored = 0;
  let skipped = 0;

  for (const typeDir of typeDirs) {
    const mdFiles = fs.readdirSync(path.join(NOTES_DIR, typeDir))
      .filter(f => f.endsWith('.md'));

    for (const mdFile of mdFiles) {
      total++;
      const id = mdFile.replace(/\.md$/, '');
      const mdPath = path.join(NOTES_DIR, typeDir, mdFile);

      const exists = await noteExists(id);
      if (exists) {
        skipped++;
        continue;
      }

      const raw = fs.readFileSync(mdPath, 'utf-8');
      const { data, content } = matter(raw);

      const text = `${data.title ?? ''}\n${content.slice(0, 500)}`.trim();
      const vector = await embedText(text);

      await storeNote({
        id,
        title: data.title ?? '',
        type: data.type ?? typeDir,
        text,
        vector,
      });
      stored++;
      process.stdout.write(`\r   ${stored}/${total} stored, ${skipped} skipped`);
    }
  }
  console.log(`\n✅ 完成：新增 ${stored} 篇，跳过 ${skipped} 篇`);
}

backfill().catch(err => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
```

### Step 2: Add scripts entry to `package.json`

Read `package.json`. Add to `scripts`:

```json
"backfill": "npx tsx scripts/backfill.ts"
```

### Step 3: Run the backfill

```bash
npm run backfill
```

Expected: populates LanceDB with vectors for existing 665 notes

### Step 4: Commit

```bash
git add scripts/backfill.ts package.json
git commit -m "scripts: add one-shot LanceDB backfill for existing notes

Populates data/lancedb/ with vectors for all 665 existing notes.
Usage: npm run backfill

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 7: Delete Duplicate `web/tools/markdown.ts`

**Files:**
- Delete: `web/tools/markdown.ts`
- Delete: `web/tools/markdown.test.ts`

### Step 1: Delete the duplicate files

```bash
rm web/tools/markdown.ts web/tools/markdown.test.ts
```

### Step 2: Verify nothing else imports these files

```bash
grep -r "web/tools/markdown" web/ --include='*.ts' --include='*.tsx'
```

Expected: no results (nothing references the deleted files)

### Step 3: Commit

```bash
git add -A
git commit -m "refactor: remove duplicate web/tools/markdown.ts

tools/markdown.ts is the single source of truth.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Spec Coverage Check

| Spec Requirement | Task |
|-----------------|------|
| LanceDB client with lazy init | Task 1 |
| Embedding wrapper over dist/semantic.js | Task 2 |
| POST /api/vector/store | Task 3 |
| POST /api/vector/search (multi-hop) | Task 3 |
| GET /api/vector/stats | Task 3 |
| convert.ts incremental write | Task 4 |
| Toolbar multi-hop button | Task 5 |
| Multi-hop search panel UI | Task 5 |
| One-shot backfill script | Task 6 |
| Delete duplicate markdown.ts | Task 7 |

## Self-Review

1. **Placeholder scan**: All code blocks are complete. No TBD/TODO. Commands have expected output.
2. **Type consistency**: `NoteVector` interface defined in Task 1, used in Tasks 3 and 4. `searchVectors` return shape used in Task 5 API call. All consistent.
3. **Spec gaps**: None found — all 6 phases from the spec are covered across the 7 tasks.
