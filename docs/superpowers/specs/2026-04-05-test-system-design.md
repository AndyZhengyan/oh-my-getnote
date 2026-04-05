# 测试体系设计

## 目标

为 oh-my-getnote 建立可持续、质量驱动的测试体系，支持 TDD 流程，并在 CI 中自动化验证。

---

## 测试分类

### 单元测试（vitest）

- **范围**：所有 store、工具函数、核心业务逻辑
- **框架**：vitest
- **执行**：CI 必跑，阻止合并
- **目录结构**：与源码平行
  ```
  web/
    stores/
      graphStore.test.ts
      graphStore.ts
    tools/
      markdown.test.ts
      markdown.ts
  tests/
    unit/           ← 新单元测试统一放这里（根目录 tests/）
      stores/
        graphStore.test.ts
      tools/
        markdown.test.ts
    e2e/
      graph.spec.ts
  ```
  > 注：已存在的 `web/stores/graphStore.test.ts` 保持原位，新增测试放入 `tests/unit/`。

### E2E 测试（Playwright）

- **范围**：关键用户路径（覆盖核心功能，不追求全覆盖）
- **框架**：Playwright
- **执行**：本地按需跑，不进 CI

---

## CI 流程

```
push / PR → lint → test-and-build → merge
                 ↓
            lint 失败 → 自动建 GitHub issue
```

### Job 1：lint（可选）

- ESLint 检查
- 失败 → 自动创建 GitHub issue（label: `lint`），不阻止合并
- 需在 GitHub Branch Protection 中设为 **Not required**

### Job 2：test-and-build（必需）

- TypeScript 类型检查（`tsc --noEmit`）
- 单元测试（`vitest run`）
- Next.js 构建（`next build`）
- 任一步骤失败 → 阻止合并
- 需在 GitHub Branch Protection 中设为 **Required**

### Branch Protection 配置（需手动在 GitHub 上设置）

| Job | Required |
|-----|----------|
| lint | No |
| test-and-build | Yes |

---

## TDD 流程

- 新功能 / 重构：先写测试，测试过了才算完成
- Bug 修复：同步补测试，保证回归
- 已有代码：按需补充测试，不强制重构

---

## 已完成的改动

- `web/stores/graphStore.ts` — `savedTrails` 初始化改为 `[]`，移除 `typeof window` guard
- `web/stores/graphStore.test.ts` — 新增 10 个单元测试，覆盖轨迹功能（Bug 1-4 修复）
- `web/vitest.config.ts` — 新建，配置 vitest，exclude e2e
- `web/vitest.setup.ts` — localStorage mock
- `package.json`（根目录）— 新建，CI 依赖
- `.github/workflows/ci.yml` — lint + test-and-build 两阶段 CI

---

## 待完成

- [ ] GitHub 上配置 Branch Protection Rules（lint: not required，test-and-build: required）
- [ ] 已有 store 的测试文件迁移到 `tests/unit/`（`web/stores/graphStore.test.ts` 保持不动）
- [ ] E2E 关键路径补充（本地按需跑）
