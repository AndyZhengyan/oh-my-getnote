# HTML→Markdown 转换链路分析报告

**Issue:** #31 HTML→Markdown 转换质量差
**日期:** 2026-04-06
**分析文件:** tools/convert.ts, web/tools/markdown.ts, web/components/panels/RightPanel.tsx
**对比样本:** 5对 HTML→.md 文件

---

## 转换链路概述

```
HTML文件 (source/.../notes/*.html)
  │
  ├─ parseHtmlFile()          → Note[] (用于语义关联/PCA)
  │
  └─ convertHtmlToMarkdown()  → ConvertResult { frontmatter, body, imageRefs }
       │
       ├─ innerOf() / tokenise() / stripTags()
       ├─ inline()   (处理 bold/italic/code/links/br)
       ├─ htmlToMd() (递归块级元素: p/h1-h6/ol/ul/table/pre/blockquote/div)
       ├─ bodyLines  (折叠连续空行)
       └─ buildMarkdownString() → 写入 .md 文件

渲染端:
  └─ RightPanel.tsx: fixMarkdownLineBreaks(note.body) → ReactMarkdown
```

---

## 问题清单

### P0 — 影响核心内容

#### 1. 空段落无法生成分段符，内容全部压缩为单行

- **位置:** `web/tools/markdown.ts`, `htmlToMd()` 函数, `<p>` 分支 (第255-271行)
- **根因:** HTML转换器问题
- **影响文件:** `01680355e97799f6d72de1fd3792f78a.md`
- **具体现象:** HTML中用空 `<p></p>` 分隔段落，转换后六段感悟全部在同一行输出：
  ```
  mmexport1772602756873.jpg 第一，任何人在我们人生中...第六，真爱不能以时间长短来衡量...
  ```
- **根因分析:** `htmlToMd` 对每个 `<p>` 标签调用 `innerOf()` 提取内容，再调用 `inline()` → `stripTags()`。空 `<p>` 的内容为空字符串，跳过 `if (md.trim())` 分支，不输出任何行。段落间的空行完全丢失。

  ```typescript
  // 第263-267行: 空段落被静默跳过
  const md = inline(inner);
  if (md.trim()) {
    lines.push(md);
    lines.push(''); // paragraphs get blank line
  }
  // ← 空段落: md.trim() === '' → 不push任何内容
  ```

- **修复建议:**
  ```typescript
  // 在 if (md.trim()) 之后增加:
  } else {
    lines.push(''); // 空段落仍输出一个空行，确保段间分隔
  }
  ```

---

### P1 — 严重影响可读性

#### 2. `<br>` 在行内内容中不产生分段效果

- **位置:** `web/tools/markdown.ts`, `inline()` 函数 (第98行) 及 `htmlToMd()` `<p>` 分支
- **根因:** HTML转换器问题
- **影响文件:** `022893952906c9eaf7d51495d5d8d23c.md`, `00e2a9b21b92df3149c9e063c9503aec.md`
- **具体现象:** HTML中 `<br>` 分隔的列表项在 Markdown 中全部挤在一起：

  **HTML源:**
  ```html
  <li><strong>容量有限</strong>：不同模型...<br />  <!-- 换行 -->
  </li>
  ```
  **期望MD:**
  ```
  - **容量有限**：不同模型...
    [次行内容]
  ```
  **实际MD:**
  ```
  - 容量有限：不同模型...对话越长，上下文窗口内容越多...
  ```
- **根因分析:**
  1. `inline()` 将 `<br>` 替换为 `'  \n'` (双空格+换行)
  2. 该字符串经过 `stripTags()` 不受影响（不含HTML标签）
  3. `htmlToMd` 的 `<p>` 分支将整个 `md` 字符串 `push` 为单行
  4. `bodyLines` 处理时，双空格+换行被压入一行文本 (`'  \n'` 作为该行内容的一部分)
  5. 渲染端 ReactMarkdown 不会将普通文本内的 `\n` 识别为换行

  实际上，`<br>` 的效果完全丢失，内容被合并到前一行。

- **修复建议:**
  在 `htmlToMd` 的 `<p>` 分支中，对 `md` 按 `'  \n'` 分割成多行后再逐行 push：
  ```typescript
  const md = inline(inner);
  if (md.trim()) {
    const parts = md.split('  \n');
    for (const part of parts) {
      lines.push(part.trim());
      if (parts.length > 1) lines.push(''); // 非末尾部分后加分段
    }
    lines.push(''); // 段落末尾空行
  }
  ```

#### 3. 嵌套 `<p>` 导致内容重复输出

- **位置:** `web/tools/markdown.ts`, `htmlToMd()` `<p>` 分支 (第255-271行)
- **根因:** HTML转换器问题
- **影响文件:** `00e2a9b21b92df3149c9e063c9503aec.md`
- **具体现象:** HTML中 `<p><p>内容</p></p>` 嵌套结构，转换后内容出现两次：

  **HTML源:**
  ```html
  <p><p>🤯 <strong>AI领域狂热与争议</strong>
  - 当前AI领域像追星一样狂热...
  ```
  **实际MD (部分):**
  ```
  原文：... 🤯 AI领域狂热与争议  （第一次：来自外层<p>的inline()处理）
  🤯 AI领域狂热与争议 - 当前AI领域...  （第二次：来自内层<p>的inline()处理）
  ```
- **根因分析:** tokeniser 把每个 `<p>` 当独立标签处理：
  1. 外层 `<p>` 进入 `htmlToMd` 分支，`innerOf('p', ...)` 提取包括内层 `<p>` 在内的全部内容，调用 `inline()` 输出一次
  2. pos 递增后，tokeniser 继续处理内层 `<p>` 标签，再次进入 `<p>` 分支，输出第二次

- **修复建议:**
  在 `<p>` 分支开头检查 inner 内容是否以 `<p>` 开头（嵌套段落），如果是则递归调用 `htmlToMd(inner)` 而不是 `inline(inner)`：
  ```typescript
  } else {
    const inner = innerOf('p', tokens.slice(pos).join(''));
    if (inner.trim().startsWith('<p')) {
      // 嵌套段落：递归处理而不是inline
      for (const sub of htmlToMd(inner)) lines.push(sub);
    } else {
      const md = inline(inner);
      if (md.trim()) { lines.push(md); lines.push(''); }
      else { lines.push(''); }
    }
  }
  ```

#### 4. 附件行与正文合并，无分段

- **位置:** `web/tools/markdown.ts`, `convertHtmlToMarkdown()` (第393-394行)
- **根因:** HTML转换器问题
- **影响文件:** `00e2a9b21b92df3149c9e063c9503aec.md`, `022893952906c9eaf7d51495d5d8d23c.md`
- **具体现象:** attachment 行 (`原文：[标题](URL)`) 后紧跟正文第一行，无分段：
  ```
  原文： OpenAI"Agent 圣经"翻车?LangChain 创始人怒怼"全是坑"! 🤯 AI领域狂热与争议...
  ```
- **根因分析:** `attachmentLine` 经过 `stripTags()` 消除了原本可能存在的换行；与 `bodyLines` 拼接时无条件 push 后加 `''`，但正文第一行内容无前置空行。

- **修复建议:**
  在 `bodyLines` 构建时，确保正文第一行前有空行：
  ```typescript
  if (attachmentLine) bodyLines.push(attachmentLine);
  if (rawLines.length > 0) bodyLines.push(''); // 正文前强制空行
  ```

#### 5. 图片引用未内联到正文（被放在文件末尾）

- **位置:** `web/tools/markdown.ts`, `convertHtmlToMarkdown()` (第411-418行)
- **根因:** HTML转换器问题
- **影响文件:** `01680355e97799f6d72de1fd3792f78a.md`
- **具体现象:** 图片在 HTML 中位于段前，但 Markdown 中被放在文件最末尾：
  ```
  [文件末尾]
  ![](images/01680355e97799f6d72de1fd3792f78a/getnotes_img_1a69f166c0022f70kUZIxvys.jpeg)
  ```
- **根因分析:**
  1. `imageRefs` 在 `convertHtmlToMarkdown` 中被收集但从未传入 `body`
  2. `buildMarkdownString` 不接受 `imageRefs`，只将 `imageRefs: []` 硬编码
  3. 图片标签在 HTML 的 `<div class="attachment">` 中，但该 div 被整体移除，图片 src 虽被收集但未写入 body

- **修复建议:**
  1. 在 `convertHtmlToMarkdown` 返回值中加入 `imageRefs` 字段
  2. 在 `buildMarkdownString` 中将图片引用内联到 body 开头或 `attachmentLine` 之后
  3. 同时将 `<div class="attachment"><img ...>` 中的图片提取并输出为 `![](...)` 格式

---

### P2 — 影响渲染格式

#### 6. 列表项中的 `<br>` 导致内容丢失（换行后内容被并入下一列表项）

- **位置:** `web/tools/markdown.ts`, `convertListContent()` (第136-152行)
- **根因:** HTML转换器问题
- **影响文件:** `022893952906c9eaf7d51495d5d8d23c.md`
- **具体现象:** 有序列表的列表项在 HTML 中用 `<br>` 分隔多行，转换后换行后的内容消失或被合并：
  ```html
  <ol><li><strong>容量有限</strong>：不同模型...<br />
  </li></ol>
  ```
- **根因分析:** `convertListContent` 调用 `inline()` 处理列表项内容，`inline()` 将 `<br>` 替换为 `'  \n'`，但 `convertListContent` 的返回值直接作为 `convertOl`/`convertUl` 的输出字符串，没有对 `'  \n'` 做进一步处理。换行后的内容被附加到同一列表项文本中（在前端可能显示为同行或被忽略）。

- **修复建议:**
  在 `convertListContent` 中，对 `inline()` 的输出按 `'  \n'` 分割，每段作为子行缩进：
  ```typescript
  // 在 convertListContent 的 parts.push(inline(before)) 处:
  const inlined = inline(before);
  const lines = inlined.split('  \n');
  for (let i = 0; i < lines.length; i++) {
    parts.push(i === 0 ? lines[i] : `  ${lines[i].trim()}`);
  }
  ```

#### 7. 标签解析包含 `null ...` 等无效值

- **位置:** `web/tools/markdown.ts`, `convertHtmlToMarkdown()` (第343-346行)
- **根因:** HTML源问题（数据损坏）
- **影响文件:** `01680355e97799f6d72de1fd3792f78a.md`
- **具体现象:**
  ```yaml
  tags: ["图片笔记", "人生感悟", "电影观后感", "null ..."]
  ```
- **根因分析:** HTML源中 `<span class="tag">` 内容为 `"null ..."`（数据损坏），现有过滤器只过滤 `t !== 'null'`，但不过滤 `'null ...'` 这样的变体。

- **修复建议:** 加强过滤器，过滤包含 `"null"` 字符串的标签：
  ```typescript
  .filter(t => t.length > 0 && !t.toLowerCase().includes('null'))
  ```

---

### P3 — 可选优化

#### 8. `<code>` 内嵌在 `<p>` 中被 `stripTags()` 先清除

- **位置:** `web/tools/markdown.ts`, `htmlToMd()` `<p>` 分支 (第263行)
- **根因:** HTML转换器问题（处理顺序缺陷）
- **具体现象:** `0156cbed3f79c55c02f4a55a7f39a2ab.md` 中 `<code>transformers</code>` 应渲染为 `` `transformers` `` 但实际渲染为纯文本 `transformers`
- **根因分析:** `htmlToMd` 的 `<p>` 分支对 inner HTML 调用 `inline()`，但 `inline()` 内部的处理顺序中，`stripTags()` 放在最后（第100行）。在此之前 `<code>` 正则（第92-96行）可能未能覆盖所有情况（如嵌套在 `<p>` 内的 `<code>`），导致 `<code>` 先被 `stripTags()` 清除为纯文本。

- **修复建议:**
  在 `inline()` 中将 `<code>` 的处理移至 `stripTags()` **之前**，并确保处理所有 `<code>` 变体：
  ```typescript
  function inline(text: string): string {
    // 1. code FIRST (before stripTags)
    text = text.replace(/(?<!`)<code(?:[^>]*)?>([\s\S]*?)<\/code>(?!`)/gi, (_, code) => {
      return `\`${stripTags(code)}\``;
    });
    // 2. links
    // 3. bold/italic
    // 4. remaining tags → stripTags
    text = stripTags(text);
    return text;
  }
  ```

#### 9. `fixMarkdownLineBreaks` 在渲染端做修复是亡羊补牢

- **位置:** `web/components/panels/RightPanel.tsx` (第2-18行)
- **根因:** 前端渲染问题
- **具体现象:** 该函数尝试在渲染前修复块级语法（标题/列表/引用）被打成单行的问题，但正则覆盖不全（不覆盖 `|表格|`、`- [ ]` 等）
- **根因分析:** `fixMarkdownLineBreaks` 是转换质量问题的后补处理，治标不治本。真正的问题在转换器。`fixMarkdownLineBreaks` 引入额外风险：可能在不该分段的位置分段。
- **修复建议:** 优先修复转换器（问题1-6），`fixMarkdownLineBreaks` 可降级为保守的兜底处理，或在确认转换器修复后才考虑移除。

---

## 转换器测试覆盖建议

**建议添加单元测试用例 (vitest) 到 `web/tools/__tests__/markdown.test.ts`：**

| 用例 | HTML输入 | 期望输出 |
|------|----------|----------|
| 空段落分隔 | `<p>第一段</p><p></p><p>第二段</p>` | 两段间有空行 |
| 嵌套 `<p>` | `<p><p>内容</p></p>` | 单次输出，无重复 |
| `<br>` 换行 | `<p>第一行<br>第二行</p>` | 两行分开的段落 |
| `<br>` 在列表项中 | `<li>第一点<br>次行内容</li>` | 缩进子行 |
| 图片附件 | `<div class="attachment"><img src="a.jpg"/></div>` | `![](images/...)` 在正文内 |
| `<code>` 在 `<p>` 中 | `<p>使用 <code>x</code></p>` | `` 使用 `x` `` |
| `<ol>` 嵌套 | `<ol><li>外层<ul><li>内层</li></ul></li></ol>` | 正确缩进嵌套 |
| 附件+正文无分段 | `<div class="attachment">...</div><p>正文</p>` | 附件与正文间有空行 |
| 无效标签过滤 | `<span class="tag">null ...</span>` | 过滤掉，不进 tags |

---

## 建议的修复顺序

1. **[P0-1] 修复空段落不输出空行** — 影响最广，所有多段落笔记均受损
2. **[P1-3] 修复嵌套 `<p>` 重复输出** — 影响含链接笔记的内容准确性
3. **[P1-2] 修复 `<br>` 换行失效** — 影响含列表的笔记格式
4. **[P1-4] 修复附件行与正文合并** — 影响含外部链接的笔记结构
5. **[P1-5] 修复图片引用内联到正文** — 影响图片笔记
6. **[P2-6] 修复列表项中 `<br>` 内容丢失** — 影响复杂列表格式
7. **[P2-7] 过滤无效标签值** — 数据清理
8. **[P3-8] 修复 `<code>` 在 `<p>` 中被 stripTags 清除** — 代码渲染质量
9. **[P3-9] 评估 `fixMarkdownLineBreaks` 必要性** — 在1-8修复后视情况精简
