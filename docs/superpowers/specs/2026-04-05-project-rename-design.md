# 项目重命名设计：my-getnote-kg → oh-my-getnote

## 目标

将项目统一重命名为 **oh-my-getnote**，覆盖代码、文档中的所有旧名称引用，并重命名本地工作目录。

## 变更范围

### 1. 显示名称（Oh My Getnote）

| 文件 | 改动 |
|------|------|
| `web/app/layout.tsx` | `title: 'Oh My Getnote -- by AndyZheng'` |
| `web/components/toolbar/Toolbar.tsx` | Logo 文字 `"📚 Oh My Getnote"` |
| `web/e2e/graph.spec.ts` | E2E 测试断言 `text=📚 Oh My Getnote` |

### 2. package.json

| 文件 | 当前值 | 目标值 |
|------|--------|--------|
| 根目录 `package.json` | `"name": "oh-my-getnote"` | 不变 ✓ |
| `web/package.json` | `"name": "web"` | 不变（子包命名） |

### 3. 本地目录名（my-getnote-kg → oh-my-getnote）

将工作目录重命名，使目录名与 GitHub 仓库名一致：

```bash
# 当前目录
/Users/zhengyan/Projects/ai-project/my-getnote-kg/

# 重命名为
/Users/zhengyan/Projects/ai-project/oh-my-getnote/
```

### 4. docs 旧引用

| 文件 | 改动 |
|------|------|
| `docs/superpowers/plans/*.md` | 替换所有 `my-getnote-kg` 路径为 `oh-my-getnote` |
| `docs/superpowers/specs/*.md` | 同上 |

> 注：`settings.local.json` 是本地配置，不提交 git，无需改。

## 实施步骤（不走 CI，机械变更）

1. `grep` 确认所有旧引用位置
2. 全局替换显示名和 package.json
3. 重命名本地目录
4. 验证：`npm run lint`、`npm run build` 均通过
5. commit 并 push

## 不需要改的内容

- `.claude/settings.local.json`（本地配置）
- `dist/` 目录（构建产物）
- `node_modules/` 目录
