/**
 * Get笔记 HTML Parser
 *
 * HTML structure per note file:
 *   <h1>标题</h1>
 *   <p>创建于：YYYY-MM-DD HH:MM:SS<br><span class="tag">标签</span>…</p>
 *   <hr>
 *   <div>  ← note content: AI summary / linked article / transcribed text</div>
 *   <div id="jsonData">  ← encoded binary (audio data, ignore)
 *
 * Strategy: use cheerio (CSS selectors) to extract structured data from the DOM.
 * No regex for HTML parsing — let the browser-grade parser handle edge cases.
 */
import * as fs from 'fs';
import * as path from 'path';
import { load } from 'cheerio';

export const NOTE_TYPES = ['录音笔记', 'AI链接笔记', '图片笔记', '录音卡笔记'];

/**
 * Decode common HTML entities.
 * cheerio .text() handles most of these, but we decode manually for
 * consistency and for cases where we read attribute values directly.
 */
function decodeEntities(str) {
    return str
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)))
        .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/**
 * Parse a single Get笔记 HTML file.
 *
 * @param {string} filePath  Absolute path to the .html file.
 * @returns {{ id: string, title: string, date: string, tags: string[],
 *            contentSnippet: string, filename: string } | null}
 */
export function parseHtmlFile(filePath) {
    let html;
    try {
        html = fs.readFileSync(filePath, 'utf-8');
    }
    catch {
        return null;
    }

    const filename = path.basename(filePath, '.html');

    // Split HTML at the <hr> that separates header from content.
    // cheerio doesn't expose a "before/after this element" slice cleanly,
    // so we split the raw string first — this is the one structural assumption.
    const lastHrIdx = html.lastIndexOf('<hr');
    const headerHtml = lastHrIdx >= 0 ? html.slice(0, lastHrIdx) : '';
    const contentHtml = lastHrIdx >= 0 ? html.slice(lastHrIdx) : '';

    // Parse header section (before <hr>) — contains title, tags, date
    const $header = load(headerHtml);

    // Title: first <h1> in the document
    const title = decodeEntities(
        $header('h1').first().text().trim()
    ) || '';

    // Tags: all <span class="tag"> elements
    const $ = $header;
    const tags = $header('span.tag')
        .map((_, el) => decodeEntities($(el).text().trim()))
        .get()
        .filter(t => t.length > 0 && t !== 'null');

    // Date: look for "创建于：YYYY-MM-DD HH:MM:SS" in any text node
    let date = '';
    const dateText = $header('body').text() || $header.root().text();
    const dateMatch = dateText.match(/创建于[：:]\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/);
    if (dateMatch) {
        date = dateMatch[1];
    }

    // Parse content section (after <hr>) — the actual note body
    const $content = load(contentHtml);

    // Remove noise elements from content
    $content('script').remove();
    $content('#jsonData').remove();
    $content('[id="jsonData"]').remove();
    $content('audio').remove();
    $content('source').remove();

    // Get plain text content from the body
    // Use .html() then strip our own tags to keep structure clean
    const rawText = $content('body').text() || $content.root().text();
    let contentSnippet = rawText.trim();

    // Remove title duplication if it appears at the start of content
    if (title && contentSnippet.startsWith(title)) {
        contentSnippet = contentSnippet.slice(title.length).replace(/^[\s:：,，.]+/, '').trim();
    }

    // Fallback: also check the header text if content is very short
    const headerText = headerHtml ? (load(headerHtml)('body').text() || load(headerHtml).root().text()) : '';
    if (contentSnippet.length < 10 && headerText.length > 10) {
        const headerPlain = headerText.trim();
        if (!headerPlain.startsWith(title) || title.length < 5) {
            contentSnippet = headerPlain;
        } else {
            contentSnippet = (contentSnippet + ' ' + headerPlain).trim();
        }
    }

    contentSnippet = contentSnippet.slice(0, 800);

    // Guard: skip notes with no title and no tags
    if (!title && tags.length === 0) {
        return null;
    }

    return {
        id: filename,
        title,
        date,
        tags,
        contentSnippet,
        filename,
    };
}

/**
 * Process all HTML files in a Get笔记 export folder.
 *
 * @param {string} folderPath  Path to the export root (contains notes/ subdirectory).
 * @returns {Array} Array of parsed note objects.
 */
export function processExportFolder(folderPath) {
    const notesDir = path.join(folderPath, 'notes');
    if (!fs.existsSync(notesDir)) {
        return [];
    }
    const files = fs.readdirSync(notesDir).filter(f => f.endsWith('.html'));
    const notes = [];
    for (const file of files) {
        const note = parseHtmlFile(path.join(notesDir, file));
        if (note) {
            notes.push(note);
        }
    }
    return notes;
}
