import { describe, it, expect } from 'vitest';
import { convertHtmlToMarkdown, buildMarkdownString } from '../../tools/markdown.js';

const FIXTURE_HTML = `<html><body>
<h1>测试笔记标题</h1>
<p>创建于：2026-03-28 10:30:00<br><span class="tag">录音笔记</span><span class="tag">AI智能体</span></p>
<hr>
<div>这是笔记正文内容，包含一些关键信息。</div>
</body></html>`;

describe('convertHtmlToMarkdown', () => {
  it('从 HTML 提取标题、日期、标签', () => {
    const result = convertHtmlToMarkdown(FIXTURE_HTML, 'test-uuid-001', '/tmp/images/');
    expect(result).not.toBeNull();
    expect(result!.frontmatter.title).toBe('测试笔记标题');
    expect(result!.frontmatter.date).toBe('2026-03-28');
    expect(result!.frontmatter.tags).toEqual(['录音笔记', 'AI智能体']);
    expect(result!.frontmatter.type).toBe('录音笔记');
  });

  it('生成有效 frontmatter', () => {
    const result = convertHtmlToMarkdown(FIXTURE_HTML, 'test-uuid-001', '/tmp/images/');
    expect(result!.frontmatter.id).toBe('test-uuid-001');
    expect(result!.frontmatter.title).toBeTruthy();
    expect(result!.frontmatter.type).toBeTruthy();
  });

  it('正文去除 HTML 标签', () => {
    const result = convertHtmlToMarkdown(FIXTURE_HTML, 'test-uuid-001', '/tmp/images/');
    expect(result!.body).not.toContain('<');
    expect(result!.body).not.toContain('>');
  });

  it('处理无标题无标签的无效笔记返回 null', () => {
    const result = convertHtmlToMarkdown('<html><body><p>无内容</p></body></html>', 'bad-001', '/tmp/images/');
    expect(result).toBeNull();
  });

  it('无标签时 tags 包含"其他"而非空数组', () => {
    const noTagHtml = `<html><body>
<h1>无标签笔记</h1>
<p>创建于：2026-03-28 10:30:00</p>
<hr>
<div>正文内容</div>
</body></html>`;
    const result = convertHtmlToMarkdown(noTagHtml, 'no-tag-001', '/tmp/images/')!;
    expect(result.frontmatter.tags).toEqual(['其他']);
    expect(result.frontmatter.type).toBe('其他');
  });
});

describe('buildMarkdownString', () => {
  it('生成包含 frontmatter 和正文的完整 Markdown', () => {
    const result = convertHtmlToMarkdown(FIXTURE_HTML, 'test-uuid-001', '/tmp/images/')!;
    const md = buildMarkdownString(result);
    expect(md).toContain('---');
    expect(md).toContain('id: "test-uuid-001"');
    expect(md).toContain('title: "测试笔记标题"');
    expect(md).toContain('type: "录音笔记"');
    expect(md).toContain('这是笔记正文内容');
  });

  it('正确序列化 connections', () => {
    const result = convertHtmlToMarkdown(FIXTURE_HTML, 'test-001', '/tmp/images/')!;
    result.frontmatter.connections = [
      { noteId: 'note-002', score: 0.92, type: 'semantic' },
    ];
    const md = buildMarkdownString(result);
    expect(md).toContain('connections:');
    expect(md).toContain('noteId: "note-002"');
    expect(md).toContain('score: 0.92');
    expect(md).toContain('type: "semantic"');
  });

  it('domain 为空时 frontmatter 不输出 domain 行', () => {
    const result = convertHtmlToMarkdown(FIXTURE_HTML, 'no-domain-001', '/tmp/images/')!;
    expect(result.frontmatter.domain).toBe('');
    const md = buildMarkdownString(result);
    expect(md).not.toContain('domain:');
  });
});
