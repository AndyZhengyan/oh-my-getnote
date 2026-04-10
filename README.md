<img src="docs/banner.png" alt="Oh My Getnote — 你的个人知识轨迹" width="100%"/>

# Oh My Getnote

> _"人脑不是那样运作的。它靠联想运转。"_ — 范内瓦尔·布什，1945

1945 年，范内瓦尔·布什在《大西洋月刊》发表《诚如我等所想》，构想了 **Memex**：一台让所有知识相互链接的机器——人们可以沿着思想的水迹（trail），在知识之间自由探索，而不必困在僵化的分类里。

七十五年后，我们把它做出来了。

---

**Oh My Getnote** 把你的 [GetNote](https://www.biji.com) 笔记变成一台可交互的**个人 Memex**——用 Bush 的方式，让关联自然浮现。

---

## 从 GetNote 到 Memex，三步完成

```
GetNote (www.biji.com)
    │
    │  ① 导出你的知识库
    ▼
source/*.html
    │
    │  ② 运行转换器
    │ npx tsx tools/convert.ts <source-dir> [--out .]
    ▼
notes/*.md         graph-index.json
(Obsidian 风格)   （图谱关联索引）
    │
    │  ③ 启动 Memex
    │ cd web && npm run dev
    ▼
  🧠 你的个人知识轨迹
  AI 推荐 · 探索轨迹 · 深度发现
```

---

## 核心能力

**AI 智能推荐**
点击任意节点，AI 自动推荐最相关的笔记，发现你没想到的关联。

**探索轨迹**
你的点击路径被记录下来，像走过的一串脚印，帮你回顾研究思路，也可以分享给他人——这正是 Bush 所说的"trail"。

**向量多跳搜索**
不仅找直接相邻的节点，还能发现两步、三步以外的间接关联——让那些藏在深处的连接浮出水面。

**知识过滤**
按领域、类型筛选图谱，聚焦当前研究主题，然后沿着线索自由探索。

---

## 致敬 Memex & LLM Wiki

Bush 在 1945 年写道：

> *"人类将要产生的大量知识，将远将超出个人的吸收能力……我们需要一种机器，让知识间形成联想，正如大脑本身所做的那样。"*

**Oh My Getnote** 是这一愿景的现代实现：

- **Memex (1945)**: 沿袭 Vannevar Bush 的构想，让知识通过"足迹"（trail）产生关联，而非死板的分类。
- **LLM Wiki (2024)**: 受 [Andrej Karpathy 构想](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)的启发，我们致力于构建一种 "persistent, compounding artifact"——知识不再是在每次查询时重复发现，而是在你与 AI 的交互中不断沉淀、互联、并持续增量的。

这不是一个简单的笔记备份工具，而是让知识自己说话——通过 AI 的多跳关联与智能推荐，让那些藏在深处的连接自然浮现。

---

## 给 GetNote 用户

你在 [GetNote](https://www.biji.com) 积累了大量个人知识，但散落在一个个 HTML 文件里，关联看不见，思路难回顾。**Oh My Getnote** 把它们变成一张可以探索的图谱——不是强行分类，而是让关联自然浮现。

---

## 快速上手

```bash
# 1. 从 GetNote 导出 HTML → 保存到 source/
#    设置 → 导出 → HTML。source/ 目录下应包含 index.html 和 notes/ 目录（或直接放 HTML）

# 2. 安装所有依赖 (根目录执行一次即可)
npm install

# 3. 配置环境变量
cp web/.env.local.example web/.env.local
# 编辑 web/.env.local，填入 OPENAI_API_KEY

# 4. 运行转换器
npm run convert source/ -- --out .

# 5. 启动图谱
npm run dev
# → 打开 http://localhost:3000/graph
```

### 转换器进阶说明
`npm run convert <source-dir> [options]`
- `--out <dir>`: 指定输出目录（默认当前目录）。
- `--force`: 强制覆盖已存在的 Markdown 正文（默认仅更新元数据，保护手动编辑）。


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
