# 🧠 Oh My Getnote

![Oh My GetNote Banner](./banner.png)

> **当 1945 年的 Memex 遇上 2024 年的 LLM-Wiki。**
> 从碎片化的 GetNote 笔记，到有灵魂的知识足迹 👣。

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![TypeScript](https://img.shields.io/badge/language-TypeScript-blue)
![Next.js](https://img.shields.io/badge/framework-Next.js%2016-black)

---

## 🏛️ 核心哲学：双重致敬

本项目不仅仅是一个数据转换工具，它是一次关于"人类如何管理知识"的实验，旨在致敬两位跨越时代的先驱：

### 1. Vannevar Bush (Memex, 1945)
**"人脑靠联想运转。"** —— Bush 认为知识不应被困在死板的分类里，而应沿着思维的"水迹"（Trails）自由流淌。
* **本项目的实现**：通过交互式图谱（Force Graph）复刻 Memex，让你的点击路径成为可追溯、可沉淀的思维足迹。

### 2. Andrej Karpathy (LLM-Wiki, 2024)
**"知识应当为 AI 消费而优化。"** —— Karpathy 提倡将文档转化为高信息密度、极简化的 Markdown，以提升 LLM 的推理效率。
* **本项目的实现**：将 GetNote 混乱的 HTML 彻底清洗为结构化的 LLM-friendly Markdown，把你的笔记库重塑为一套个人私有的"AI 知识核心（Kernel）"。

---

## 🎬 演示视频

![演示视频](./docs/demo.gif)

> 📥 [高清视频下载 (MP4)](./docs/demo.mp4)

## ✨ 核心能力

* **🤖 AI 驱动的"语义补完"**
    基于 LLM-Wiki 理念，AI 不再仅仅是搜索工具，它通过理解你的 Markdown 语料，在图谱中为你指引下一个可能感兴趣的"逻辑跳跃点"。
* **👣 可视化的"思维水迹" (Trails)**
    致敬 Memex 构想。记录你在知识海洋中的漫游路径，这些路径可以被命名、回溯，成为你研究特定课题的神经通路。
* **📂 从"废墟"到"金矿"的转换引擎**
    一键将 GetNote 的 HTML 碎片重塑为标准、整洁的 Markdown 文档流。去除视觉噪声，保留知识精髓。
* **🌌 向量化多跳关联**
    利用本地 LanceDB 向量引擎，挖掘跨越多个节点的隐性关联，让那些被遗忘在角落的知识重新产生"连接感"。

---

## 🏗️ 技术底座

| 维度 | 技术选型 | 哲学体现 |
| :--- | :--- | :--- |
| **数据层** | `LanceDB` + `Clean Markdown` | **LLM-Wiki**: 结构化、可编程、AI 友好 |
| **视图层** | `Next.js 16` + `react-force-graph` | **Memex**: 非线性探索、联想式交互 |
| **逻辑层** | `OpenAI/OpenRouter` + `Vector API` | **智能涌现**: 让静态数据转化为动态思维 |

---

## 🚀 快速上手

### 1. 准备数据
从 [GetNote](https://www.biji.com) 导出 HTML 压缩包，解压至项目的 `source/` 目录。

### 2. 环境配置
```bash
# 安装全栈依赖
npm install && cd web && npm install && cd ..

# 配置 API Key (支持 OpenAI 或 OpenRouter)
cp web/.env.local.example web/.env.local
```

### 3. 构建与启动

```bash
# 运行转换器：将 HTML 碎片转化为 LLM-Wiki 格式
npx tsx tools/convert.ts source/ --out .

# 唤醒你的个人 Memex
cd web && npm run dev
```

访问 `http://localhost:3000/graph`，开始你的探索。

---

## 🎯 愿景

**Oh My Getnote** 并不想做另一个笔记软件。我们希望在这个 AGI 时代，通过将 Bush 的**交互直觉**与 Karpathy 的**数据标准**结合，让每个人的个人知识库都能成为其数字生命的一部分。

---

**致敬那些试图让人类思考得更深、更远的先驱。**

[CONTRIBUTING.md](CONTRIBUTING.md) · [LICENSE](LICENSE) · MIT © Andy Zhengyan
