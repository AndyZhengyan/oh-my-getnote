# Memex 2.0 Phase 5 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> **Worktree**: `/Users/zhengyan/Projects/ai-project/my-getnote-kg/.worktrees/phase2`
> **基于**: `phase2/nextjs-scaffold` 分支（已包含 Phase 2 + Phase 3）

**Goal:** 完整三栏交互——左侧目录导航、右侧毛玻璃详情面板（Markdown渲染）、搜索高亮。

---

## 核心功能规格

### 左侧导航栏（LeftNav 增强）

**目录树**：
- 按领域折叠/展开（默认全部展开）
- 每个叶子节点显示笔记数量徽章
- 点击条目 → 设置 `domainFilter`
- 当前激活的筛选高亮显示

**轨迹历史**：
- 显示最近 10 条已保存轨迹
- 点击轨迹 → 在图谱中高亮该路径
- 数据来源：`localStorage`（`trails` key）

**快捷筛选**：
- "最近笔记"（按日期排序的前20篇）
- "高关联笔记"（connections.length 最多的5篇）

### 右侧面板（RightPanel 完整实现）

**内容**：
1. 笔记标题（h3）
2. 元信息行：`类型 · 领域 · 日期`
3. AI 摘要（若 frontmatter 有 `ai_summary`，直接显示；若无，显示"✨ AI 摘要"按钮）
4. 笔记正文（react-markdown 渲染，调用 `loadNote()` 按需加载）
5. 关联笔记列表（点击跳转）
6. 标签芯片（点击设置 `typeFilter`）

**交互**：
- 面板从右侧滑入（Framer Motion）
- 加载笔记内容时显示 loading spinner
- 关联笔记点击 → 更新 `selectedNodeId`

### 搜索高亮

**行为**：
- 搜索时图谱中所有节点透明度降低（0.3）
- 标题/内容/标签匹配的节点恢复正常透明度 + 边框高亮
- 关联笔记连线也高亮

### AI 摘要按钮

- 面板底部「✨ AI 摘要」按钮
- 点击后：按钮变 loading，调用 `/api/ai/summarize`
- 返回摘要 → 写入 Markdown frontmatter（PATCH 请求到 `/api/notes/update`）
- 结果缓存本地，下次直接显示

---

## 文件修改清单

```
web/components/panels/
├── LeftNav.tsx        # 增强：折叠目录树 + 轨迹历史 + 快捷筛选
├── RightPanel.tsx     # 完整实现：Markdown渲染 + AI摘要按钮 + 关联笔记
web/app/api/
├── ai/summarize/route.ts  # POST: 调用 LLM 生成摘要
├── notes/update/route.ts  # PATCH: 写回 frontmatter
web/lib/
├── note.ts            # 修改：暴露 NoteContent 类型
web/components/ui/
├── AIGenButton.tsx    # 新建：AI摘要按钮组件
```

---

## Task 1: API Routes — AI 摘要 + 写回

**Files:**
- Create: `web/app/api/ai/summarize/route.ts`
- Create: `web/app/api/notes/update/route.ts`

### web/app/api/ai/summarize/route.ts

```typescript
// web/app/api/ai/summarize/route.ts
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `你是一个专业的知识管理助手。请用3句话简洁总结以下笔记的核心内容，保留关键术语和洞见。要求：每句不超过25字，用中文回答，提取1-2个核心关键词。`;

export async function POST(req: NextRequest) {
  try {
    const { noteId, title, content } = await req.json();

    if (!content || content.trim().length === 0) {
      return NextResponse.json({ error: 'Content is empty' }, { status: 400 });
    }

    const completion = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `笔记标题：${title}\n笔记内容：\n${content.slice(0, 2000)}` },
      ],
      max_tokens: 300,
      temperature: 0.3,
    });

    const summary = completion.choices[0]?.message?.content?.trim() ?? '';

    return NextResponse.json({ summary, noteId });
  } catch (err) {
    console.error('AI summarize error:', err);
    return NextResponse.json(
      { error: 'AI summarization failed' },
      { status: 500 }
    );
  }
}
```

### web/app/api/notes/update/route.ts

```typescript
// web/app/api/notes/update/route.ts
import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

export async function PATCH(req: NextRequest) {
  try {
    const { path: notePath, frontmatter } = await req.json();

    if (!notePath || !frontmatter) {
      return NextResponse.json({ error: 'Missing path or frontmatter' }, { status: 400 });
    }

    // 构建完整文件路径（notePath 是相对于 public/ 的路径，如 "notes/录音笔记/uuid.md"）
    const fullPath = path.join(process.cwd(), 'public', notePath);

    if (!fs.existsSync(fullPath)) {
      return NextResponse.json({ error: 'Note file not found' }, { status: 404 });
    }

    const content = fs.readFileSync(fullPath, 'utf8');
    const bodyStart = content.indexOf('\n---\n', 4);
    if (bodyStart < 0) {
      return NextResponse.json({ error: 'Invalid markdown format' }, { status: 500 });
    }

    const body = content.slice(bodyStart + 5);
    const newFm = buildFrontmatter(frontmatter);
    const newContent = `${newFm}\n---\n${body}`;
    fs.writeFileSync(fullPath, '\uFEFF' + newContent, 'utf8');

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Update note error:', err);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
}

function buildFrontmatter(fm: Record<string, unknown>): string {
  const lines: string[] = ['---'];
  for (const [key, value] of Object.entries(fm)) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'string') {
      lines.push(`${key}: "${value.replace(/"/g, '\\"')}"`);
    } else if (typeof value === 'number') {
      lines.push(`${key}: ${value}`);
    } else if (Array.isArray(value)) {
      lines.push(`${key}: [${value.map(v => `"${String(v).replace(/"/g, '\\"')}"`).join(', ')}]`);
    } else {
      lines.push(`${key}: "${String(value).replace(/"/g, '\\"')}"`);
    }
  }
  lines.push('---');
  return lines.join('\n');
}
```

- [ ] **Step 1: 创建目录并写入两个 API 文件**
- [ ] **Step 2: 添加 .env.local 示例（web/.env.local）**

```
# web/.env.local
OPENAI_API_KEY=your-openai-api-key-here
```

**注意**：`.env.local` 不需要 git 追踪（已在 `.gitignore` 中），创建但不提交。

- [ ] **Step 3: 提交 API 文件（不包含 .env.local）**

```bash
git add web/app/api/
git commit -m "feat(phase5): add AI summarize and note update API routes

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 2: LeftNav 完整实现

**Files:**
- Modify: `web/components/panels/LeftNav.tsx`

完整实现（含折叠目录树、轨迹历史、快捷筛选）：

```tsx
// web/components/panels/LeftNav.tsx
'use client';

import { useState, useEffect } from 'react';
import { useGraphStore } from '@/stores/graphStore';
import { ChevronRight, ChevronDown, Bookmark, Clock, Zap } from 'lucide-react';

interface Trail {
  id: string;
  name: string;
  createdAt: string;
  steps: { noteId: string }[];
}

const DOMAIN_COLORS: Record<string, string> = {
  'AI 核心技术与模型':   '#2563EB',
  'AI 产业生态与巨头':  '#7C3AED',
  'AI 智能体与工程':    '#00F5FF',
  '管理、职场与个人成长': '#D97706',
  '行业应用与生活闲谈': '#DB2777',
  '企业数字化与数据治理': '#0284C7',
  '社会、安全与伦理':  '#7C22CE',
  '其他':               '#6B7280',
};

export default function LeftNav() {
  const { graphIndex, domainFilter, setDomainFilter, typeFilter, setTypeFilter } = useGraphStore();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [showTrails, setShowTrails] = useState(false);
  const [trails, setTrails] = useState<Trail[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('memex_trails');
      if (stored) setTrails(JSON.parse(stored));
    } catch {}
  }, []);

  if (!graphIndex) return null;

  const types = Object.keys(graphIndex.stats.by_type);

  const toggleCollapse = (key: string) =>
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <aside style={{
      width: 280,
      height: 'calc(100vh - 52px)',
      position: 'fixed',
      top: 52,
      left: 0,
      background: 'rgba(22,27,34,0.6)',
      borderRight: '1px solid var(--border-dim)',
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* 知识领域 */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{
          padding: '12px 16px 6px',
          fontSize: 10,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span>知识领域</span>
        </div>

        {/* 全部笔记 */}
        <NavItem
          active={domainFilter === '' && typeFilter === ''}
          onClick={() => { setDomainFilter(''); setTypeFilter(''); }}
          color="#fff"
          count={graphIndex.stats.total_notes}
          label="全部笔记"
        />

        {/* 按领域 */}
        {graphIndex.domains.map(domain => (
          <div key={domain}>
            <NavItem
              active={domainFilter === domain}
              onClick={() => setDomainFilter(domainFilter === domain ? '' : domain)}
              color={DOMAIN_COLORS[domain] ?? '#6B7280'}
              count={graphIndex.stats.by_domain[domain] ?? 0}
              label={domain}
            />
          </div>
        ))}

        {/* 按类型 */}
        <div style={{ padding: '12px 16px 6px', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          笔记类型
        </div>
        {types.map(type => (
          <NavItem
            key={type}
            active={typeFilter === type}
            onClick={() => setTypeFilter(typeFilter === type ? '' : type)}
            color="var(--text-secondary)"
            count={graphIndex.stats.by_type[type]}
            label={type}
          />
        ))}
      </div>

      {/* 底部导航 */}
      <div style={{ borderTop: '1px solid var(--border-dim)', padding: '8px 0' }}>
        <button
          onClick={() => setShowTrails(!showTrails)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 16px',
            background: 'none',
            border: 'none',
            color: showTrails ? 'var(--primary)' : 'var(--text-secondary)',
            fontSize: 13,
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <Bookmark size={13} />
          探索轨迹 ({trails.length})
        </button>

        {showTrails && (
          <div style={{ padding: '4px 0' }}>
            {trails.length === 0 && (
              <div style={{ padding: '8px 16px', fontSize: 12, color: 'var(--text-muted)' }}>
                暂无轨迹记录
              </div>
            )}
            {trails.slice(0, 10).map(trail => (
              <div key={trail.id} style={{
                padding: '6px 16px 6px 32px',
                fontSize: 12,
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {trail.name}
                <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>
                  {trail.steps.length}步
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

function NavItem({
  active, onClick, color, count, label,
}: {
  active: boolean;
  onClick: () => void;
  color: string;
  count: number;
  label: string;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: '7px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        cursor: 'pointer',
        background: active ? 'rgba(0,245,255,0.08)' : 'transparent',
        color: active ? 'var(--primary)' : 'var(--text-secondary)',
        fontSize: 13,
        transition: 'background 0.15s, color 0.15s',
      }}
    >
      <span style={{
        width: 8, height: 8, borderRadius: '50%',
        background: color, flexShrink: 0,
        opacity: active ? 1 : 0.7,
      }} />
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
        {count}
      </span>
    </div>
  );
}
```

- [ ] **Step 1: 覆盖 web/components/panels/LeftNav.tsx**
- [ ] **Step 2: 提交**

```bash
git add web/components/panels/LeftNav.tsx
git commit -m "feat(phase5): complete LeftNav with domain/type tree and trails panel

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3: RightPanel 完整实现

**Files:**
- Modify: `web/components/panels/RightPanel.tsx`

完整实现（含按需加载 Markdown、AI 摘要按钮、关联笔记点击）：

```tsx
// web/components/panels/RightPanel.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useGraphStore } from '@/stores/graphStore';
import { loadNote, NoteContent } from '@/lib/note';
import { X, Sparkles, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function RightPanel() {
  const { selectedNodeId, graphIndex, selectNode, focusMode, setFocusMode } = useGraphStore();
  const [note, setNote] = useState<NoteContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    if (!selectedNodeId || !graphIndex) {
      setNote(null);
      setAiSummary(null);
      return;
    }

    const entry = graphIndex.index[selectedNodeId];
    if (!entry) return;

    // 如果 frontmatter 有 ai_summary 直接用
    // 否则从 localStorage 缓存读取
    const cached = localStorage.getItem(`ai_summary_${selectedNodeId}`);
    if (cached) setAiSummary(cached);

    setLoading(true);
    loadNote(entry.path).then(n => {
      setNote(n);
      if (n?.frontmatter.ai_summary) {
        setAiSummary(n.frontmatter.ai_summary);
        localStorage.setItem(`ai_summary_${selectedNodeId}`, n.frontmatter.ai_summary);
      }
      setLoading(false);
    });
  }, [selectedNodeId, graphIndex]);

  const handleAISummary = useCallback(async () => {
    if (!selectedNodeId || !note?.body) return;
    setAiLoading(true);
    try {
      const res = await fetch('/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          noteId: selectedNodeId,
          title: note.frontmatter.title,
          content: note.body,
        }),
      });
      const data = await res.json();
      if (data.summary) {
        setAiSummary(data.summary);
        localStorage.setItem(`ai_summary_${selectedNodeId}`, data.summary);
        // 写回 frontmatter
        await fetch('/api/notes/update', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: graphIndex!.index[selectedNodeId!].path,
            frontmatter: { ...note.frontmatter, ai_summary: data.summary },
          }),
        });
      }
    } catch (err) {
      console.error('AI summary failed:', err);
    } finally {
      setAiLoading(false);
    }
  }, [selectedNodeId, note, graphIndex]);

  const visible = !!(selectedNodeId && graphIndex);
  if (!visible) return null;

  const entry = graphIndex!.index[selectedNodeId!];
  if (!entry) return null;

  return (
    <aside style={{
      position: 'fixed',
      right: 16,
      top: 64,
      width: 360,
      maxHeight: 'calc(100vh - 80px)',
      background: 'var(--bg-glass)',
      backdropFilter: 'blur(20px)',
      border: '1px solid var(--border-dim)',
      borderRadius: 12,
      boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
      overflowY: 'auto',
      zIndex: 200,
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* 聚焦模式提示 */}
      {focusMode && (
        <div style={{
          padding: '8px 16px',
          background: 'rgba(0,245,255,0.08)',
          borderBottom: '1px solid rgba(0,245,255,0.15)',
          fontSize: 11,
          color: 'var(--primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span>🧭 聚焦模式 · 右键节点展开关联</span>
          <button
            onClick={() => setFocusMode(false)}
            style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: 11 }}
          >
            退出聚焦
          </button>
        </div>
      )}

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        padding: '14px 16px 10px',
        borderBottom: '1px solid var(--border-dim)',
      }}>
        <h3 style={{
          fontSize: 14, fontWeight: 600, flex: 1,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          paddingRight: 8, color: '#fff',
        }}>
          {entry.title}
        </h3>
        <button
          onClick={() => selectNode(null)}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0 }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Meta */}
      <div style={{ padding: '10px 16px 6px', borderBottom: '1px solid var(--border-dim)' }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
          {entry.type} · {entry.domain}
        </div>
        {/* Tags */}
        {note?.frontmatter.tags && note.frontmatter.tags.length > 1 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {note.frontmatter.tags.slice(1).map(tag => (
              <span key={tag} style={{
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid var(--border-dim)',
                borderRadius: 4,
                padding: '1px 7px',
                fontSize: 11,
                color: 'var(--text-secondary)',
              }}>
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* AI Summary */}
      {(aiSummary || aiLoading) && (
        <div style={{
          padding: '10px 16px',
          borderBottom: '1px solid var(--border-dim)',
          background: 'rgba(0,245,255,0.04)',
        }}>
          <div style={{ fontSize: 10, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
            ✨ AI 摘要
          </div>
          {aiLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
              <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
              生成中…
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              {aiSummary}
            </div>
          )}
        </div>
      )}

      {/* Body */}
      <div style={{ padding: '12px 16px', flex: 1 }}>
        {loading && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>
            <Loader2 size={16} style={{ animation: 'spin 1s linear infinite', marginBottom: 8 }} />
            <div>加载中…</div>
          </div>
        )}
        {!loading && note?.body && (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {note.body}
            </ReactMarkdown>
          </div>
        )}
        {!loading && !note?.body && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            （无正文内容）
          </div>
        )}
      </div>

      {/* AI Button + Connections */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-dim)' }}>
        {!aiSummary && !aiLoading && (
          <button
            onClick={handleAISummary}
            style={{
              width: '100%',
              padding: '7px 12px',
              background: 'rgba(0,245,255,0.1)',
              border: '1px solid rgba(0,245,255,0.3)',
              borderRadius: 8,
              color: 'var(--primary)',
              fontSize: 12,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              marginBottom: 12,
            }}
          >
            <Sparkles size={13} />
            ✨ AI 摘要
          </button>
        )}

        {entry.connections.length > 0 && (
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
            相似笔记 ({entry.connections.length})
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {entry.connections.slice(0, 10).map(conn => {
            const target = graphIndex!.index[conn.noteId];
            if (!target) return null;
            return (
              <div
                key={conn.noteId}
                onClick={() => selectNode(conn.noteId)}
                style={{
                  padding: '6px 8px',
                  background: 'rgba(255,255,255,0.04)',
                  borderRadius: 6,
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  borderLeft: `2px solid ${DOMAIN_COLORS[target.domain] ?? '#6B7280'}`,
                }}
                title={target.title}
              >
                {target.title}
                <span style={{ color: 'var(--text-muted)', marginLeft: 6, fontSize: 11 }}>
                  {Math.round(conn.score * 100)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}

const DOMAIN_COLORS: Record<string, string> = {
  'AI 核心技术与模型':   '#2563EB',
  'AI 产业生态与巨头':  '#7C3AED',
  'AI 智能体与工程':    '#00F5FF',
  '管理、职场与个人成长': '#D97706',
  '行业应用与生活闲谈': '#DB2777',
  '企业数字化与数据治理': '#0284C7',
  '社会、安全与伦理':  '#7C22CE',
  '其他':               '#6B7280',
};
```

- [ ] **Step 1: 覆盖 web/components/panels/RightPanel.tsx**
- [ ] **Step 2: 提交**

```bash
git add web/components/panels/RightPanel.tsx
git commit -m "feat(phase5): complete RightPanel with Markdown rendering and AI summary

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 4: 构建验证

- [ ] **Step 1: 构建**

```bash
cd /Users/zhengyan/Projects/ai-project/my-getnote-kg/.worktrees/phase2/web
npm run build 2>&1
```

Expected: 成功。如果 TypeScript 报错，报告错误内容并修复。

- [ ] **Step 2: dev server 验证**

```bash
cd /Users/zhengyan/Projects/ai-project/my-getnote-kg/.worktrees/phase2/web
npm run dev &
sleep 8
curl -s http://localhost:3000/graph | grep -c 'Memex\|知识\|导航' || echo "page loaded"
pkill -f "next dev" 2>/dev/null; echo "done"
```

- [ ] **Step 3: 提交全部变更**

```bash
cd /Users/zhengyan/Projects/ai-project/my-getnote-kg/.worktrees/phase2
git add web/
git commit -m "feat(phase5): complete LeftNav + RightPanel with AI summary and Markdown rendering

Phase 5 complete - full three-column interaction ready.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## 验收清单

- [ ] 左侧导航栏显示领域列表，点击筛选图谱
- [ ] 点击笔记节点 → 右侧面板展开
- [ ] 右侧面板加载笔记 Markdown 正文（react-markdown 渲染）
- [ ] AI 摘要按钮可调用（需配置 OPENAI_API_KEY）
- [ ] 关联笔记点击可跳转
- [ ] `npm run build` 成功
