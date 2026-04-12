# 🧠 Oh My GetNote

![Oh My GetNote Banner](./Gemini_Generated_Image_9fk5nq9fk5nq9fk5.png)

> 从碎片化的 GetNote 到有灵魂的知识图谱，致敬 Memex 与大模型时代的知识涌现。

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![TypeScript](https://img.shields.io/badge/language-TypeScript-blue)
![Next.js](https://img.shields.io/badge/framework-Next.js%2016-black)

*"人脑不是那样运作的。它靠联想运转。" —— 范内瓦尔·布什 (Vannevar Bush), 1945*

七十五年前，Memex 描绘了一台让所有知识相互链接的机器；今天，借助大语言模型与向量检索技术，**Oh My GetNote** 让这一构想在你的本地环境中生根发芽。它不仅是一个数据转换工具，更是一个为你量身打造的**可交互个人 Memex 中心**。

---

## 💡 为什么做 Oh My GetNote？

我们在 [GetNote](https://www.biji.com) 中沉淀了大量的思考与摘录，但传统的 HTML 导出让知识沦为了静态的信息孤岛。

本平台采用极简的系统设计，旨在打破僵化的树状目录。它将孤立的笔记重塑为具备关联、可无限探索的动态图谱（Graph）。不再依赖繁琐的手动分类，而是**让大模型作为辅助大脑，让知识的隐性关联自然浮现。**

## ✨ 核心能力

- **🤖 AI 智能涌现 (AI Recommendation)**
  点击任意节点，AI 将结合上下文语境自动推荐最相关的笔记，在看似毫无关联的领域之间，碰撞出意外的灵感火花。
- **👣 知识足迹 (Exploration Trails)**
  你在图谱上的每一次探索都会被自然记录。这些无形的"脚印"复刻了你的思维轨迹，随时可以回溯、沉淀并分享给他人。
- **🌌 向量多跳检索 (Vector Multi-Hop Search)**
  突破传统的字面匹配。利用本地 LanceDB 向量数据库，挖掘两跳、三跳以外的深层隐性关联，让深埋底层的知识重见天日。
- **🎯 纯粹与极简的视觉交互**
  拒绝繁冗、刻意科幻的复杂界面，采用克制而干净的 UI 设计，让你专注于知识的连接与思绪的流淌。支持按领域、类型进行快速的图谱过滤。

---

## 🚀 快速起步

只需简单的几步，即可唤醒你的沉睡笔记：

### 1. 准备数据
从 GetNote 导出你的个人知识库（`设置` -> `导出` -> `HTML`），并将文件统一放入本项目的 `source/` 目录。

### 2. 环境配置
```bash
# 安装底层依赖与前端环境
npm install && cd web && npm install && cd ..

# 配置大模型环境变量 (支持 OpenAI 或 OpenRouter)
cp web/.env.local.example web/.env.local
```

### 3. 数据转换与启动

```bash
# 将 HTML 数据解析、转换为 Markdown 及图谱关联索引
npx tsx tools/convert.ts source/ --out .

# 启动图谱可视化平台
cd web && npm run dev
```

打开浏览器访问 `http://localhost:3000/graph`，开启你的无界探索之旅。

---

## 🏗 系统架构与技术栈

项目整体保持高内聚、低耦合的全栈架构设计：

  - **核心框架**: `Next.js 16 (App Router)` + `TypeScript`
  - **UI & 交互**: `Tailwind CSS v4` + `react-force-graph-2d`
  - **智能大脑**: `OpenAI SDK` / `OpenRouter`
  - **向量检索**: `LanceDB` (轻量级本地向量引擎)
  - **工程化质量**: `Vitest` + `Playwright` 自动化测试闭环

## 🛣 演进方向

  - 持续优化海量节点下的图谱渲染性能与极简交互体验。
  - 探索与 **Model Context Protocol (MCP)** 等生态的集成，将个人的 Memex 知识库能力以标准接口形式赋能给更多外部的 AI Agent。

---

## 🤝 参与贡献

欢迎每一个热爱系统思考与知识管理的开发者参与共建。无论是架构优化还是新特性研发，期待你的加入。请参考 [CONTRIBUTING.md](https://www.google.com/search?q=./CONTRIBUTING.md) 了解更多详情，并遵循我们的 [行为准则](https://www.google.com/search?q=./CODE_OF_CONDUCT.md)。

## 📄 开源协议

本项目基于 [MIT License](https://www.google.com/search?q=./LICENSE) 协议开源 © Andy Zhengyan
