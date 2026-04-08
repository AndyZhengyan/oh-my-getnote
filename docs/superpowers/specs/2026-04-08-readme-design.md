# README 重写设计

## Status: Approved

## Overview

重写项目根目录 `README.md`，面向 GetNote 用户，借鉴 Vannevar Bush Memex 理念，构建一个有情感共鸣和清晰引导的产品介绍。

---

## Design: Memex 理念 + 三步上手 + 四个能力块

### 1. 开篇 — Memex 理念引入

以 Vannevar Bush 1945 年《As We May Think》中的 Memex 愿景开篇，过渡到 75 年后用 AI + 图谱实现的 Memex for Getnote。给用户一个认知框架：这不是普通图谱工具，是笔记探索哲学。

### 2. 核心流程 — 三步上手

```
GetNote (www.biji.com)
    │
    ▼ ① 导出 HTML
source/*.html
    │
    ▼ ② 运行转换器
npm run convert   ──► notes/*.md (Obsidian 风格)
    │
    ▼ ③ 启动图谱
cd web && npm run dev
    │
    ▼
  📊 知识图谱 — AI 推荐 · 路径追踪 · 深度探索
```

### 3. 四个能力块

- **AI 智能推荐** — 点击任意节点，AI 自动推荐最相关的笔记
- **探索轨迹** — 你的点击路径被记录，像走过的脚印，帮你回顾研究思路
- **向量多跳搜索** — 不仅找直接邻居，还能发现两步、三步以外的间接关联
- **知识过滤** — 按领域、类型筛选图谱，聚焦当前研究主题

### 4. 给 GetNote 用户的话

> GetNote 的笔记积累了大量个人知识，但散落在一个个 HTML 文件里，难以关联和回顾。Memex for Getnote 把它们变成一张可以探索的图谱——不是强行分类，而是让关联自然浮现。

### 5. 技术说明 & 社区

简要 tech stack 表格 + contributing 引导。

---

## Target Audience

主要：GetNote 用户想把笔记迁移到本地知识库并深度探索  
次要：研究知识图谱/个人知识管理的开发者

---

## Out of Scope

- 详细的安装文档（放到 web/README.md）
- 功能截图/GIF（未来可补充）
- API 文档
- 贡献指南详细展开
