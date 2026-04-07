import { describe, it, expect } from 'vitest';
import { convertHtmlToMarkdown } from './markdown';

describe('convertHtmlToMarkdown', () => {
  it('extracts title from h1', () => {
    const html = `<html><body><h1>Test Title</h1><hr><p>Body</p></body></html>`;
    const result = convertHtmlToMarkdown(html, 'test-id');
    expect(result?.frontmatter.title).toBe('Test Title');
  });

  it('extracts tags from span.tag', () => {
    const html = `<html><body><h1>T</h1><hr><span class="tag">AI链接笔记</span></body></html>`;
    const result = convertHtmlToMarkdown(html, 'test-id');
    expect(result?.frontmatter.tags).toContain('AI链接笔记');
  });

  it('extracts date from 创建于 pattern', () => {
    const html = `<html><body><h1>T</h1><p>创建于：2026-01-11</p><hr><p>Body</p></body></html>`;
    const result = convertHtmlToMarkdown(html, 'test-id');
    expect(result?.frontmatter.date).toBe('2026-01-11');
  });

  it('converts h3 to ### heading', () => {
    const html = `<html><body><h1>T</h1><hr><h3>Section Title</h3><p>Content</p></body></html>`;
    const result = convertHtmlToMarkdown(html, 'test-id');
    expect(result?.body).toContain('### Section Title');
  });

  it('converts h4 to #### heading', () => {
    const html = `<html><body><h1>T</h1><hr><h4>Subsection</h4><p>Content</p></body></html>`;
    const result = convertHtmlToMarkdown(html, 'test-id');
    expect(result?.body).toContain('#### Subsection');
  });

  it('converts ul list items to markdown', () => {
    const html = `<html><body><h1>T</h1><hr><ul><li>Item A</li><li>Item B</li></ul></body></html>`;
    const result = convertHtmlToMarkdown(html, 'test-id');
    expect(result?.body).toContain('- Item A');
    expect(result?.body).toContain('- Item B');
  });

  it('returns null when no h1', () => {
    const html = `<html><body><hr><p>No title</p></body></html>`;
    expect(convertHtmlToMarkdown(html, 'x')).toBeNull();
  });

  it('strips script tags and jsonData div from body', () => {
    const html = `<html><body><h1>T</h1><hr><script>alert('x')</script><div id="jsonData">{}</div><p>Real content</p></body></html>`;
    const result = convertHtmlToMarkdown(html, 'test-id');
    expect(result?.body).not.toContain('alert');
    expect(result?.body).not.toContain('jsonData');
    expect(result?.body).toContain('Real content');
  });

  it('extracts attachment link as markdown link', () => {
    const html = `<html><body><h1>T</h1><hr><div class="attachment"><a href="https://example.com">Example Link</a></div></body></html>`;
    const result = convertHtmlToMarkdown(html, 'test-id');
    expect(result?.body).toContain('[Example Link](https://example.com)');
  });

  it('outputs blank line for empty paragraphs', () => {
    // 空段落作为唯一的分隔手段时，必须产生空行
    const html = `<html><body><h1>T</h1><p></p><p>第二段</p></body></html>`;
    const result = convertHtmlToMarkdown(html, 'test-id');
    const body = result!.body;
    expect(body).toContain('第二段');
    // 第二段前应有空行（来自空<p>）
    const secondIdx = body.indexOf('第二段');
    const before = body.slice(0, secondIdx);
    expect(before).toMatch(/\n\s*\n/);
  });

  it('converts <br> inside <p> to separate lines', () => {
    const html = `<html><body><h1>T</h1><hr><p>第一行<br>第二行</p></body></html>`;
    const result = convertHtmlToMarkdown(html, 'test-id');
    const body = result!.body;
    expect(body).toContain('第一行');
    expect(body).toContain('第二行');
    // Find the substring between the two lines
    const firstIdx = body.indexOf('第一行');
    const secondIdx = body.indexOf('第二行');
    // Content after '第一行' and before '第二行' should contain a newline
    const between = body.slice(firstIdx + 3, secondIdx);
    expect(between).toMatch(/\n/);
  });

  it('does not duplicate content from nested <p> tags', () => {
    const html = `<html><body><h1>T</h1><hr><p><p>嵌套内容</p></p></body></html>`;
    const result = convertHtmlToMarkdown(html, 'test-id');
    const body = result!.body;
    // 嵌套内容只应出现一次
    const matches = body.match(/嵌套内容/g);
    expect(matches).toHaveLength(1);
  });

  it('adds blank line between attachment and body', () => {
    const html = `<html><body><h1>T</h1><hr><div class="attachment"><a href="https://x.com/att">原文</a></div><p>Body txt</p></body></html>`;
    const result = convertHtmlToMarkdown(html, 'test-id');
    const body = result!.body;
    // attachmentLine is the first non-blank line
    const attachment = body.slice(0, body.indexOf('\n'));
    // find body content position (URL contains 'att', not 'txt' — no conflict)
    const bodyIdx = body.indexOf('Body txt');
    const between = body.slice(0, bodyIdx);
    // The non-blank prefix of body should be just the attachment line
    expect(between.trim()).toBe(attachment);
  });

  it('handles <br> inside list items as sub-lines', () => {
    const html = `<html><body><h1>T</h1><hr><ul><li>第一点<br>次行内容</li></ul></body></html>`;
    const result = convertHtmlToMarkdown(html, 'test-id');
    const body = result!.body;
    expect(body).toContain('- 第一点');
    expect(body).toContain('次行内容');
    const pointIdx = body.indexOf('第一点');
    const subIdx = body.indexOf('次行内容');
    expect(subIdx).toBeGreaterThan(pointIdx);
  });

  it('inlines image refs into body before main content', () => {
    const html = `<html><body><h1>T</h1><hr><div class="attachment"><img src="images/test.jpg"/></div><p>正文</p></body></html>`;
    const result = convertHtmlToMarkdown(html, 'test-id');
    // 图片引用应出现在 body 中
    expect(result!.body).toContain('![](images/test.jpg)');
    // 并且在正文之前
    const imgIdx = result!.body.indexOf('![](images/test.jpg)');
    const bodyIdx = result!.body.indexOf('正文');
    expect(imgIdx).toBeLessThan(bodyIdx);
  });
});
