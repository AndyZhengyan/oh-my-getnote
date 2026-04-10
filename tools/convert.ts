#!/usr/bin/env node
// tools/convert.ts
// 将 Get笔记 HTML 导出转换为 Markdown + graph-index.json

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { parseHtmlFile } from '../dist/parser/index.js';
import { buildNoteConnections } from '../dist/linker/semantic.js';
import { projectTo2D } from '../dist/linker/projector.js';
import { Note } from '../dist/types.js';
import { convertHtmlToMarkdown, buildMarkdownString } from '../web/tools/markdown.js';
import { buildGraphIndex, NoteIndexEntry } from '../web/tools/indexer.js';
import { NoteMetadata } from '../web/tools/markdown.js';

import { storeNote, noteExists } from '../lib/lancedb.js';
import { embedText } from '../lib/embedding.js';

export function inferDomain(tags: string[]): string {
  const tagStr = tags.join('');
  if (tagStr.includes('LLM') || tagStr.includes('GPT')) {
    return 'AI 核心技术与模型';
  }
  if (tagStr.includes('智能体') || tagStr.includes('Agent')) {
    return 'AI 智能体与工程';
  }
  if (tagStr.includes('管理') || tagStr.includes('职场') || tagStr.includes('成长')) {
    return '管理、职场与个人成长';
  }
  if (tagStr.includes('AI')) {
    return 'AI 核心技术与模型';
  }
  return '其他';
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
    // 只复制本地文件（相对路径），跳过 http URL
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
    console.error('用法: npx tsx tools/convert.ts <source-dir> [--out <output-dir>] [--force]');
    console.error('  --out   指定输出目录（默认 .）');
    console.error('  --force 强制覆盖现有 Markdown 文件的 body 内容（默认跳过，只更新 frontmatter）');
    process.exit(1);
  }

  const sourceDir = args[0];
  const outFlagIdx = args.indexOf('--out');
  const outDir = outFlagIdx >= 0 ? args[outFlagIdx + 1] : '.';
  const force = args.includes('--force');

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
    console.error(`错误：在 ${notesDir} 中未找到 HTML 文件。`);
    process.exit(1);
  }

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

    // 复制图片
    const noteImageDir = path.join(imagesOutDir, note.id);
    copyImages(html, notesDir, noteImageDir);

    const result = convertHtmlToMarkdown(html, note.id);
    if (!result) continue;

    // 推断领域
    result.frontmatter.domain = inferDomain(note.tags);

    // 幂等性：写入 Markdown 时，将 frontmatter 加入 metadataMap（无论文件是否已存在）
    metadataMap.set(note.id, result.frontmatter);

    // 写入 Markdown
    //   默认模式：跳过已存在的文件（保护用户对 body 的手动编辑，只更新 frontmatter）
    //   --force 模式：强制覆盖 body（converter 本身有 bug 修复时需要）
    const typeDir = path.join(notesOutDir, result.frontmatter.type);
    fs.mkdirSync(typeDir, { recursive: true });
    const mdPath = path.join(typeDir, `${note.id}.md`);
    if (!fs.existsSync(mdPath) || force) {
      const mdContent = buildMarkdownString(result);
      fs.writeFileSync(mdPath, '\uFEFF' + mdContent, 'utf8');
    }
  }
  console.log(`   转换完成：${metadataMap.size} 篇 Markdown`);

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
          type: 'semantic' as const,
        }));
      }
    }
    console.log(`   关联计算完成`);

    // 4. PCA 降维（复用 buildNoteConnections 已计算的 embeddings）
    console.log('📐 PCA 降维...');
    const ids = notes.map(n => n.id);
    const vectors = ids.map(id => embeddings.get(id) || new Array(768).fill(0));
    const coords = projectTo2D(vectors);
    for (let i = 0; i < ids.length; i++) {
      const meta = metadataMap.get(ids[i]);
      if (meta) {
        meta.x = coords[i][0];
        meta.y = coords[i][1];
      }
    }
    console.log('   PCA 降维完成');

    // 重新生成 Markdown（写入关联数据）
    console.log('📝 更新 Markdown 关联数据...');
    for (const [noteId, meta] of metadataMap) {
      const mdPath = path.join(notesOutDir, meta.type, `${noteId}.md`);
      if (fs.existsSync(mdPath)) {
        // 读取已有文件内容替换 frontmatter 部分
        const existing = fs.readFileSync(mdPath, 'utf8');
        const bodyStart = existing.indexOf('\n---\n', 4); // 第二个 --- 之后是 body
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
  console.log('🗂️  生成 graph-index.json...');
  const entries: NoteIndexEntry[] = Array.from(metadataMap.entries()).map(([id, meta]) => ({
    id,
    path: `notes/${meta.type}/${id}.md`,
    domain: meta.domain,
    type: meta.type,
    title: meta.title,
    connections: meta.connections,
  }));
  const graphIndex = buildGraphIndex(entries, path.basename(sourceDir));
  fs.writeFileSync(indexPath, JSON.stringify(graphIndex, null, 2), 'utf8');

  // 6. Incremental LanceDB write (idempotent)
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

  console.log(`✅ 完成！`);
  console.log(`   笔记：${graphIndex.stats.total_notes} 篇`);
  console.log(`   关联：${graphIndex.stats.total_connections} 条`);
  console.log(`   领域：${graphIndex.domains.join(', ')}`);
}

// Guard: only run main() when executed directly as CLI, not imported by tests/vitest
if (import.meta.url === `file://${process.argv[1]}`.replace(/\\/g, '/')) {
  main().catch(err => {
    console.error('转换失败:', err);
    process.exit(1);
  });
}
