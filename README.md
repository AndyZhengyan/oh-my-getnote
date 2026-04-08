# Memex for Getnote

> _"人脑不是那样运作的。它靠联想运转。"_ — 范内瓦尔·布什，1945

1945 年，范内瓦尔·布什构想了 **Memex** 一台让所有知识相互链接的机器——人们可以沿着思想的水迹（trail），在知识之间自由探索，而不必困在僵化的分类里。

七十五年后，我们把它做出来了。

---

**Memex for Getnote** 把你的 [GetNote](https://www.biji.com) 笔记变成一张可交互的知识图谱。沿轨迹探索，让关联自己浮现。

---

## 从 GetNote 到知识图谱，三步完成

```
GetNote (www.biji.com)
    │
    │  ① 导出 HTML
    ▼
source/*.html
    │
    │  ② 运行转换器
    │ npx tsx tools/convert.ts <source-dir> [--out .]
    ▼
notes/*.md         graph-index.json
(Obsidian 风格)   （图谱关联索引）
    │
    │  ③ 启动图谱
    │ cd web && npm run dev
    ▼
  📊 知识图谱
  AI 推荐 · 探索轨迹 · 深度发现
```

---

## 核心能力

**AI 智能推荐**  
点击任意节点，AI 自动推荐最相关的笔记，发现你没想到的关联。

**探索轨迹**  
你的点击路径被记录下来，像走过的一串脚印，帮你回顾研究思路，也可以分享给他人。

**向量多跳搜索**  
不仅找直接相邻的节点，还能发现两步、三步以外的间接关联——让那些藏在深处的连接浮出水面。

**知识过滤**  
按领域、类型筛选图谱，聚焦当前研究主题，然后沿着线索自由探索。

---

## 给 GetNote 用户

你在 [GetNote](https://www.biji.com) 积累了大量个人知识，但散落在一个个 HTML 文件里，关联看不见，思路难回顾。**Memex for Getnote** 把它们变成一张可以探索的图谱——不是强行分类，而是让关联自然浮现。

---

## 快速上手

```bash
# 1. 从 GetNote 导出 HTML → 保存到 source/
#    GetNote → 设置 → 导出 → HTML

# 2. 安装依赖
npm install && cd web && npm install && cd ..

# 3. 配置环境变量
cp web/.env.local.example web/.env.local
# 编辑 web/.env.local，填入 OPENAI_API_KEY（支持 OpenAI 或 OpenRouter）

# 4. 运行转换器
npx tsx tools/convert.ts source/ --out .

# 5. 启动图谱
cd web && npm run dev
# → 打开 http://localhost:3000/graph
```

---

## 技术栈

| 层级 | 技术 |
|---|---|
| 框架 | Next.js 16 (App Router) |
| 语言 | TypeScript |
| 样式 | Tailwind CSS v4 |
| 图谱 | react-force-graph-2d |
| AI | OpenAI SDK / OpenRouter |
| 向量 | LanceDB |
| 测试 | Vitest + Playwright |

---

## 如何贡献

参见 [CONTRIBUTING.md](CONTRIBUTING.md) · [行为准则](CODE_OF_CONDUCT.md)

## 开源许可

MIT © Andy Zhengyan
