# HTML→Markdown 转换修复实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 `web/tools/markdown.ts` 中的 9 个转换质量问题，按优先级逐个解决。

**Architecture:** 全部改动集中在 `web/tools/markdown.ts`（转换器）和 `web/tools/markdown.test.ts`（测试）。`fixMarkdownLineBreaks`（RightPanel.tsx）作为 P3-9 兜底处理。

**Tech Stack:** TypeScript, Vitest

---

## 文件结构

- 修改: `web/tools/markdown.ts` — 转换器核心
- 修改: `web/tools/markdown.test.ts` — 新增测试用例

---

## Task 1: P0-1 — 空段落不输出空行

**Files:**
- Modify: `web/tools/markdown.ts:255-271`
- Test: `web/tools/markdown.test.ts`

- [ ] **Step 1: 添加测试**

打开 `web/tools/markdown.test.ts`，在最后一个 `it` 之后添加：

```typescript
it('outputs blank line for empty paragraphs', () => {
  const html = `<html><body><h1>T</h1><hr><p>第一段</p><p></p><p>第二段</p></body></html>`;
  const result = convertHtmlToMarkdown(html, 'test-id');
  const body = result!.body;
  // 两条 p 之间应有空行分隔
  expect(body).toContain('第一段');
  expect(body).toContain('第二段');
  const firstIdx = body.indexOf('第一段');
  const secondIdx = body.indexOf('第二段');
  // 两段之间应有空行（中间有 '\n\n'）
  const between = body.slice(firstIdx, secondIdx);
  expect(between).toMatch(/\n\s*\n/);
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npx vitest run web/tools/markdown.test.ts`
Expected: FAIL — 两个 `第一段` 和 `第二段` 在同一行，中间无空行

- [ ] **Step 3: 修复代码**

打开 `web/tools/markdown.ts`，找到 `<p>` 分支（约第255行），修改如下：

```typescript
// 原代码 (约第263-271行):
const md = inline(inner);
if (md.trim()) {
  lines.push(md);
  lines.push('');
} else {
  // P0-1 fix: 空段落仍输出一个空行，确保段间分隔
  lines.push('');
}

// 改为:
const md = inline(inner);
if (md.trim()) {
  lines.push(md);
  lines.push('');
} else {
  // 空段落仍输出一个空行，确保段间分隔
  lines.push('');
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npx vitest run web/tools/markdown.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add web/tools/markdown.ts web/tools/markdown.test.ts
git commit -m "fix(markdown): output blank line for empty paragraphs (P0-1)"
```

---

## Task 2: P1-2 — `<br>` 在段落中产生换行效果

**Files:**
- Modify: `web/tools/markdown.ts:255-271`（`<p>` 分支）
- Test: `web/tools/markdown.test.ts`

- [ ] **Step 1: 添加测试**

```typescript
it('converts <br> inside <p> to separate lines', () => {
  const html = `<html><body><h1>T</h1><hr><p>第一行<br>第二行</p></body></html>`;
  const result = convertHtmlToMarkdown(html, 'test-id');
  const body = result!.body;
  // 应产生两个独立行
  expect(body).toContain('第一行');
  expect(body).toContain('第二行');
  const firstIdx = body.indexOf('第一行');
  const secondIdx = body.indexOf('第二行');
  const between = body.slice(firstIdx, secondIdx);
  // 第二行应在第一行之后一行（允许中间有换行）
  expect(between.trim()).toBe('');
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npx vitest run web/tools/markdown.test.ts -t "br"`
Expected: FAIL — `第一行` 和 `第二行` 在同一行

- [ ] **Step 3: 修复代码**

在 `web/tools/markdown.ts` 的 `<p>` 分支中，`inline(inner)` 后按 `'  \n'` 分割：

```typescript
// 找到:
const md = inline(inner);
if (md.trim()) {
  lines.push(md);
  lines.push('');
} else {
  lines.push('');
}

// 改为:
const md = inline(inner);
if (md.trim()) {
  const parts = md.split('  \n');
  for (let i = 0; i < parts.length; i++) {
    if (parts[i].trim()) {
      lines.push(parts[i].trim());
    }
    if (i < parts.length - 1) lines.push('');
  }
  lines.push(''); // 段落末尾空行
} else {
  lines.push('');
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npx vitest run web/tools/markdown.test.ts -t "br"`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add web/tools/markdown.ts web/tools/markdown.test.ts
git commit -m "fix(markdown): convert <br> inside <p> to separate lines (P1-2)"
```

---

## Task 3: P1-3 — 嵌套 `<p>` 导致内容重复输出

**Files:**
- Modify: `web/tools/markdown.ts:255-271`（`<p>` 分支）
- Test: `web/tools/markdown.test.ts`

- [ ] **Step 1: 添加测试**

```typescript
it('does not duplicate content from nested <p> tags', () => {
  const html = `<html><body><h1>T</h1><hr><p><p>嵌套内容</p></p></body></html>`;
  const result = convertHtmlToMarkdown(html, 'test-id');
  const body = result!.body;
  // 嵌套内容只应出现一次
  const matches = body.match(/嵌套内容/g);
  expect(matches).toHaveLength(1);
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npx vitest run web/tools/markdown.test.ts -t "nested"`
Expected: FAIL — `嵌套内容` 出现 2 次

- [ ] **Step 3: 修复代码**

在 `<p>` 分支中，检查 inner 内容是否以 `<p` 开头（嵌套段落），若是则递归处理而非直接 inline：

```typescript
// 找到当前的 <p> 分支，修改为:
} else if (tagLower === 'p') {
  const inner = innerOf('p', tokens.slice(pos).join(''));
  // P1-3 fix: 嵌套段落时递归处理，避免重复输出
  if (inner.trim().startsWith('<p') || inner.trim().startsWith('<P')) {
    // 递归处理内部 HTML（会跳过已处理的标签）
    for (const subLine of htmlToMd(inner)) {
      lines.push(subLine);
    }
  } else {
    const md = inline(inner);
    if (md.trim()) {
      const parts = md.split('  \n');
      for (let i = 0; i < parts.length; i++) {
        if (parts[i].trim()) lines.push(parts[i].trim());
        if (i < parts.length - 1) lines.push('');
      }
      lines.push('');
    } else {
      lines.push('');
    }
  }
  pos++;
  while (pos < tokens.length && !tokens[pos].match(/^<\/p/i)) pos++;
  pos++;
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npx vitest run web/tools/markdown.test.ts -t "nested"`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add web/tools/markdown.ts web/tools/markdown.test.ts
git commit -m "fix(markdown): prevent duplicate content from nested <p> tags (P1-3)"
```

---

## Task 4: P1-4 — 附件行与正文合并无分段

**Files:**
- Modify: `web/tools/markdown.ts:390-410`（body 构建逻辑）
- Test: `web/tools/markdown.test.ts`

- [ ] **Step 1: 添加测试**

```typescript
it('adds blank line between attachment and body', () => {
  const html = `<html><body><h1>T</h1><hr><div class="attachment"><a href="https://x.com">原文</a></div><p>正文第一段</p></body></html>`;
  const result = convertHtmlToMarkdown(html, 'test-id');
  const body = result!.body;
  // 原文链接和正文第一段之间应有空行
  const attachIdx = body.indexOf('原文');
  const bodyIdx = body.indexOf('正文第一段');
  const between = body.slice(attachIdx, bodyIdx);
  expect(between.trim()).toBe('');
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npx vitest run web/tools/markdown.test.ts -t "blank line between"
Expected: FAIL — `原文` 和 `正文第一段` 在同一行

- [ ] **Step 3: 修复代码**

在 `convertHtmlToMarkdown` 函数中，`bodyLines` 构建逻辑（约第393-394行）：

```typescript
// 找到:
if (attachmentLine) bodyLines.push(attachmentLine, '');

// 改为:
if (attachmentLine) bodyLines.push(attachmentLine);
if (rawLines.length > 0) bodyLines.push(''); // 正文前强制空行
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npx vitest run web/tools/markdown.test.ts -t "blank line between"
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add web/tools/markdown.ts web/tools/markdown.test.ts
git commit -m "fix(markdown): add blank line between attachment and body (P1-4)"
```

---

## Task 5: P1-5 — 图片引用未内联到正文

**Files:**
- Modify: `web/tools/markdown.ts:390-432`（`convertHtmlToMarkdown` 返回值处理）
- Modify: `web/tools/markdown.ts:435-465`（`buildMarkdownString`）
- Test: `web/tools/markdown.test.ts`

- [ ] **Step 1: 添加测试**

```typescript
it('inlines image refs into body after attachment', () => {
  const html = `<html><body><h1>T</h1><hr><div class="attachment"><img src="images/test.jpg"/></div><p>正文</p></body></html>`;
  const result = convertHtmlToMarkdown(html, 'test-id');
  // 图片引用应出现在 body 中（正文之前）
  expect(result!.body).toContain('![](images/test.jpg)');
  expect(result!.body).toContain('正文');
  const imgIdx = result!.body.indexOf('![](images/test.jpg)');
  const bodyIdx = result!.body.indexOf('正文');
  expect(imgIdx).toBeLessThan(bodyIdx);
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npx vitest run web/tools/markdown.test.ts -t "inlines image refs"
Expected: FAIL — body 中没有 `![](...)`

- [ ] **Step 3: 修复代码**

**第一步：** 修改 `convertHtmlToMarkdown` 返回值（约第420-432行），将 `imageRefs` 合并到 `bodyLines` 中：

```typescript
// 找到:
return {
  frontmatter: { ... },
  body: bodyLines.join('\n'),
  imageRefs,
};

// 改为:
return {
  frontmatter: { ... },
  body: bodyLines.join('\n'),
  imageRefs,
  // P1-5: 返回内联图片行供 buildMarkdownString 使用
  _inlineImages: imageRefs.map(src => `![](${src})`),
};
```

**第二步：** 修改 `buildMarkdownString`（约第435-465行），在附件行和正文之间插入图片：

```typescript
// 找到 ConvertResult 接口，添加:
interface ConvertResult {
  frontmatter: NoteMetadata;
  body: string;
  imageRefs: string[];
  _inlineImages?: string[]; // P1-5: 内联图片
}

// 在 buildMarkdownString 中（约 buildMarkdownString 函数开头）:
export function buildMarkdownString(result: ConvertResult): string {
  const fm = result.frontmatter;
  const lines: string[] = ['---'];
  // ... frontmatter 字段 ...
  lines.push('---', '');

  // P1-5: 如果有内联图片，在附件和正文之间插入
  const inlineImages = result._inlineImages ?? [];
  for (const img of inlineImages) {
    lines.push(img, '');
  }

  // 最后追加 body
  lines.push(result.body);
  return lines.join('\n');
}
```

**第三步：** 在 `convertHtmlToMarkdown` 的 body 构建逻辑中，将 `_inlineImages` 正确传入：

在 `bodyLines.push('')` 之后、`bodyLines.push(trimmed)` 之前插入图片：
```typescript
// 在 attachmentLine 处理之后（Task 4 的修复处）:
if (attachmentLine) bodyLines.push(attachmentLine);
if (rawLines.length > 0) bodyLines.push(''); // 正文前强制空行
// P1-5: 将图片引用插入正文前
for (const img of imageRefs) {
  bodyLines.push(`![](${img})`, '');
}
```

然后删除 `_inlineImages` 相关代码（用 `imageRefs` 直接处理）。

- [ ] **Step 4: 运行测试验证通过**

Run: `npx vitest run web/tools/markdown.test.ts -t "inlines image refs"
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add web/tools/markdown.ts web/tools/markdown.test.ts
git commit -m "fix(markdown): inline image refs into body before main content (P1-5)"
```

---

## Task 6: P2-6 — 列表项中 `<br>` 导致内容丢失

**Files:**
- Modify: `web/tools/markdown.ts:136-152`（`convertListContent`）
- Test: `web/tools/markdown.test.ts`

- [ ] **Step 1: 添加测试**

```typescript
it('handles <br> inside list items as sub-lines', () => {
  const html = `<html><body><h1>T</h1><hr><ul><li>第一点<br>次行内容</li></ul></body></html>`;
  const result = convertHtmlToMarkdown(html, 'test-id');
  const body = result!.body;
  // 次行内容应在同一列表项中作为缩进子行
  expect(body).toContain('- 第一点');
  expect(body).toContain('次行内容');
  const pointIdx = body.indexOf('第一点');
  const subIdx = body.indexOf('次行内容');
  expect(subIdx).toBeGreaterThan(pointIdx);
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npx vitest run web/tools/markdown.test.ts -t "br.*list\|list.*br"
Expected: FAIL — `次行内容` 丢失或在同一行

- [ ] **Step 3: 修复代码**

修改 `convertListContent` 函数（约第136-152行），在 `parts.push(inline(before))` 处按 `'  \n'` 分割：

```typescript
// 找到:
if (rest.trim()) parts.push(inline(rest));
return parts.join('\n');

// 改为:
// P2-6 fix: 将 <br> 转换为缩进子行
if (rest.trim()) {
  const inlined = inline(rest);
  const subLines = inlined.split('  \n');
  for (let i = 0; i < subLines.length; i++) {
    if (subLines[i].trim()) {
      parts.push(i === 0 ? subLines[i] : `  ${subLines[i]}`);
    }
  }
}
return parts.join('\n');
```

同样处理 `convertOl` 和 `convertUl` 中 `content` 变量的 `inline(inner)` 输出。

- [ ] **Step 4: 运行测试验证通过**

Run: `npx vitest run web/tools/markdown.test.ts -t "br.*list\|list.*br"
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add web/tools/markdown.ts web/tools/markdown.test.ts
git commit -m "fix(markdown): handle <br> in list items as indented sub-lines (P2-6)"
```

---

## Task 7: P2-7 — 过滤包含 'null' 的无效标签

**Files:**
- Modify: `web/tools/markdown.ts:343-346`（tag 过滤逻辑）
- Test: `web/tools/markdown.test.ts`

- [ ] **Step 1: 添加测试**

```typescript
it('filters out tags containing "null"', () => {
  const html = `<html><body><h1>T</h1><hr><span class="tag">AI链接笔记</span><span class="tag">null xxx</span></body></html>`;
  const result = convertHtmlToMarkdown(html, 'test-id');
  expect(result!.frontmatter.tags).toContain('AI链接笔记');
  expect(result!.frontmatter.tags).not.toContain('null xxx');
  expect(result!.frontmatter.tags).not.toContain('null...');
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npx vitest run web/tools/markdown.test.ts -t "filters.*null\|null.*filter"
Expected: FAIL — `'null xxx'` 在 tags 中

- [ ] **Step 3: 修复代码**

```typescript
// 找到 (约第344-346行):
const tags: string[] = tagMatches
  .map(m => stripTags(m[1]).trim())
  .filter(t => t.length > 0 && t !== 'null');

// 改为:
const tags: string[] = tagMatches
  .map(m => stripTags(m[1]).trim())
  .filter(t => t.length > 0 && !t.toLowerCase().includes('null'));
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npx vitest run web/tools/markdown.test.ts -t "filters.*null\|null.*filter"
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add web/tools/markdown.ts web/tools/markdown.test.ts
git commit -m "fix(markdown): filter tags containing 'null' (P2-7)"
```

---

## Task 8: P3-8 — `<code>` 在 `<p>` 中被 `stripTags` 清除

**Files:**
- Modify: `web/tools/markdown.ts:78-102`（`inline` 函数处理顺序）
- Test: `web/tools/markdown.test.ts`

- [ ] **Step 1: 添加测试**

```typescript
it('preserves <code> inside <p> as inline code', () => {
  const html = `<html><body><h1>T</h1><hr><p>Use <code>transformers</code> library</p></body></html>`;
  const result = convertHtmlToMarkdown(html, 'test-id');
  // <code> 应转为 `transformers`，不是纯文本
  expect(result!.body).toContain('`transformers`');
  expect(result!.body).not.toContain(' transformers '); // 不应无反引号
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npx vitest run web/tools/markdown.test.ts -t "preserves.*code\|code.*inside"
Expected: FAIL — `transformers` 无反引号

- [ ] **Step 3: 修复代码**

将 `inline()` 函数中 `<code>` 处理移到 `stripTags()` 之前：

```typescript
// 找到 inline() 函数 (约第78-102行)，当前顺序:
// 1. links
// 2. bold+italic
// 3. bold
// 4. italic
// 5. inline code (第一段)
// 6. inline code (第二段，含 stripTags)
// 7. br
// 8. stripTags（最后）

// 改为 — 将 <code> 处理移到 stripTags 之前，并增强处理:
function inline(text: string): string {
  // 1. P3-8 fix: code FIRST (before stripTags wipes it)
  text = text.replace(/<code(?:[^>]*)?>([\s\S]*?)<\/code>/gi, (_, code) => {
    return `\`${stripTags(code)}\``;
  });
  // 2. links
  text = text.replace(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, label) => {
    return `[${inline(label.trim())}](${href})`;
  });
  // 3. bold+italic
  text = text.replace(/<\/?(?:strong|b)[^>]*>((?:<\/?(?:em|i)[^>]*>|[\s\S])*?)<\/?(?:strong|b)[^>]*>/gi, (_, inner) => `***${inline(inner)}***`);
  // 4. bold
  text = text.replace(/<\/?(?:strong|b)[^>]*>([\s\S]*?)<\/?(?:strong|b)[^>]*>/gi, (_, inner) => `**${inline(inner)}**`);
  // 5. italic
  text = text.replace(/<\/?(?:em|i)[^>]*>([\s\S]*?)<\/?(?:em|i)[^>]*>/gi, (_, inner) => `*${inline(inner)}*`);
  // 6. line break
  text = text.replace(/<br\s*\/?>/gi, '  \n');
  // 7. strip remaining tags (now code is already handled)
  text = stripTags(text);
  return text;
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npx vitest run web/tools/markdown.test.ts -t "preserves.*code\|code.*inside"
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add web/tools/markdown.ts web/tools/markdown.test.ts
git commit -m "fix(markdown): preserve <code> tags before stripTags removes them (P3-8)"
```

---

## Task 9: P3-9 — 评估 `fixMarkdownLineBreaks` 必要性

**Files:**
- Modify: `web/components/panels/RightPanel.tsx:2-18`（`fixMarkdownLineBreaks`）
- Modify: `web/tools/markdown.test.ts`

**注意:** 此任务在 Task 1-8 全部完成后执行。

- [ ] **Step 1: 运行全量测试确认转换器已修复**

Run: `npx vitest run web/tools/markdown.test.ts`
Expected: ALL PASS

- [ ] **Step 2: 检查 fixMarkdownLineBreaks 当前覆盖范围**

读取 `RightPanel.tsx` 中的 `fixMarkdownLineBreaks` 函数（开头第2-18行）。

如果覆盖范围足够（已处理：标题、列表、引用、代码块），可以：
- 保留函数但减少不必要的处理
- 或在注释中标注其为临时兜底

如果发现新的未覆盖场景，在 `markdown.test.ts` 中补充对应测试用例，并在转换器中修复。

- [ ] **Step 3: 提交**

```bash
git add web/components/panels/RightPanel.tsx web/tools/markdown.test.ts
git commit -m "chore(markdown): evaluate fixMarkdownLineBreaks after converter fixes (P3-9)"
```

---

## 自检清单

1. **Spec coverage:** 所有 9 个问题均有对应 Task (1-9) ✓
2. **Placeholder scan:** 无 TBD/TODO ✓
3. **Type consistency:** `ConvertResult` 接口已更新（添加 `_inlineImages`），`buildMarkdownString` 参数类型一致 ✓

---

## 执行方式

计划完成，保存至 `docs/superpowers/plans/2026-04-06-html-markdown-conversion-fixes.md`。

**两种执行方式：**

**1. Subagent-Driven（推荐）** — 我按 Task 逐个 dispatch subagent，每完成一个 Task 审查后再继续

**2. Inline Execution** — 在本 session 中批量执行，带检查点

选择哪种方式？
