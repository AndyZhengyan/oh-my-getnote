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
    .replace(/&ldquo;/gi, '\u201c')
    .replace(/&rdquo;/gi, '\u201d')
    .replace(/&lsquo;/gi, '\u2018')
    .replace(/&rsquo;/gi, '\u2019')
    .replace(/&mdash;/gi, '\u2014')
    .replace(/&ndash;/gi, '\u2013')
    .replace(/&hellip;/gi, '\u2026')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

interface TokenText { type: 'text'; content: string }
interface TokenTag  { type: 'tag'; full: string; name: string; selfClosing: boolean; closing: boolean }
type Token = TokenText | TokenTag;

function tokenise(raw: string): Token[] {
  const tokens: Token[] = [];
  let remaining = raw;
  while (remaining.length > 0) {
    const ltIdx = remaining.indexOf('<');
    if (ltIdx === -1) {
      if (remaining.trim()) tokens.push({ type: 'text', content: remaining });
      break;
    }
    if (ltIdx > 0) {
      const txt = remaining.slice(0, ltIdx);
      if (txt.trim()) tokens.push({ type: 'text', content: txt });
    }
    const gtIdx = remaining.indexOf('>', ltIdx);
    if (gtIdx === -1) break;
    const full = remaining.slice(ltIdx, gtIdx + 1);
    const inner = full.slice(1, -1);
    const nm = inner.match(/^\/?([a-zA-Z0-9\-]+)/);
    tokens.push({
      type: 'tag', full,
      name: nm ? nm[1].toLowerCase() : '',
      closing: inner.startsWith('/'),
      selfClosing: inner.endsWith('/') || ['br', 'hr', 'img', 'input', 'source', 'meta', 'link'].includes(nm?.[1]?.toLowerCase() || ''),
    });
    remaining = remaining.slice(gtIdx + 1);
  }
  return tokens;
}

function findCloseIdx(tokens: Token[], openIdx: number, tagName: string): number {
  let depth = 0;
  for (let i = openIdx; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type !== 'tag') continue;
    if (t.name === tagName && !t.closing && !t.selfClosing) depth++;
    if (t.name === tagName && t.closing) { depth--; if (depth <= 0) return i; }
  }
  return tokens.length;
}

function stripInline(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?[a-zA-Z][^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(parseInt(c)))
    .replace(/[ \t]+/g, ' ')
    .replace(/^[ \t]+/, '').replace(/[ \t]+$/, '')
    .trim();
}

// ---------------------------------------------------------------------------
// Inline element processing
// ---------------------------------------------------------------------------
function inlineHtml(html: string): string {
  // Links
  html = html.replace(/<a[^>]+href=(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi,
    (_m, _q, href, label) => `[${stripInline(label)}](${href})`);
  // Bold+italic nested
  html = html.replace(/<(strong|b)[^>]*>\s*<(em|i)[^>]*>([\s\S]*?)<\/\2>\s*<\/\1>/gi,
    (_m, _o, _i, c) => `***${c}***`);
  html = html.replace(/<(em|i)[^>]*>\s*<(strong|b)[^>]*>([\s\S]*?)<\/\2>\s*<\/\1>/gi,
    (_m, _o, _i, c) => `***${c}***`);
  // Bold
  html = html.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi,
    (_m, _t, c) => `**${c}**`);
  // Italic
  html = html.replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi,
    (_m, _t, c) => `*${c}*`);
  // br, strip remaining tags, decode
  html = html.replace(/<br\s*\/?>/gi, '\n');
  html = html.replace(/<\/?[a-zA-Z][^>]*>/g, ' ');
  html = decodeEntities(html);
  html = html.replace(/[ \t]+/g, ' ').replace(/^[ \t]+/gm, '').replace(/[ \t]+$/gm, '');
  html = html.replace(/\n\s+/g, '\n').replace(/\s+\n/g, '\n');
  return html.trim();
}

// ---------------------------------------------------------------------------
// List processing using token-level approach (avoids regex nesting issues)
// ---------------------------------------------------------------------------

/** Extract inline text from a token array, ignoring block-level children but keeping inline tags. */
function tokensToInline(tokens: Token[]): string {
  let html = '';
  for (const t of tokens) {
    if (t.type === 'text') html += t.content;
    else if (!['ol','ul','li','table','tablehead','tablebody','tr','td','th','blockquote','pre','hr','code','p','br'].includes(t.name)) {
      html += t.full;
    } else if (t.name === 'br') {
      html += '\n';
    }
  }
  return inlineHtml(html);
}

/** Process an <ol> token block, recursively handling nested lists. */
function processOlTokens(olTokens: Token[], lines: string[]): void {
  const liGroups: {content: Token[]; nested: Array<{tokens: Token[]; isOl: boolean}>}[] = [];
  let i = 0;
  while (i < olTokens.length) {
    if (olTokens[i].type === 'tag' && olTokens[i].name === 'li' && !olTokens[i].closing) {
      const ci = findCloseIdx(olTokens, i, 'li');
      const liTokens = olTokens.slice(i, ci + 1);
      // Extract nested ol/ul inside this li
      const nested: Array<{tokens: Token[]; isOl: boolean}> = [];
      const inlineTokens: Token[] = [];
      let j = 1; // skip opening <li>
      while (j < liTokens.length - 1) { // skip closing </li>
        if (liTokens[j].type === 'tag' && !liTokens[j].closing && (liTokens[j].name === 'ol' || liTokens[j].name === 'ul')) {
          const nci = findCloseIdx(liTokens, j, liTokens[j].name);
          nested.push({ tokens: liTokens.slice(j, nci + 1), isOl: liTokens[j].name === 'ol' });
          j = nci + 1;
        } else if (liTokens[j].type === 'tag' && liTokens[j].name === 'li') {
          j++; // skip inner <li> tags
        } else {
          inlineTokens.push(liTokens[j]);
          j++;
        }
      }
      liGroups.push({ content: inlineTokens, nested });
      i = ci + 1;
    } else {
      i++;
    }
  }
  // We handle numbering at the caller to get proper 1,2,3... for top-level
  const results: Array<{content: string; nested: Array<{tokens: Token[]; isOl: boolean}>}> = [];
  for (const g of liGroups) {
    results.push({ content: tokensToInline(g.content), nested: g.nested });
  }
  // Emit lines
  for (let idx = 0; idx < results.length; idx++) {
    const r = results[idx];
    const num = idx + 1;
    const indent = '   ';
    lines.push(`${num}. ${r.content}`);
    for (const n of r.nested) {
      if (n.isOl) processOlTokensIndent(n.tokens, lines, indent);
      else processUlTokensIndent(n.tokens, lines, indent);
    }
  }
}

function processUlTokens(ulTokens: Token[], lines: string[]): void {
  processUlTokensIndent(ulTokens, lines, '');
}

function processOlTokensIndent(olTokens: Token[], lines: string[], prefix: string): void {
  const results: Array<{content: string; nested: Array<{tokens: Token[]; isOl: boolean}>}> = [];
  let i = 0;
  while (i < olTokens.length) {
    if (olTokens[i].type === 'tag' && olTokens[i].name === 'li' && !olTokens[i].closing) {
      const ci = findCloseIdx(olTokens, i, 'li');
      const liTokens = olTokens.slice(i, ci + 1);
      const nested: Array<{tokens: Token[]; isOl: boolean}> = [];
      const inlineTokens: Token[] = [];
      let j = 1;
      while (j < liTokens.length - 1) {
        if (liTokens[j].type === 'tag' && !liTokens[j].closing && (liTokens[j].name === 'ol' || liTokens[j].name === 'ul')) {
          const nci = findCloseIdx(liTokens, j, liTokens[j].name);
          nested.push({ tokens: liTokens.slice(j, nci + 1), isOl: liTokens[j].name === 'ol' });
          j = nci + 1;
        } else if (liTokens[j].type === 'tag' && liTokens[j].name === 'li') {
          j++;
        } else {
          inlineTokens.push(liTokens[j]);
          j++;
        }
      }
      results.push({ content: tokensToInline(inlineTokens), nested });
      i = ci + 1;
    } else {
      i++;
    }
  }
  for (let idx = 0; idx < results.length; idx++) {
    const r = results[idx];
    const num = idx + 1;
    lines.push(`${prefix}${num}. ${r.content}`);
    for (const n of r.nested) {
      if (n.isOl) processOlTokensIndent(n.tokens, lines, prefix + '   ');
      else processUlTokensIndent(n.tokens, lines, prefix + '  ');
    }
  }
}

function processUlTokensIndent(ulTokens: Token[], lines: string[], prefix: string): void {
  const results: Array<{content: string; nested: Array<{tokens: Token[]; isOl: boolean}>}> = [];
  let i = 0;
  while (i < ulTokens.length) {
    if (ulTokens[i].type === 'tag' && ulTokens[i].name === 'li' && !ulTokens[i].closing) {
      const ci = findCloseIdx(ulTokens, i, 'li');
      const liTokens = ulTokens.slice(i, ci + 1);
      const nested: Array<{tokens: Token[]; isOl: boolean}> = [];
      const inlineTokens: Token[] = [];
      let j = 1;
      while (j < liTokens.length - 1) {
        if (liTokens[j].type === 'tag' && !liTokens[j].closing && (liTokens[j].name === 'ol' || liTokens[j].name === 'ul')) {
          const nci = findCloseIdx(liTokens, j, liTokens[j].name);
          nested.push({ tokens: liTokens.slice(j, nci + 1), isOl: liTokens[j].name === 'ol' });
          j = nci + 1;
        } else if (liTokens[j].type === 'tag' && liTokens[j].name === 'li') {
          j++;
        } else {
          inlineTokens.push(liTokens[j]);
          j++;
        }
      }
      results.push({ content: tokensToInline(inlineTokens), nested });
      i = ci + 1;
    } else {
      i++;
    }
  }
  for (const r of results) {
    lines.push(`${prefix}- ${r.content}`);
    for (const n of r.nested) {
      if (n.isOl) processOlTokensIndent(n.tokens, lines, prefix + '  ');
      else processUlTokensIndent(n.tokens, lines, prefix + '  ');
    }
  }
}

// ---------------------------------------------------------------------------
// Table conversion
// ---------------------------------------------------------------------------
function convertTable(html: string): string {
  const headerCells = [...html.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)].map(m => stripInline(m[1]));
  const bodyRows: string[][] = [];
  for (const rm of [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]) {
    const cells = [...rm[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(m => stripInline(m[1]));
    if (cells.length) bodyRows.push(cells);
  }
  const rows: string[] = [];
  if (headerCells.length) {
    rows.push('| ' + headerCells.join(' | ') + ' |');
    rows.push('| ' + headerCells.map(() => '---').join(' | ') + ' |');
  }
  for (const cells of bodyRows) rows.push('| ' + cells.join(' | ') + ' |');
  return rows.join('\n');
}

// ---------------------------------------------------------------------------
// Block-level converter
// ---------------------------------------------------------------------------
function htmlToMd(tokens: Token[]): string[] {
  const out: string[] = [];
  let pos = 0;

  while (pos < tokens.length) {
    const t = tokens[pos];
    if (t.type === 'text') { pos++; continue; }
    if (t.closing) { pos++; continue; }
    const tag = t.name;

    if (/^h[1-6]$/.test(tag)) {
      const ci = findCloseIdx(tokens, pos, tag);
      const inner = tokens.slice(pos + 1, ci).map(x => x.type === 'text' ? x.content : x.full).join('');
      out.push('#'.repeat(parseInt(tag[1])) + ' ' + inlineHtml(inner));
      pos = ci + 1;
    } else if (tag === 'hr') {
      out.push('---', ''); pos++;
    } else if (tag === 'ol') {
      const ci = findCloseIdx(tokens, pos, tag);
      processOlTokens(tokens.slice(pos + 1, ci), out);
      out.push('');
      pos = ci + 1;
    } else if (tag === 'ul') {
      const ci = findCloseIdx(tokens, pos, tag);
      processUlTokens(tokens.slice(pos + 1, ci), out);
      out.push('');
      pos = ci + 1;
    } else if (tag === 'table') {
      const ci = findCloseIdx(tokens, pos, tag);
      const inner = tokens.slice(pos + 1, ci).map(x => x.type === 'text' ? x.content : x.full).join('');
      out.push(convertTable(inner), '');
      pos = ci + 1;
    } else if (tag === 'tbody' || tag === 'thead' || tag === 'tr' || tag === 'td' || tag === 'th') {
      pos++;
    } else if (tag === 'blockquote') {
      const ci = findCloseIdx(tokens, pos, tag);
      const inner = tokens.slice(pos + 1, ci).map(x => x.type === 'text' ? x.content : x.full).join('');
      for (const l of inlineHtml(inner).split('\n')) out.push('> ' + l);
      out.push(''); pos = ci + 1;
    } else if (tag === 'p') {
      const ci = findCloseIdx(tokens, pos, tag);
      const inner = tokens.slice(pos + 1, ci);
      const rawHtml = inner.map(x => x.full).join('');
      if (/<(h[1-6]|ol|ul|li|table|thead|tbody|tr|td|th|blockquote|pre|hr|code)\b/i.test(rawHtml)) {
        out.push(...htmlToMd(inner).filter(l => l.trim()));
      } else {
        const md = inlineHtml(inner.map(x => x.type === 'text' ? x.content : x.full).join(''));
        if (md) out.push(md, '');
      }
      pos = ci + 1;
    } else if (tag === 'code') {
      const parts: string[] = [];
      pos++;
      while (pos < tokens.length) {
        const ct = tokens[pos];
        if (ct.type === 'tag' && ct.name === 'code' && ct.closing) { pos++; break; }
        if (ct.type === 'text') parts.push(ct.content);
        else if (ct.type === 'tag' && ct.name === 'br') parts.push('\n');
        pos++;
      }
      let code = decodeEntities(parts.join(''));
      code = code.replace(/<\/?[a-zA-Z][^>]*>/g, '').trim();
      const nl = code.indexOf('\n');
      if (nl > 0 && nl < 20) {
        const hint = code.slice(0, nl).trim();
        const body = code.slice(nl + 1);
        if (/^[a-zA-Z]+$/.test(hint) && hint.length < 15 && (body.includes('\n') || body.includes('-->'))) {
          out.push('```' + hint, body, '```', ''); continue;
        }
      }
      if (code.includes('\n')) out.push('```', code, '```', '');
      else out.push('`' + code + '`', '');
    } else if (tag === 'pre') {
      const ci = findCloseIdx(tokens, pos, tag);
      const code = decodeEntities(tokens.slice(pos + 1, ci).map(x => x.type === 'text' ? x.content : '').join('')).trim();
      out.push('```', code, '```', ''); pos = ci + 1;
    } else if (tag === 'div' || tag === 'section' || tag === 'article') {
      const ci = findCloseIdx(tokens, pos, tag);
      out.push(...htmlToMd(tokens.slice(pos + 1, ci)).filter(l => l));
      pos = ci + 1;
    } else if (tag === 'strong' || tag === 'b' || tag === 'em' || tag === 'i') {
      const ci = findCloseIdx(tokens, pos, tag);
      let buf = '';
      for (let i = pos; i <= ci; i++) {
        const it = tokens[i];
        buf += it.type === 'text' ? it.content : it.full;
      }
      const md = inlineHtml(buf);
      if (md) out.push(md);
      pos = ci + 1;
    } else if (tag === 'a') {
      const ci = findCloseIdx(tokens, pos, tag);
      let buf = '';
      for (let i = pos; i <= ci; i++) buf += tokens[i].type === 'text' ? tokens[i].content : tokens[i].full;
      const md = inlineHtml(buf);
      if (md) out.push(md);
      pos = ci + 1;
    } else if (tag === 'br') {
      out.push(''); pos++;
    } else if (tag === '!--') { pos++; }
    else { pos++; }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function convertHtmlToMarkdown(html: string, id: string): ConvertResult | null {
  const tm = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const title = tm ? decodeEntities(tm[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')).trim() : '';
  if (!title) return null;

  const tms = [...html.matchAll(/<span\s+class=["']tag["'][^>]*>([\s\S]*?)<\/span>/gi)];
  let tags = tms.map(m => decodeEntities(m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')).trim()).filter(x => x && x !== 'null');
  const type = tags[0] || '其他';
  if (!tags.length) tags = [type];

  let date = '';
  const dm = html.match(/创建于[：:]\s*(\d{4}-\d{2}-\d{2})/);
  if (dm) date = dm[1];

  const hri = html.lastIndexOf('<hr');
  let bodyHtml = (hri >= 0 ? html.slice(hri) : html)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<div[^>]*id\s*=["']?jsonData["']?[^>]*>[\s\S]*?<\/div>/gi, '')
    .replace(/<audio[^>]*>[\s\S]*?<\/audio>/gi, '')
    .replace(/<source[^>]*\/?>/gi, '')
    .replace(/<div[^>]*class=["']note["'][^>]*>/gi, '')
    .replace(/<div[^>]*class=["']note-container["'][^>]*>/gi, '')
    .replace(/<\/div>/gi, '');

  let attachmentLine = '';
  const am = bodyHtml.match(/<div\s+class=["']attachment["'][^>]*>([\s\S]*?)<\/div>/i);
  if (am) {
    const lm = am[1].match(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
    if (lm) attachmentLine = `原文：[${decodeEntities(lm[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')).trim()}](${lm[1]})`;
  }
  bodyHtml = bodyHtml.replace(/<div[^>]*class=["']attachment["'][^>]*>[\s\S]*?<\/div>/gi, '').trim();

  const tokens = tokenise(bodyHtml);
  let bodyLines = htmlToMd(tokens);

  // Normalize blank lines
  const cleaned: string[] = [];
  let prevBlank = false;
  for (const l of bodyLines) {
    if (!l.trim()) { if (!prevBlank && cleaned.length) cleaned.push(''); prevBlank = true; }
    else { cleaned.push(l); prevBlank = false; }
  }
  while (cleaned.length && !cleaned[0].trim()) cleaned.shift();
  while (cleaned.length && !cleaned[cleaned.length - 1].trim()) cleaned.pop();
  if (attachmentLine) cleaned.unshift(attachmentLine, '');

  const imageRefs: string[] = [];
  for (const m of html.matchAll(/src=["']([^"']+)["']/gi)) {
    if (/\.(jpg|jpeg|png|gif|webp)$/i.test(m[1])) imageRefs.push(m[1]);
  }

  return { frontmatter: { id, title, date, type, tags, domain: '', connections: [] }, body: cleaned.join('\n'), imageRefs };
}

export function buildMarkdownString(r: ConvertResult): string {
  const f = r.frontmatter;
  const lines = ['---', `id: "${f.id}"`, `title: "${f.title.replace(/"/g, '\\"')}"`, `type: "${f.type}"`];
  lines.push(`tags: [${f.tags.map(t => `"${t.replace(/"/g, '\\"')}"`).join(', ')}]`);
  if (f.domain) lines.push(`domain: "${f.domain}"`);
  if (f.date) lines.push(`date: "${f.date}"`);
  if (f.connections.length) {
    lines.push('connections:');
    for (const c of f.connections) lines.push(`  - noteId: "${c.noteId}"`, `    score: ${c.score}`, `    type: "${c.type}"`);
  }
  if (f.x !== undefined) { lines.push(`x: ${f.x}`); lines.push(`y: ${f.y}`); }
  if (f.ai_summary) { lines.push('ai_summary: |'); for (const l of f.ai_summary.split('\n')) lines.push(`  ${l}`); }
  lines.push('---', '', r.body);
  if (r.imageRefs.length) { lines.push(''); for (const ref of r.imageRefs) lines.push(`![](images/${f.id}/${path.basename(ref)})`); }
  return lines.join('\n');
}
