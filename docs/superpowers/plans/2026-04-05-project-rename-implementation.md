# 项目重命名实施计划：my-getnote-kg → oh-my-getnote

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** ✅ 已完成

**Goal:** 将 `my-getnote-kg` 目录统一重命名为 `oh-my-getnote`，代码/文档中所有旧引用已确认无需修改。

**Architecture:** grep 确认结果显示 display name（Oh My Getnote）和 package.json 均已正确，仅需修改一处文档中的目录结构示意路径，然后执行目录重命名。

**Tech Stack:** bash, git

---

## 变更清单（grep 确认结果）

grep 结果证明：**代码层面无需任何修改**。

| 文件 | 当前值 | 结论 |
|------|--------|------|
| `web/app/layout.tsx:6` | `'Oh My Getnote -- by AndyZheng'` | ✅ 无需改动 |
| `web/components/toolbar/Toolbar.tsx:86` | `📚 Oh My Getnote` | ✅ 无需改动 |
| `web/e2e/graph.spec.ts:42` | `text=📚 Oh My Getnote` | ✅ 无需改动 |
| 根目录 `package.json:2` | `"name": "oh-my-getnote"` | ✅ 无需改动 |
| `web/package.json:2` | `"name": "web"` | ✅ 无需改动（子包命名规范） |

**唯一需要修改的位置：**
- `docs/superpowers/specs/2026-04-02-memex2-design.md:23` — 目录结构示意图中 `my-getnote-kg/` → `oh-my-getnote/`

---

## Task 1: 修改文档中的目录结构路径

**Files:**
- Modify: `docs/superpowers/specs/2026-04-02-memex2-design.md:23`

- [ ] **Step 1: 修改目录结构示意图**

将第 23 行 `my-getnote-kg/` 改为 `oh-my-getnote/`

```diff
- my-getnote-kg/
+ oh-my-getnote/
```

- [ ] **Step 2: 验证 grep 不再有 my-getnote-kg 路径引用**

Run: `grep -r "my-getnote-kg" docs/superpowers/`
Expected: 仅剩 `2026-04-05-project-rename-design.md`（该文件本身就是记录重命名过程的文档，无需修改）

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-04-02-memex2-design.md
git commit -m "docs: update directory name in memex2 design spec"
```

---

## Task 2: 创建 PR 并关联 Issue #12

**Files:**
- None (git 操作)

- [ ] **Step 1: 确认分支状态并创建分支**

```bash
git checkout -b feature/project-rename
```

- [ ] **Step 2: Push 并创建 PR，关联 Issue #12**

```bash
git push -u origin feature/project-rename
gh pr create \
  --title "refactor: rename project directory to oh-my-getnote" \
  --body "$(cat <<'EOF'
## Summary
- 更新 `docs/superpowers/specs/2026-04-02-memex2-design.md` 中的目录结构示意图：`my-getnote-kg/` → `oh-my-getnote/`
- 代码层面无需修改（display name 和 package.json 均已正确）

## Changes
- `docs/superpowers/specs/2026-04-02-memex2-design.md` — 目录结构路径

## Test plan
- [x] `grep -r "my-getnote-kg" docs/superpowers/` 仅剩 rename-design 文档本身
- [x] display name grep 结果均为 Oh My Getnote（无需改动）
- [x] package.json name 字段为 oh-my-getnote（无需改动）

Closes #12
EOF
)"
```

Expected: PR 创建成功，Issue #12 自动关联

- [ ] **Step 3: Merge PR**

```bash
gh pr merge --admin --merge
```

Expected: PR merged，Issue #12 自动关闭

---

## Task 3: 重命名本地工作目录

> 此步骤在 PR merge 后执行，关闭 Claude Code 当前 session 前提示用户执行。

```bash
# 退出当前目录
cd /Users/zhengyan/Projects/ai-project

# 重命名目录
mv my-getnote-kg oh-my-getnote

# 进入新目录验证
cd oh-my-getnote
ls
```

**预期结果：** 目录名变为 `oh-my-getnote/`，与 GitHub 仓库名一致。

---

## 验证步骤（PR merge + 目录重命名后执行）

```bash
# 验证 lint
npm run lint

# 验证 build
npm run build

# 验证无 my-getnote-kg 残留（排除 rename-design.md 本身）
grep -r "my-getnote-kg" . --include="*.md" --include="*.ts" --include="*.tsx" --include="*.json" | grep -v "project-rename-design"
# Expected: 无输出
```

---

## 不需要改的内容

| 内容 | 原因 |
|------|------|
| `web/app/layout.tsx` display name | 已经是 "Oh My Getnote" |
| `web/components/toolbar/Toolbar.tsx` logo | 已经是 "📚 Oh My Getnote" |
| `web/e2e/graph.spec.ts` | 已经是 "📚 Oh My Getnote" |
| `根目录 package.json` | name 已经是 "oh-my-getnote" |
| `docs/superpowers/plans/2026-04-02-*.md` | 历史 plan 文件，记录已完成的工作，无需追溯修改 |
| `.claude/settings.local.json` | 本地配置，不提交 git |
