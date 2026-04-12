#!/usr/bin/env node
// tools/convert.ts
// 统一入口：扫描 tags + 转换为 Markdown + graph-index.json
//
// 用法:
//   npx tsx tools/convert.ts <source-dir>            扫描（需时）+ 转换（全流程）
//   npx tsx tools/convert.ts <source-dir> --scan     仅扫描 tags，生成/更新 tag-tree.yaml
//   npx tsx tools/convert.ts <source-dir> --force    强制重新扫描（重置 yaml 中已填的 l1/l2）

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import yaml from 'js-yaml';
import OpenAI from 'openai';
import { parseHtmlFile } from '../dist/parser/index.js';
import { buildNoteConnections } from '../web/lib/linker/semantic.js';
import { convertHtmlToMarkdown, buildMarkdownString } from '../web/tools/markdown.js';
import { buildGraphIndex } from '../web/tools/indexer.js';
import { storeNote, noteExists } from '../lib/lancedb.js';
import { embedText } from '../lib/embedding.js';

// ---------------------------------------------------------------------------
// Tag scanning — AI-powered tree generation
// ---------------------------------------------------------------------------

const FIXED_TYPES = ['图片笔记', '录音笔记', '链接笔记', '录音卡笔记', '文字笔记', 'AI链接笔记'];

function extractTags(html: string): string[] {
  const matches = [...html.matchAll(/<span class=["']tag["'][^>]*>([\s\S]*?)<\/span>/gi)];
  return matches
    .map(m => m[1].replace(/<[^>]+>/g, '').trim())
    .filter(t => t.length > 0 && t.toLowerCase() !== 'null');
}

// Two-phase tag classification:
// Phase 1: Design L1 names only (no tags) — 8 L1 buckets
// Phase 2: For each L1, create L2 names, then batch-distribute all tags
async function generateTagTree(tagList: string[]): Promise<Record<string, string | Record<string, string[]>>> {
  const openai = new OpenAI({ baseURL: process.env.OPENAI_BASE_URL, apiKey: process.env.OPENAI_API_KEY });

  // ── Phase 1: Design L1 + L2 names only (no tags) ─────────────────────────
  const SAMPLE_SIZE = 200;
  const step = Math.max(1, Math.floor(tagList.length / SAMPLE_SIZE));
  const sampled = Array.from({ length: SAMPLE_SIZE }, (_, i) => tagList[Math.min(i * step, tagList.length - 1)]);
  const sampleBlock = sampled.map(t => `  - "${t}"`).join('\n');

  console.log(`🤖 [Phase 1] 设计 L1/L2 结构...`);
  const phase1Resp = await openai.chat.completions.create({
    model: 'google/gemini-3-flash-preview',
    messages: [
      { role: 'system', content: '只输出纯 JSON，不要 markdown 块。L1 最多 8 个，每个 L1 下 L2 最多 8 个。"其他"放最后。所有 L3 先留空 []。' },
      { role: 'user', content: `抽样标签（仅供参考）：\n${sampleBlock}\n\n请设计最多 8 个顶层分类（L1），每个 L1 下设 3-8 个 L2 子类，所有 L3 先留空 []：` },
    ],
    temperature: 0.4,
    max_tokens: 2048,
  });

  let phase1Text = (phase1Resp.choices[0]?.message?.content ?? '{}').replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  let tree: Record<string, string | Record<string, string[]>>;
  try {
    tree = JSON.parse(phase1Text);
  } catch {
    tree = {};
  }

  // Ensure at least some L1s exist
  if (Object.keys(tree).length === 0) {
    tree = { "AI": { "通用": [] }, "其他": [] };
  }

  const l1Keys = Object.keys(tree).filter(k => k !== '其他');
  console.log(`🤖 Phase 1 完成：${l1Keys.length} 个 L1 → ${Object.keys(tree).length} 总`);

  // ── Phase 2: For each L1, create L2 names, then batch distribute all tags ──
  const assigned = new Set<string>();
  const BATCH = 250;

  for (const l1 of l1Keys) {
    const children = tree[l1];
    const existingL2Keys: string[] = [];
    if (!Array.isArray(children) && typeof children === 'object' && children !== null) {
      existingL2Keys.push(...Object.keys(children));
    }

    // Step A: If L2 not created yet, create L2 names from ~300 remaining tags
    if (existingL2Keys.length === 0) {
      console.log(`🤖 [${l1}] 创建 L2 结构...`);
      const rem1 = tagList.filter(t => !assigned.has(t));
      const rem1Block = rem1.slice(0, 300).map(t => `  - "${t}"`).join('\n');

      const l2Resp = await openai.chat.completions.create({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: '只输出纯 JSON，不要 markdown 块，不得遗漏任何一个标签。' },
          { role: 'user', content: `L1="${l1}"，请从以下未分类标签设计最多 8 个 L2 子类，将适合的标签填入各 L2 的 L3 列表。\n约束：L2 最多 8 个，不得遗漏任何一个标签。\n\n未分类标签：\n${rem1Block}` },
        ],
        temperature: 0.3,
        max_tokens: 8192,
      });

      let l2Text = (l2Resp.choices[0]?.message?.content ?? '{}').replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      try {
        const l2structure = JSON.parse(l2Text) as Record<string, string[]>;
        tree[l1] = l2structure;
        existingL2Keys.push(...Object.keys(l2structure));
        for (const v of Object.values(l2structure)) {
          if (Array.isArray(v)) v.forEach((t: string) => assigned.add(t));
        }
      } catch { /* skip */ }
    }

    // Step B: Distribute remaining tags into existing L2 buckets, batch by batch
    let round = 0;
    while (round < 5) {
      round++;
      const remaining = tagList.filter(t => !assigned.has(t));
      if (remaining.length === 0) break;

      const batch = remaining.slice(0, BATCH);
      const l2Desc = existingL2Keys.map(l2 => `  - ${l2}`).join('\n');
      const batchBlock = batch.map(t => `  - "${t}"`).join('\n');

      console.log(`🤖 [${l1}] 分发（剩余 ${remaining.length}，批 ${round}）...`);
      const distResp = await openai.chat.completions.create({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: '只输出纯 JSON，不要 markdown 块，不得遗漏任何一个标签。' },
          { role: 'user', content: `L1="${l1}"，已有 L2：\n${l2Desc}\n\n将以下标签分配到最合适的 L2 下作为 L3（不得新建 L2/L3，不得遗漏任何一个）：\n${batchBlock}\n\n输出：{ "标签名": "L2名" }` },
        ],
        temperature: 0.3,
        max_tokens: 4096,
      });

      let respText = (distResp.choices[0]?.message?.content ?? '{}').replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      let added = 0;
      try {
        const mappings = JSON.parse(respText) as Record<string, string>;
        // Rebuild l2Keys in case they were added in Step A
        const l2Children = tree[l1] as Record<string, string[]>;
        if (l2Children) {
          for (const [tag, l2] of Object.entries(mappings)) {
            if (!tag || !l2 || !l2Children[l2] || !tagList.includes(tag)) continue;
            if (!l2Children[l2].includes(tag)) { l2Children[l2].push(tag); added++; }
            assigned.add(tag);
          }
        }
      } catch { /* skip */ }
      if (added === 0) break;
    }
  }

  // ── Final: remaining → 其他 ────────────────────────────────────────────────
  const leftover = tagList.filter(t => !assigned.has(t));
  tree['其他'] = leftover;

  // Ensure 其他 last
  const result: Record<string, string | Record<string, string[]>> = {};
  for (const [k, v] of Object.entries(tree)) {
    if (k !== '其他') result[k] = v;
  }
  result['其他'] = leftover;

  return result;
}

async function scanTags(sourceDir: string, outDir: string, force = false): Promise<void> {
  const notesDir = fs.existsSync(path.join(sourceDir, 'notes'))
    ? path.join(sourceDir, 'notes')
    : sourceDir;

  const files = fs.readdirSync(notesDir).filter(f => f.endsWith('.html'));
  const tagSet = new Set<string>();
  for (const file of files) {
    const html = fs.readFileSync(path.join(notesDir, file), 'utf-8');
    for (const tag of extractTags(html)) tagSet.add(tag);
  }
  const tagList = Array.from(tagSet).sort();
  console.log(`🔍 扫描 tags: 发现 ${tagList.length} 个不同标签`);

  const configPath = path.resolve(outDir, 'notes/tag-tree.yaml');

  console.log(`🤖 调用 AI 生成 tag 分类树...`);
  const tree = await generateTagTree(tagList);

  const doc = {
    '# 笔记类型（叶子）': null,
    types: FIXED_TYPES,
    '# 分类树（每次 convert 自动重新生成）': null,
    tree,
  };

  const clean = Object.fromEntries(Object.entries(doc).filter(([, v]) => v !== null));
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, yaml.dump(clean, { forceQuotes: false, quotingType: '"', lineWidth: -1 }), 'utf-8');
  console.log(`✅ tag-tree.yaml 已写入 ${configPath}`);
}

// Note shape returned by dist/parser/index.js
interface Note {
  id: string;
  title: string;
  tags: string[];
  contentSnippet?: string;
  date?: string;
  filename: string;
}

function copyImages(
  html: string,
  sourceNotesDir: string,
  targetImageDir: string,
): void {
  fs.mkdirSync(targetImageDir, { recursive: true });
  const imgMatches = [...html.matchAll(/src=["']([^"']+)["']/gi)];
  for (const m of imgMatches) {
    const src = m[1];
    if (/\.(jpg|jpeg|png|gif|webp)$/i.test(src) && !src.startsWith('http')) {
      const srcPath = path.join(sourceNotesDir, src);
      if (fs.existsSync(srcPath)) {
        const fname = path.basename(srcPath);
        try {
          fs.copyFileSync(srcPath, path.join(targetImageDir, fname));
        } catch {
          // 单个图片复制失败不影响整体流程
        }
      }
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('用法: npx tsx tools/convert.ts <source-dir> [--out <output-dir>] [--scan] [--force]');
    console.error('  --scan  仅扫描 tags，生成/更新 tag-tree.yaml');
    console.error('  --force 强制覆盖现有 Markdown，或强制重新扫描（重置 yaml l1/l2）');
    console.error('  --out   指定输出目录（默认 .）');
    process.exit(1);
  }

  const sourceDir = args[0];
  const outFlagIdx = args.indexOf('--out');
  const outDir = outFlagIdx >= 0 ? args[outFlagIdx + 1] : '.';
  const scanOnly = args.includes('--scan');
  const force = args.includes('--force');

  // --scan mode: only run tag scanner
  if (scanOnly) {
    await scanTags(sourceDir, outDir, force);
    return;
  }

  // Auto-scan if yaml is missing
  const configPath = path.resolve(outDir, 'notes/tag-tree.yaml');
  if (!fs.existsSync(configPath)) {
    console.log('⚠️  tag-tree.yaml 不存在，先扫描 tags...');
    await scanTags(sourceDir, outDir, false);
  }

  // 如果 sourceDir 下有 notes/ 目录，使用它；否则直接使用 sourceDir
  let notesDir = path.join(sourceDir, 'notes');
  if (!fs.existsSync(notesDir)) {
    notesDir = sourceDir;
  }

  const notesOutDir = path.join(outDir, 'notes');
  const imagesOutDir = path.join(outDir, 'images');
  fs.mkdirSync(notesOutDir, { recursive: true });
  fs.mkdirSync(imagesOutDir, { recursive: true });

  // 1. 解析所有 HTML
  console.log('📖 解析 HTML 文件...');
  const htmlFiles = fs.readdirSync(notesDir).filter(f => f.endsWith('.html'));

  if (htmlFiles.length === 0) {
    console.error('错误：在 ' + notesDir + ' 中未找到 HTML 文件。');
    process.exit(1);
  }

  const notes: Note[] = [];
  for (const file of htmlFiles) {
    const note = parseHtmlFile(path.join(notesDir, file));
    if (note) notes.push(note);
  }
  console.log('   解析完成：' + notes.length + ' 篇笔记');

  // 2. HTML→Markdown 转换
  console.log('📝 转换为 Markdown...');
  const metadataMap = new Map();

  for (const note of notes) {
    const htmlPath = path.join(notesDir, note.id + '.html');
    const html = fs.readFileSync(htmlPath, 'utf-8');

    // 复制图片
    const noteImageDir = path.join(imagesOutDir, note.id);
    copyImages(html, notesDir, noteImageDir);

    const result = convertHtmlToMarkdown(html, note.id);
    if (!result) continue;

    // 幂等性：写入 Markdown 时，将 frontmatter 加入 metadataMap（无论文件是否已存在）
    metadataMap.set(note.id, result.frontmatter);

    // 写入 Markdown
    const typeDir = path.join(notesOutDir, result.frontmatter.type);
    fs.mkdirSync(typeDir, { recursive: true });
    const mdPath = path.join(typeDir, note.id + '.md');
    if (!fs.existsSync(mdPath) || force) {
      const mdContent = buildMarkdownString(result);
      fs.writeFileSync(mdPath, '\uFEFF' + mdContent, 'utf8');
    }
  }
  console.log('   转换完成：' + metadataMap.size + ' 篇 Markdown');

  // 3. 语义关联计算（跳过单个笔记或用户禁用）
  if (notes.length > 1) {
    console.log('🔗 计算语义关联...');
    const { connections, embeddings } = await buildNoteConnections(notes, 0.5, 8, true);
    for (const [noteId, conns] of connections) {
      const meta = metadataMap.get(noteId);
      if (meta) {
        meta.connections = conns.map(c => ({
          noteId: c.noteId,
          score: c.score,
          type: 'semantic',
        }));
      }
    }
    console.log('   关联计算完成');

    // 4. 重新生成 Markdown（写入关联数据）
    console.log('📝 更新 Markdown 关联数据...');
    for (const [noteId, meta] of metadataMap) {
      const mdPath = path.join(notesOutDir, meta.type, noteId + '.md');
      if (fs.existsSync(mdPath)) {
        const existing = fs.readFileSync(mdPath, 'utf8');
        const bodyStart = existing.indexOf('\n---\n', 4);
        if (bodyStart >= 0) {
          const body = existing.slice(bodyStart + 5).trim();
          const newMd = buildMarkdownString({ frontmatter: meta, body, imageRefs: [] });
          fs.writeFileSync(mdPath, '\uFEFF' + newMd, 'utf8');
        }
      }
    }
  }

  // 5. 生成 graph-index.json（幂等）
  const indexPath = path.join(outDir, 'graph-index.json');
  console.log('🗂  生成 graph-index.json...');
  const entries = Array.from(metadataMap.entries()).map(([id, meta]) => ({
    id,
    path: 'notes/' + meta.type + '/' + id + '.md',
    type: meta.type,
    title: meta.title,
    tagTree: meta.tagTree,
    connections: meta.connections,
  }));
  const graphIndex = buildGraphIndex(entries, path.basename(sourceDir));
  fs.writeFileSync(indexPath, JSON.stringify(graphIndex, null, 2), 'utf8');

  // 6. 写入 LanceDB（幂等）
  console.log('📚 写入 LanceDB 向量存储...');
  let stored = 0;
  for (const note of notes) {
    const exists = await noteExists(note.id);
    if (exists) continue;
    const text = (note.title + ' ' + (note.contentSnippet || '')).trim();
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
  console.log('   LanceDB 新写入：' + stored + ' 篇');

  console.log('✅ 完成！');
  console.log('   笔记：' + graphIndex.stats.total_notes + ' 篇');
  console.log('   关联：' + graphIndex.stats.total_connections + ' 条');
}

// Guard: only run main() when executed directly as CLI
if (process.argv[1] && process.argv[1].endsWith('convert.ts')) {
  main().catch(err => {
    console.error('转换失败:', err);
    process.exit(1);
  });
}
