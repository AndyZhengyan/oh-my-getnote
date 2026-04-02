// tools/markdown.ts
import * as path from 'path';

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
  imageRefs: string[];
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\s+/g, ' ')
    .trim();
}

export function convertHtmlToMarkdown(
  html: string,
  id: string,
): ConvertResult | null {
  // Title
  const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  const title = titleMatch ? stripHtml(titleMatch[1]).trim() : '';
  if (!title) return null;

  // Tags
  const tagMatches = [...html.matchAll(/<span class="tag"[^>]*>([\s\S]*?)<\/span>/gi)];
  let tags: string[] = tagMatches
    .map(m => stripHtml(m[1]).trim())
    .filter(t => t.length > 0 && t !== 'null');
  const type = tags[0] || '其他';
  // 无标签时，tags 也包含 type
  if (tags.length === 0) tags = [type];

  // Date
  let date = '';
  const dateMatch = html.match(/创建于[：:]\s*(\d{4}-\d{2}-\d{2})/);
  if (dateMatch) date = dateMatch[1];

  // Body: split at <hr>, strip noise
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

  // Image refs
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
      domain: '',
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

  if (result.imageRefs.length > 0) {
    lines.push('');
    for (const ref of result.imageRefs) {
      const fname = path.basename(ref);
      lines.push(`![](images/${fm.id}/${fname})`);
    }
  }

  return lines.join('\n');
}
