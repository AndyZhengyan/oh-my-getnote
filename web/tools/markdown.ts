// tools/markdown.ts
import TurndownService from 'turndown';
import * as fs from 'fs';
import * as path from 'path';
import yaml from 'js-yaml';

export interface NoteMetadata {
  id: string;
  title: string;
  date: string;
  type: string;
  tags: string[];
  tagTree: string[]; // e.g. ['AI · 模型技术 › 推理模型 › o1模型']
  domain: string;
  connections: Array<{ noteId: string; score: number; type: 'semantic' | 'explicit' }>;
  ai_summary?: string;
}

// ---------------------------------------------------------------------------
// Tag tree loader — reads web/config/tag-tree.yaml
// Structure:
//   types: [图片笔记, 录音笔记, ...]          (fixed, not used here)
//   tags:
// ---------------------------------------------------------------------------
// Config format (notes/tag-tree.yaml):
//   types: [图片笔记, 录音笔记, ...]
//   tree:
//     AI · 模型技术:
//       模型基础: [大语言模型, 强化学习]
//       推理模型: [o1模型, DeepSeek - R1]
//     AI · 人物: [Sam Altman, Andrej Karpathy]
//     其他: null
// ---------------------------------------------------------------------------

let _tagPathMap: Map<string, string[]> | null = null;

function loadTagPaths(): Map<string, string[]> {
  if (_tagPathMap) return _tagPathMap;

  _tagPathMap = new Map();
  const configPath = path.resolve('notes/tag-tree.yaml');

  if (!fs.existsSync(configPath)) return _tagPathMap;

  const doc = yaml.load(fs.readFileSync(configPath, 'utf-8')) as Record<string, unknown>;
  const tree = doc.tree as Record<string, string | Record<string, string[]> | null> ?? {};

  for (const [l1, children] of Object.entries(tree)) {
    if (children === null) {
      _tagPathMap.set(l1, [l1]);
      continue;
    }
    if (Array.isArray(children)) {
      for (const tag of children) _tagPathMap.set(tag, [l1, tag]);
      continue;
    }
    for (const [l2, l3tags] of Object.entries(children)) {
      for (const tag of l3tags) _tagPathMap.set(tag, [l1, l2, tag]);
    }
  }

  return _tagPathMap;
}

/**
 * Map a raw tag to its tree path string (e.g. "AI · 模型技术 › 推理模型 › o1模型").
 * Unknown tags fall under "其他 › <tag>".
 */
function tagToPath(rawTag: string): string[] {
  const tagMap = loadTagPaths();
  return tagMap.get(rawTag) ?? ['其他', rawTag];
}

/** Normalize raw tags into sorted tree path strings. */
export function normalizeTags(rawTags: string[]): { tags: string[]; tagTree: string[] } {
  const pathSet = new Set<string>();
  for (const raw of rawTags) {
    pathSet.add(tagToPath(raw).join(' › '));
  }
  return { tags: rawTags, tagTree: Array.from(pathSet).sort() };
}

export interface ConvertResult {
  frontmatter: NoteMetadata;
  body: string;
  imageRefs: string[];
  _inlineImages?: string[];
}

const turndownService = new TurndownService({
  headingStyle: 'atx',
  hr: '---',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  emDelimiter: '*'
});

// Use custom escape to potentially be more lenient with valid markdown content
turndownService.escape = (text) => text;

// ---------------------------------------------------------------------------
// HTML entity decoding
// ---------------------------------------------------------------------------
function decodeEntities(str: string): string {
  return str
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/** Strip all HTML tags from text */
function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')).trim();
}

/** Convert an HTML snippet to Markdown lines */
function htmlToMd(html: string): string[] {
  if (!html) return [];
  const md = turndownService.turndown(html);
  return md.split('\n');
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function convertHtmlToMarkdown(
  html: string,
  id: string,
): ConvertResult | null {
  // Title
  const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const title = titleMatch ? stripTags(titleMatch[1]).trim() : '';
  if (!title) return null;

  // Tags
  const tagMatches = [...html.matchAll(/<span class=["']tag["'][^>]*>([\s\S]*?)<\/span>/gi)];
  let tags: string[] = tagMatches
    .map(m => stripTags(m[1]).trim())
    .filter(t => t.length > 0 && !t.toLowerCase().includes('null'));
  // Known explicit note-type labels (from the filter sidebar UI)
  const EXPLICIT_TYPES = new Set(['图片笔记', '录音笔记', '链接笔记', '录音卡笔记']);
  const rawType = tags[0];
  const type = rawType && !EXPLICIT_TYPES.has(rawType) ? '文字笔记' : (rawType || '文字笔记');
  if (tags.length === 0) tags = [type];

  // Normalize tags into tree paths
  const { tags: rawTags, tagTree } = normalizeTags(tags);

  // Date
  let date = '';
  const dateMatch = html.match(/创建于[：:]\s*(\d{4}-\d{2}-\d{2})/);
  if (dateMatch) date = dateMatch[1];

  // Body: extract content after <hr>
  const lastHrIdx = html.lastIndexOf('<hr');
  const afterHtml = lastHrIdx >= 0 ? html.slice(lastHrIdx) : html;
  const cleanAfter = afterHtml
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<div[^>]*id\s*=["']?jsonData["']?[^>]*>[\s\S]*?<\/div>/gi, '')
    .replace(/<audio[\s\S]*?<\/audio>/gi, '')
    .replace(/<source[\s\S]*?\/?>/gi, '');

  // Remove the title <h1> from body if it appears
  const bodyHtml = cleanAfter
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/(<div[^>]*>)\s*<h1[^>]*>[\s\S]*?<\/h1>/gi, '$1')
    .replace(/<p>\s*<h1[^>]*>[\s\S]*?<\/h1>\s*<\/p>/gi, '')
    .replace(/<div[^>]*class=["']note["'][^>]*>/gi, '')
    .replace(/<div[^>]*class=["']note-container["'][^>]*>/gi, '');

  // Extract "原文：" link if present
  const attachmentMatch = bodyHtml.match(/<div class=["']attachment["'][^>]*>([\s\S]*?)<\/div>/i);
  let attachmentLine = '';
  if (attachmentMatch) {
    const linkMatch = attachmentMatch[1].match(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
    if (linkMatch) {
      const href = linkMatch[1];
      const label = stripTags(linkMatch[2]).trim();
      attachmentLine = `原文：[${label}](${href})`;
    }
  }

  // Strip attachment div from body
  const bodyWithoutAttachment = bodyHtml
    .replace(/<div[^>]*class=["']attachment["'][^>]*>[\s\S]*?<\/div>/gi, '')
    .trim();

  // Convert HTML to Markdown lines via turndown
  const rawLines = htmlToMd(bodyWithoutAttachment);

  // Build body: attachment + non-empty lines, collapsed double blank lines
  const bodyLines: string[] = [];
  if (attachmentLine) bodyLines.push(attachmentLine);
  if (rawLines.length > 0) bodyLines.push('');

  let lastWasBlank = false;
  for (const line of rawLines) {
    const trimmed = line.trim();
    if (trimmed === '') {
      if (!lastWasBlank) bodyLines.push('');
      lastWasBlank = true;
    } else if (trimmed === '---') {
      // Skip <hr>
    } else {
      bodyLines.push(line);
      lastWasBlank = false;
    }
  }
  while (bodyLines.length > 0 && bodyLines[0].trim() === '') bodyLines.shift();
  while (bodyLines.length > 0 && bodyLines[bodyLines.length - 1].trim() === '') bodyLines.pop();

  // Image refs
  const imgMatches = [...html.matchAll(/src=["']([^"']+)["']/gi)];
  const imageRefs: string[] = [];
  for (const m of imgMatches) {
    const src = m[1];
    if (/\.(jpg|jpeg|png|gif|webp)$/i.test(src)) imageRefs.push(src);
  }

  const inlineImages: string[] = [];
  for (const img of imageRefs) {
    inlineImages.push(`![](${img})`, '');
  }
  if (inlineImages.length > 0) bodyLines.unshift(...inlineImages);

  // Mermaid
  const processedLines: string[] = [];
  let i = 0;
  while (i < bodyLines.length) {
    const line = bodyLines[i];
    if (line.includes('`mermaid')) {
      const openMatch = line.match(/^(.*?)`mermaid([\s\S]*?)`(.*)$/);
      if (openMatch) {
        const prefix = openMatch[1]?.trim() ?? '';
        const codeContent = openMatch[2] ?? '';
        const suffix = openMatch[3]?.trim() ?? '';
        if (prefix) processedLines.push(prefix);
        const blockLines = [codeContent];
        let j = i + 1;
        let foundClose = false;
        while (j < bodyLines.length) {
          const nextLine = bodyLines[j];
          if (nextLine.includes('`') && !nextLine.startsWith(' ')) {
            const closeIdx = nextLine.indexOf('`');
            blockLines.push(nextLine.slice(0, closeIdx));
            const afterClose = nextLine.slice(closeIdx + 1).trim();
            if (afterClose) processedLines.push(afterClose);
            foundClose = true;
            j++;
            break;
          } else {
            blockLines.push(nextLine);
            j++;
          }
        }
        if (!foundClose) {
          for (const bl of blockLines) processedLines.push(bl);
        } else {
          processedLines.push('```mermaid');
          for (const bl of blockLines) if (bl.trim()) processedLines.push(bl);
          processedLines.push('```');
        }
        i = j;
        continue;
      }
    }
    processedLines.push(line);
    i++;
  }
  const body = processedLines.join('\n');

  return {
    frontmatter: { id, title, date, type, tags, tagTree, domain: '', connections: [] },
    body,
    imageRefs,
    _inlineImages: inlineImages,
  };
}

export function buildMarkdownString(result: ConvertResult): string {
  const fm = result.frontmatter;
  const lines: string[] = ['---'];
  lines.push(`id: "${fm.id}"`);
  lines.push(`title: "${fm.title.replace(/"/g, '\\"')}"`);
  lines.push(`type: "${fm.type}"`);
  lines.push(`tags: [${fm.tags.map(t => `"${t.replace(/"/g, '\\"')}"`).join(', ')}]`);
  if (fm.tagTree.length > 0) {
    lines.push(`tagTree: [${fm.tagTree.map(t => `"${t.replace(/"/g, '\\"')}"`).join(', ')}]`);
  }
  if (fm.domain) lines.push(`domain: "${fm.domain}"`);
  if (fm.date) lines.push(`date: "${fm.date}"`);
  if (fm.connections.length > 0) {
    lines.push('connections:');
    for (const c of fm.connections) {
      lines.push(`  - noteId: "${c.noteId}"`);
      lines.push(`    score: ${c.score}`);
      lines.push(`    type: "${c.type}"`);
    }
  }
  if (fm.ai_summary) {
    lines.push('ai_summary: |');
    for (const line of fm.ai_summary.split('\n')) lines.push(`  ${line}`);
  }
  lines.push('---', '', result.body);
  return lines.join('\n');
}
