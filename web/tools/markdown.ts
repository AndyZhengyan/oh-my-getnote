// tools/markdown.ts

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
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

// ---------------------------------------------------------------------------
// Recursive HTML → Markdown converter
// ---------------------------------------------------------------------------

/** Strip a single HTML tag, returning its inner HTML */
function innerOf(tagName: string, html: string): string {
  const re = new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)</${tagName}>`, 'i');
  const m = html.match(re);
  return m ? m[1] : '';
}

/** Returns true if the string looks like an opening HTML tag */
function isTag(token: string): boolean {
  return /^\s*<[a-z\/!]/i.test(token);
}

/** Tokenise HTML into a flat array of "tag" | "text" tokens */
function tokenise(html: string): string[] {
  const tokens: string[] = [];
  let remaining = html;
  while (remaining.length > 0) {
    const ltIdx = remaining.indexOf('<');
    if (ltIdx === -1) {
      if (remaining.trim()) tokens.push(remaining);
      break;
    }
    if (ltIdx > 0) tokens.push(remaining.slice(0, ltIdx));
    const gtIdx = remaining.indexOf('>');
    if (gtIdx === -1) break;
    tokens.push(remaining.slice(ltIdx, gtIdx + 1));
    remaining = remaining.slice(gtIdx + 1);
  }
  return tokens;
}

/** Strip all HTML tags from text, decode entities, collapse whitespace */
function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')).trim();
}

/** Normalise whitespace at start / end of a line */
function norm(text: string): string {
  return text.replace(/^[ \t]+/, '').replace(/[ \t]+$/, '').replace(/[ \t]+/g, ' ');
}

/** Process inline elements within a text node (bold, italic, code, links) */
function inline(text: string): string {
  // links: <a href="...">label</a>
  text = text.replace(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, label) => {
    return `[${inline(label.trim())}](${href})`;
  });
  // bold+italic: <strong><em> or <em><strong>
  text = text.replace(/<\/?(?:strong|b)[^>]*>((?:<\/?(?:em|i)[^>]*>|[\s\S])*?)<\/?(?:strong|b)[^>]*>/gi, (_, inner) => `***${inline(inner)}***`);
  // bold: <strong> or <b>
  text = text.replace(/<\/?(?:strong|b)[^>]*>([\s\S]*?)<\/?(?:strong|b)[^>]*>/gi, (_, inner) => `**${inline(inner)}**`);
  // italic: <em> or <i>
  text = text.replace(/<\/?(?:em|i)[^>]*>([\s\S]*?)<\/?(?:em|i)[^>]*>/gi, (_, inner) => `*${inline(inner)}*`);
  // inline code
  text = text.replace(/`([^`]+)`/g, (_, code) => `\`${code}\``); // already escaped
  text = text.replace(/(?<!`)<code(?:[^>]*)?>([\s\S]*?)<\/code>(?!`)/gi, (_, code) => {
    // strip any nested HTML inside code
    const stripped = stripTags(code);
    return `\`${stripped}\``;
  });
  // line break: <br>
  text = text.replace(/<br\s*\/?>/gi, '  \n');
  // strip remaining tags
  text = stripTags(text);
  return text;
}

/** Convert an ordered list item (li) block to Markdown */
function convertOl(html: string): string {
  const items = html.match(/<li[^>]*>([\s\S]*?)<\/li>/gi) || [];
  return items
    .map((item, i) => {
      const num = i + 1;
      // handle nested ol/ul
      const content = inline(item.replace(/<li[^>]*>([\s\S]*)<\/li>/i, '$1').replace(/<li[^>]*>([\s\S]*?)<\/li>/i, '$1'));
      const nested = convertListContent(item);
      const lines = nested.split('\n').map((l, j) => j === 0 ? `1. ${content}` : `   ${l}`);
      return lines.join('\n');
    })
    .join('\n');
}

/** Convert an unordered list item (li) block to Markdown */
function convertUl(html: string): string {
  const items = html.match(/<li[^>]*>([\s\S]*?)<\/li>/gi) || [];
  return items
    .map(item => {
      const content = stripTags(item.replace(/<li[^>]*>([\s\S]*?)<\/li>/i, '$1')).trim();
      const nested = convertListContent(item);
      const lines = nested.split('\n').map((l, i) => i === 0 ? `- ${inline(content)}` : `  ${l}`);
      return lines.join('\n');
    })
    .join('\n');
}

function convertListContent(html: string): string {
  const parts: string[] = [];
  // pull out nested ol/ul
  let rest = html;
  let match: RegExpMatchArray | null;
  const listRe = /<o?l[^>]*>([\s\S]*?)<\/o?l>/gi;
  while ((match = rest.match(listRe)) !== null) {
    const before = rest.slice(0, match.index!);
    if (before.trim()) parts.push(inline(before));
    const listContent = match[0];
    if (listContent.startsWith('<ol')) parts.push(convertOl(listContent));
    else parts.push(convertUl(listContent));
    rest = rest.slice(match.index! + match[0].length);
  }
  if (rest.trim()) parts.push(inline(rest));
  return parts.join('\n');
}

/** Convert a <table> element to Markdown */
function convertTable(html: string): string {
  const rows: string[] = [];
  const headerCells = [...html.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)].map(m => norm(inline(m[1])));
  const bodyRows: string[][] = [];
  const rowMatches = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
  for (const rowMatch of rowMatches) {
    const cells = [...rowMatch[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(m => norm(inline(m[1])));
    if (cells.length > 0) bodyRows.push(cells);
  }
  if (headerCells.length > 0) {
    rows.push(`| ${headerCells.join(' | ')} |`);
    rows.push(`| ${headerCells.map(() => '---').join(' | ')} |`);
  }
  for (const cells of bodyRows) {
    rows.push(`| ${cells.join(' | ')} |`);
  }
  return rows.join('\n');
}

/** Recursively convert an HTML snippet to Markdown blocks.
 *  Returns an array of top-level Markdown lines. */
function htmlToMd(html: string): string[] {
  const lines: string[] = [];
  let pos = 0;
  const tokens = tokenise(html);

  while (pos < tokens.length) {
    const token = tokens[pos];

    if (!token.startsWith('<')) {
      // text node
      const text = token.trim();
      if (text) lines.push(text);
      pos++;
      continue;
    }

    const tagLower = token.slice(1, token.length - 1).replace(/\s.*$/, '').toLowerCase();

    if (tagLower === 'h1') {
      const inner = innerOf('h1', tokenise(tokens.slice(pos).join('')).join(''));
      lines.push(`# ${inline(inner)}`);
      // advance past this tag
      pos++;
      while (pos < tokens.length && !tokens[pos].match(/^<\/h1/i)) pos++;
      pos++; // skip </h1>
    } else if (tagLower === 'h2') {
      const inner = innerOf('h2', tokens.slice(pos).join(''));
      lines.push(`## ${inline(inner)}`);
      pos++;
      while (pos < tokens.length && !tokens[pos].match(/^<\/h2/i)) pos++;
      pos++;
    } else if (tagLower === 'h3') {
      const inner = innerOf('h3', tokens.slice(pos).join(''));
      lines.push(`### ${stripTags(inner)}`);
      pos++;
      while (pos < tokens.length && !tokens[pos].match(/^<\/h3/i)) pos++;
      pos++;
    } else if (tagLower === 'h4') {
      const inner = innerOf('h4', tokens.slice(pos).join(''));
      lines.push(`#### ${stripTags(inner)}`);
      pos++;
      while (pos < tokens.length && !tokens[pos].match(/^<\/h4/i)) pos++;
      pos++;
    } else if (tagLower === 'h5' || tagLower === 'h6') {
      const inner = innerOf(tagLower, tokens.slice(pos).join(''));
      lines.push(`##### ${stripTags(inner)}`);
      pos++;
      while (pos < tokens.length && !tokens[pos].match(new RegExp(`^</${tagLower}`, 'i'))) pos++;
      pos++;
    } else if (tagLower === 'hr') {
      lines.push('---');
      pos++;
    } else if (tagLower === 'ol') {
      const inner = innerOf('ol', tokens.slice(pos).join(''));
      lines.push(convertOl(`<ol>${inner}</ol>`));
      pos++;
      while (pos < tokens.length && !tokens[pos].match(/^<\/ol/i)) pos++;
      pos++;
    } else if (tagLower === 'ul') {
      const inner = innerOf('ul', tokens.slice(pos).join(''));
      lines.push(convertUl(`<ul>${inner}</ul>`));
      pos++;
      while (pos < tokens.length && !tokens[pos].match(/^<\/ul/i)) pos++;
      pos++;
    } else if (tagLower === 'table') {
      const inner = innerOf('table', tokens.slice(pos).join(''));
      lines.push(convertTable(`<table>${inner}</table>`));
      lines.push(''); // blank line after table
      pos++;
      while (pos < tokens.length && !tokens[pos].match(/^<\/table/i)) pos++;
      pos++;
    } else if (tagLower === 'blockquote') {
      const inner = innerOf('blockquote', tokens.slice(pos).join(''));
      const md = inline(inner);
      for (const l of md.split('\n')) lines.push(`> ${l}`);
      lines.push('');
      pos++;
      while (pos < tokens.length && !tokens[pos].match(/^<\/blockquote/i)) pos++;
      pos++;
    } else if (tagLower === 'p') {
      const inner = innerOf('p', tokens.slice(pos).join(''));
      // check if inner starts with a heading tag
      const headingMatch = inner.match(/^<h([1-6])[^>]*>([\s\S]*)/i);
      if (headingMatch) {
        const lvl = headingMatch[1];
        lines.push(`${'#'.repeat(parseInt(lvl) + 1)} ${inline(headingMatch[2])}`);
      } else {
        const md = inline(inner);
        if (md.trim()) {
          lines.push(md);
          lines.push(''); // paragraphs get blank line
        }
      }
      pos++;
      while (pos < tokens.length && !tokens[pos].match(/^<\/p/i)) pos++;
      pos++;
    } else if (tagLower === 'code') {
      // block-level <code> — collect until </code>
      const codeParts: string[] = [];
      pos++;
      while (pos < tokens.length) {
        if (tokens[pos].match(/^<\/code/i)) { pos++; break; }
        if (!tokens[pos].startsWith('<')) codeParts.push(tokens[pos]);
        pos++;
      }
      const codeText = decodeEntities(codeParts.join('').replace(/`/g, ''));
      lines.push(`\`\`\`\n${codeText}\n\`\`\``);
      lines.push('');
    } else if (tagLower === 'div' || tagLower === 'section' || tagLower === 'article') {
      // recurse into container elements
      const inner = innerOf(tagLower, tokens.slice(pos).join(''));
      const innerTokens = tokenise(inner);
      // process inner tokens
      for (const subLine of htmlToMd(inner)) {
        if (subLine.trim() || subLine === '') lines.push(subLine);
      }
      pos++;
      while (pos < tokens.length && !tokens[pos].match(new RegExp(`^</${tagLower}`, 'i'))) pos++;
      pos++;
    } else if (tagLower === 'br') {
      lines.push('');
      pos++;
    } else if (tagLower === 'a') {
      // inline <a> — handled by inline()
      pos++;
    } else if (tagLower === '!--') {
      // HTML comment
      pos++;
    } else {
      // unknown / skip
      pos++;
    }
  }

  return lines;
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
    .filter(t => t.length > 0 && t !== 'null');
  const type = tags[0] || '其他';
  if (tags.length === 0) tags = [type];

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

  // Convert HTML to Markdown lines
  const rawLines = htmlToMd(bodyWithoutAttachment);

  // Build body: attachment + non-empty lines, collapsed double blank lines
  const bodyLines: string[] = [];
  if (attachmentLine) bodyLines.push(attachmentLine, '');
  let lastWasBlank = false;
  for (const line of rawLines) {
    const trimmed = line.trim();
    if (trimmed === '') {
      if (!lastWasBlank) bodyLines.push('');
      lastWasBlank = true;
    } else {
      bodyLines.push(trimmed);
      lastWasBlank = false;
    }
  }
  // Remove leading/trailing blank lines
  while (bodyLines.length > 0 && bodyLines[0] === '') bodyLines.shift();
  while (bodyLines.length > 0 && bodyLines[bodyLines.length - 1] === '') bodyLines.pop();

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
    body: bodyLines.join('\n'),
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

  return lines.join('\n');
}
