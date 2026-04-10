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
 * Strategy: extract title+tags from before <hr>, content from after <hr>.
 */
import * as fs from 'fs';
import * as path from 'path';
export const NOTE_TYPES = ['录音笔记', 'AI链接笔记', '图片笔记', '录音卡笔记'];
function stripHtml(html) {
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
export function parseHtmlFile(filePath) {
    let html;
    try {
        html = fs.readFileSync(filePath, 'utf-8');
    }
    catch {
        return null;
    }
    const filename = path.basename(filePath, '.html');
    // 1. Title from <h1>
    const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
    const title = titleMatch ? stripHtml(titleMatch[1]).trim() : '';
    // 2. Tags from <span class="tag">
    const tagMatches = [...html.matchAll(/<span class="tag"[^>]*>([\s\S]*?)<\/span>/gi)];
    const tags = tagMatches
        .map(m => stripHtml(m[1]).trim())
        .filter(t => t.length > 0 && t !== 'null');
    // 3. Split at <hr>: before = header/meta, after = actual content
    const lastHrIdx = html.lastIndexOf('<hr');
    const beforeHtml = lastHrIdx >= 0 ? html.slice(0, lastHrIdx) : '';
    const afterHtml = lastHrIdx >= 0 ? html.slice(lastHrIdx) : '';
    // Strip noise elements
    const cleanBefore = beforeHtml
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<div[^>]*id\s*=\s*["']?jsonData["']?[^>]*>[\s\S]*?<\/div>/gi, '');
    const cleanAfter = afterHtml
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<div[^>]*id\s*=\s*["']?jsonData["']?[^>]*>[\s\S]*?<\/div>/gi, '')
        .replace(/<audio[\s\S]*?<\/audio>/gi, '')
        .replace(/<source[\s\S]*?\/?>/gi, '');
    // 4. Date from header section
    let date = '';
    const dateMatch = cleanBefore.match(/创建于[：:]\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/);
    if (dateMatch) {
        date = dateMatch[1];
    }
    // 5. Content: strip title from before section (it's duplicated in content), combine both
    const beforeText = stripHtml(cleanBefore);
    const afterText = stripHtml(cleanAfter);
    // Deduplicate: if after starts with content from before, skip it
    let contentSnippet = afterText;
    if (beforeText.length > 5 && afterText.startsWith(beforeText.slice(0, 20))) {
        contentSnippet = beforeText + ' ' + afterText;
    }
    else {
        contentSnippet = (beforeText + ' ' + afterText).trim();
    }
    // Remove title duplication (it appears in both sections)
    if (title && contentSnippet.startsWith(title)) {
        contentSnippet = contentSnippet.slice(title.length).replace(/^[\s:：,，.]+/, '').trim();
    }
    contentSnippet = contentSnippet.slice(0, 800);
    if (!title && tags.length === 0) {
        return null;
    }
    return { id: filename, title, date, tags, contentSnippet, filename };
}
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
