# Get笔记 → Markdown 转换器

将 Get笔记 HTML 导出的笔记批量转换为 Markdown，并自动计算语义关联。

## 源数据位置

```
source/voicenotes-202603272159-getnotes_archive_1a71a34b40018ee0wflq7pEq/
├── notes/          # 721 个 .html 文件（每次导出后替换此目录内容）
└── index.html
```

> **每次重新导出 Get笔记后**，将新导出内容的 `notes/` 目录覆盖到上述路径，重新运行 converter 即可。

## 快速开始

### 1. 配置环境变量

converter 需要 API key 来计算语义关联：

```bash
# 如果已有 .env.local，直接创建软链接
ln -sf .env.local .env

# 或手动复制
cp .env.local .env
```

`.env` 已在 `.gitignore` 中，不会被提交。

### 2. 运行转换

```bash
npx tsx tools/convert.ts source/voicenotes-202603272159-getnotes_archive_1a71a34b40018ee0wflq7pEq
```

**幂等模式（默认）**：已存在的 Markdown 文件会跳过 body 写入，只更新 frontmatter（connections）。这保护你对 body 内容的任何手动编辑。

### 3. 强制重新生成 body

当 converter 本身有 bug 修复，需要将所有 Markdown 文件的 body 内容重新生成时：

```bash
npx tsx tools/convert.ts source/voicenotes-202603272159-getnotes_archive_1a71a34b40018ee0wflq7pEq --force
```

--force 会将每个文件的 body 完全重新生成。

## 命令行参数

| 参数 | 说明 |
|------|------|
| `<source-dir>` | 必填，Get笔记 HTML 导出目录 |
| `--out <dir>` | 输出目录，默认 `.`（项目根目录） |
| `--force` | 强制覆盖现有文件的 body 内容 |

## 输出结构

```
# notes/ 目录（幂等：已存在的文件跳过 body，只更新 frontmatter）
notes/
├── AI链接笔记/
├── 录音笔记/
├── 工作记录/
└── ...

# graph-index.json（每次运行自动重新生成）
graph-index.json

# images/（从源 HTML 复制的图片）
images/
```

## 转换流程

1. **解析 HTML**：从 Get笔记导出的 `.html` 文件中提取标题、标签、创建日期
2. **HTML → Markdown**：转换正文内容，处理图片、代码块、HTML 实体
3. **语义关联**：调用 embedding API 计算笔记间的语义相似度（默认 top-8 连接）
4. **写入 frontmatter**：将 connections 写回 Markdown 文件头部
5. **生成 graph-index.json**：供前端图谱使用
6. **写入 LanceDB**：增量写入向量库（已存在的笔记跳过）

## 已知问题与修复历史

### 2026-04-09：修复裸列表项渲染

**问题**：Turndown 在处理 `<p>` 标签内的列表项时，生成的 `- item` 缺少前导空格，Markdown 渲染器会将其识别为普通文本而非列表。

**修复**：在 `web/tools/markdown.ts` 中，检测裸列表项并自动添加前导空格。

### 2026-04-09：修复 mermaid 代码块转换

**问题**：内联 `` `mermaid...` `` 代码被识别为行内代码，而非围栏代码块。

**修复**：在 `web/tools/markdown.ts` 中添加后处理步骤，将内联 mermaid 格式转为标准围栏代码块。

### 2026-04-09：修复图片引用处理顺序

**问题**：imageRefs 数组在 body 内容处理完成后才计算，导致图片引用丢失。

**修复**：调整处理顺序，确保图片引用在 body 处理前已就绪。
